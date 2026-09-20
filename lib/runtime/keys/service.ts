import "server-only"
import { ObjectId } from "mongodb"
import { apiKeysCol, ensureRuntimeIndexes } from "@/lib/db/runtime-collections"
import { cryptoId } from "@/lib/store/id"
import { logger } from "@/lib/logging/logger"
import type { AppError } from "@/lib/errors"
import { runtimeError } from "@/runtime/contracts/errors"
import type {
  ApiKeyCreateInput,
  ApiKeyPublic,
  ApiKeyCreated,
} from "@/runtime/contracts/capabilities"
import { generateApiKey, hashApiKey } from "../key-crypto"
import type { ApiKeyDoc } from "../types"

/**
 * Atai Runtime — API key service (server-only).
 *
 * Owns the api_keys lifecycle: create / list / revoke / lookup-by-hash.
 * SECURITY INVARIANTS enforced here (and by tests):
 *   1. Plaintext secrets are never persisted — only the SHA-256 hash.
 *   2. Ownership filters are part of every query (never fetch-then-check).
 *   3. Reads that cross a trust boundary project away keyHash entirely.
 *   4. Future authentication MUST derive userId/projectId from the key record,
 *      never from client-supplied fields (RuntimeContext contract).
 *
 * @module lib/runtime/keys/service
 */

/** Mongo projection removing the hash from any doc crossing a trust boundary. */
const PUBLIC_PROJECTION = { keyHash: 0, _id: 0 } as const

function toPublic(doc: ApiKeyDoc): ApiKeyPublic {
  return {
    id: doc.id,
    projectId: doc.projectId,
    environment: doc.environment,
    name: doc.name,
    keyPrefix: doc.keyPrefix,
    scopes: doc.scopes,
    status: doc.status,
    createdAt: doc.createdAt,
    lastUsedAt: doc.lastUsedAt,
    expiresAt: doc.expiresAt,
  }
}

// ─── Creation ──────────────────────────────────────────────────────────────

/**
 * Create a new API key for a project. The caller (future dashboard route)
 * MUST have already verified that the authenticated session user owns
 * `projectId` using assertProjectOwnership — this service trusts that check
 * and does not re-query the projects collection.
 *
 * Returns the plaintext secret exactly once.
 */
export async function createApiKey(
  userId: string,
  input: ApiKeyCreateInput,
): Promise<ApiKeyCreated> {
  await ensureRuntimeIndexes()
  const generated = generateApiKey(input.environment)
  const now = Date.now()
  const doc: ApiKeyDoc = {
    _id: new ObjectId(),
    id: `rkey_${cryptoId()}`,
    userId,
    projectId: input.projectId,
    environment: input.environment,
    name: input.name,
    keyHash: generated.keyHash,
    keyPrefix: generated.keyPrefix,
    scopes: input.scopes,
    status: "active",
    createdAt: now,
    ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
  }

  const col = await apiKeysCol()
  await col.insertOne(doc)

  logger.info("runtime.keys", "API key created", {
    keyId: doc.id,
    userId,
    projectId: input.projectId,
    environment: input.environment,
    scopes: input.scopes,
  })

  return { ...toPublic(doc), secret: generated.secret }
}

// ─── Lookup (future auth middleware foundation) ────────────────────────────

/**
 * Resolve an API key by its full plaintext secret. Returns the doc (hash
 * included — this is server-internal) only when active and unexpired;
 * revoked/expired/unknown all resolve to null so callers emit ONE generic
 * authentication error without leaking key state.
 */
export async function findActiveApiKeyBySecret(secret: string): Promise<ApiKeyDoc | null> {
  const col = await apiKeysCol()
  const now = Date.now()
  return col.findOne({
    keyHash: hashApiKey(secret),
    status: "active",
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
  })
}

/** Non-secret lookup by id (dashboard/admin use). */
export async function findApiKeyById(id: string): Promise<ApiKeyDoc | null> {
  const col = await apiKeysCol()
  return col.findOne({ id })
}

// ─── Listing ───────────────────────────────────────────────────────────────

/** List a user's keys for a project (metadata only — hash projected away). */
export async function listApiKeys(userId: string, projectId: string): Promise<ApiKeyPublic[]> {
  await ensureRuntimeIndexes()
  const col = await apiKeysCol()
  const docs = await col
    .find({ userId, projectId }, { projection: PUBLIC_PROJECTION })
    .sort({ createdAt: -1 })
    .toArray()
  return docs as unknown as ApiKeyPublic[]
}

// ─── Revocation ────────────────────────────────────────────────────────────

/**
 * Revoke a key. Ownership is enforced IN the filter: a doc is only modified
 * when it belongs to `userId` (and, when provided, `projectId`) — a caller
 * supplying another user's keyId modifies nothing and gets false.
 */
export async function revokeApiKey(
  userId: string,
  keyId: string,
  reason: string,
  projectId?: string,
): Promise<boolean> {
  const col = await apiKeysCol()
  const now = Date.now()
  const filter: Record<string, unknown> = { id: keyId, userId, status: "active" }
  if (projectId) filter.projectId = projectId

  const result = await col.updateOne(filter, {
    $set: { status: "revoked" as const, revokedAt: now, revokedReason: reason },
  })

  if (result.modifiedCount > 0) {
    logger.info("runtime.keys", "API key revoked", { keyId, userId, reason })
  }
  return result.modifiedCount > 0
}

// ─── lastUsedAt (throttled) ────────────────────────────────────────────────

/**
 * Opportunistic lastUsedAt touch. Throttled to one write per key per 60s to
 * avoid a write per runtime request. Never throws — telemetry must not fail
 * the request path.
 */
export async function touchLastUsed(keyId: string, previous?: number): Promise<void> {
  const THROTTLE_MS = 60_000
  if (previous && Date.now() - previous < THROTTLE_MS) return
  try {
    const col = await apiKeysCol()
    await col.updateOne({ id: keyId }, { $set: { lastUsedAt: Date.now() } })
  } catch (e) {
    logger.warn("runtime.keys", "lastUsedAt touch failed (non-fatal)", {
      keyId,
      message: e instanceof Error ? e.message : String(e),
    })
  }
}

// ─── Expiry sweep (lazy status transition) ─────────────────────────────────

/**
 * Flip expired-but-still-active keys to status "expired". TTL-style lazy
 * transition: called opportunistically by list/read paths. Idempotent and
 * best-effort.
 */
export async function sweepExpiredKeys(): Promise<void> {
  try {
    const col = await apiKeysCol()
    await col.updateMany(
      { status: "active", expiresAt: { $lte: Date.now() } },
      { $set: { status: "expired" as const } },
    )
  } catch (e) {
    logger.warn("runtime.keys", "expiry sweep failed (non-fatal)", {
      message: e instanceof Error ? e.message : String(e),
    })
  }
}

// ─── Error helpers (typed runtime errors for future endpoints/middleware) ──

export function authenticationError(message?: string): AppError {
  return runtimeError("runtime_authentication_error", message)
}

export function authorizationError(message?: string): AppError {
  return runtimeError("runtime_authorization_error", message)
}
