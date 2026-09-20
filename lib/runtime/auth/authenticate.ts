import "server-only"
import { AppError } from "@/lib/errors"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { logger } from "@/lib/logging/logger"
import {
  runtimeError,
  runtimeStatusForCode,
} from "@/runtime/contracts/errors"
import type {
  RuntimeAuthContext,
  RuntimeAuthFailureReason,
} from "@/runtime/contracts/auth"
import { formatRequestId } from "@/runtime/contracts/capabilities"
import { hashApiKey } from "@/lib/runtime/key-crypto"
import { findActiveApiKeyBySecret, classifyApiKeyByHash, touchLastUsed } from "@/lib/runtime/keys"
import { extractApiKey } from "./extract"
import {
  PLATFORM_RUNTIME_REQUESTS_PER_MINUTE,
  PLATFORM_RUNTIME_REQUESTS_PER_MINUTE_WINDOW_MS,
} from "@/lib/runtime/platform-limits"

/**
 * Atai Runtime — canonical runtime authentication (server-only).
 *
 * ONE authentication path for the entire runtime API (Phase 4 §12):
 *
 *   request → extract → hash → lookup → status/expiration validation
 *           → trusted RuntimeAuthContext
 *
 * Security properties (verified by tests):
 *   - Identity (userId/projectId/environment/scopes) comes ONLY from the
 *     api_keys record — never from client bodies/headers/query (§6/§13/§14).
 *   - Revoked, expired, and unknown keys all fail closed.
 *   - A stored status of "active" with a past expiresAt NEVER authenticates.
 *   - No plaintext key, keyHash, or Authorization header is ever logged.
 *   - Internal (ATAI_INTERNAL_KEY) credentials cannot authenticate here:
 *     they don't match the runtime key shape and don't exist in api_keys.
 *
 * @module lib/runtime/auth/authenticate
 */

// ─── Rate limiting (reuses the existing limiter — no second system) ────────

const AUTH_FAILURE_LIMIT = 20 // invalid credential attempts...
const AUTH_FAILURE_WINDOW_MS = 5 * 60 * 1000 // ...per 5 minutes per key material
const AUTH_REQUEST_LIMIT = PLATFORM_RUNTIME_REQUESTS_PER_MINUTE // authenticated requests...
const AUTH_REQUEST_WINDOW_MS = PLATFORM_RUNTIME_REQUESTS_PER_MINUTE_WINDOW_MS

/**
 * Map the generic RATE_LIMITED AppError thrown by the existing limiter into
 * the runtime taxonomy at the runtime boundary (Phase 4 §21 — the limiter is
 * NOT modified; the mapping happens here so `handleRouteError` can natively
 * serialize a runtime_* response).
 */
function toRuntimeRateLimitError(e: unknown): unknown {
  if (e instanceof AppError && e.code === "RATE_LIMITED") {
    return runtimeError("runtime_rate_limited")
  }
  return e
}

/**
 * Brute-force backstop: applied when a credential fails authentication.
 * Identifier is the HASHED credential — no plaintext material as a limiter
 * key, and the value is stable across retries of the same bad key.
 */
async function enforceAuthFailureLimit(hash: string): Promise<void> {
  try {
    await checkRateLimit({
      action: "runtime_auth_fail",
      identifier: hash,
      limit: AUTH_FAILURE_LIMIT,
      windowMs: AUTH_FAILURE_WINDOW_MS,
      errorCode: "RATE_LIMITED",
    })
  } catch (e) {
    throw toRuntimeRateLimitError(e)
  }
}

/**
 * Volume cap on the authenticated hot path. Identifier is the apiKeyId —
 * per-key, per-window request ceiling. Throws runtime_rate_limited.
 */
async function enforceAuthenticatedRequestLimit(apiKeyId: string): Promise<void> {
  try {
    await checkRateLimit({
      action: "runtime_auth_request",
      identifier: apiKeyId,
      limit: AUTH_REQUEST_LIMIT,
      windowMs: AUTH_REQUEST_WINDOW_MS,
      errorCode: "RATE_LIMITED",
    })
  } catch (e) {
    throw toRuntimeRateLimitError(e)
  }
}

// ─── Failure classification → stable error responses ───────────────────────

/**
 * Map a server-side failure classification to the thrown error. The caller
 * receives stable runtime_* codes with correct HTTP semantics:
 *
 *   missing/malformed/invalid → runtime_authentication_error (401)
 *   revoked                   → runtime_key_revoked           (401)
 *   expired                   → runtime_key_expired           (401)
 *
 * Responses never disclose key metadata beyond the code itself (Phase 4
 * §18/§22: no key-state or existence enumeration).
 */
function failureToError(reason: RuntimeAuthFailureReason): AppError {
  switch (reason) {
    case "revoked":
      return runtimeError("runtime_key_revoked")
    case "expired":
      return runtimeError("runtime_key_expired")
    case "missing":
    case "malformed":
    case "invalid":
    default:
      return runtimeError("runtime_authentication_error")
  }
}

// ─── Canonical authentication entry point ──────────────────────────────────

/**
 * Authenticate a runtime request and produce the trusted context.
 *
 * Throws AppError (runtime_* codes) on any failure. The returned context is
 * the ONLY trusted identity — handlers must not re-parse headers or accept
 * identity fields from the client.
 */
export async function authenticateRuntimeRequest(
  request: Request,
): Promise<RuntimeAuthContext & { requestId: string }> {
  const requestId = formatRequestId()

  // 1. Credential extraction — one canonical path (never logged).
  const token = extractApiKey(request)
  if (!token) {
    logger.info("runtime.auth", "runtime auth rejected: no valid credential presented", {
      requestId,
    })
    throw failureToError("missing")
  }

  // 2. Hash the presented secret (same normalization as creation/rotation).
  const hash = hashApiKey(token)

  // 3. Single indexed lookup with lifecycle classification.
  const classified = await classifyApiKeyByHash(hash)

  if (!classified) {
    await enforceAuthFailureLimit(hash)
    logger.info("runtime.auth", "runtime auth rejected: credential does not resolve to a key", {
      requestId,
    })
    throw failureToError("invalid")
  }

  const { doc, failureReason } = classified

  if (failureReason) {
    // Known key, not currently usable. Rate-limit the key material and fail
    // closed with the stable code for this reason. No key-state metadata is
    // disclosed beyond the code itself.
    await enforceAuthFailureLimit(hash)
    logger.info("runtime.auth", "runtime auth rejected: key not currently usable", {
      requestId,
      apiKeyId: doc.id,
      userId: doc.userId,
      projectId: doc.projectId,
      environment: doc.environment,
      reason: failureReason,
    })
    throw failureToError(failureReason)
  }

  // 4. Authenticated — volume cap per key (§21) and throttled lastUsedAt.
  await enforceAuthenticatedRequestLimit(doc.id)
  await touchLastUsed(doc.id, doc.lastUsedAt)

  logger.info("runtime.auth", "runtime request authenticated", {
    requestId,
    apiKeyId: doc.id,
    userId: doc.userId,
    projectId: doc.projectId,
    environment: doc.environment,
  })

  return {
    requestId,
    apiKeyId: doc.id,
    userId: doc.userId,
    projectId: doc.projectId,
    environment: doc.environment,
    scopes: doc.scopes,
  }
}

/**
 * Normalize an authentication error for `handleRouteError`. Runtime codes are
 * registered additively into the central registries at module load, so a raw
 * AppError from this module serializes correctly — this helper exists for
 * callers that want the STATUS re-resolved via the contract fallback map
 * (messages are preserved as-is; they only ever come from the safe contract
 * vocabulary or an explicit caller-provided string).
 */
export function normalizeRuntimeAuthError(e: unknown): AppError {
  if (e instanceof AppError) {
    const status = runtimeStatusForCode(e.code) ?? e.status
    return new AppError(e.code, e.message, status)
  }
  return e as AppError
}
