/**
 * Atai Runtime — Authentication contracts (SDK-safe).
 *
 * Shared, strongly-typed vocabulary for the runtime authentication boundary
 * (Phase 4). Everything exported here is consumable by the future SDK package:
 * no server-only imports, no MongoDB types, no secrets.
 *
 * SECURITY INVARIANT (Phase 4 §6/§13/§14): the trusted runtime context is
 * derived EXCLUSIVELY from the authenticated API-key record. userId,
 * projectId, environment, and scopes are NEVER read from client-supplied
 * bodies, headers, or query strings. Tests enforce this.
 *
 * @module runtime/contracts/auth
 */

import type {
  CapabilityScope,
  RuntimeEnvironment,
} from "./capabilities"

/**
 * Coarse failure categories for runtime authentication. Deliberately vague
 * toward callers: a revoked key and an unknown key produce the same external
 * 401 unless explicitly distinguished by the error contract — these values
 * are for server-side classification and logging, not for echoing state to
 * the caller (Phase 4 §18/§22: no key-state enumeration).
 */
export const RUNTIME_AUTH_FAILURE_REASONS = [
  /** No credential was presented at all. */
  "missing",
  /** Authorization header present but malformed / wrong scheme / empty. */
  "malformed",
  /** Credential presented but no active key matches its hash. */
  "invalid",
  /** Key found but status is revoked. */
  "revoked",
  /** Key found but expiresAt has passed (regardless of stored status). */
  "expired",
] as const

export type RuntimeAuthFailureReason = (typeof RUNTIME_AUTH_FAILURE_REASONS)[number]

/**
 * Trusted runtime authentication context. This is the ONLY identity shape
 * runtime handlers may rely on. By construction it cannot carry the plaintext
 * key, its hash, or any provider credential — there are no fields for them.
 */
export interface RuntimeAuthContext {
  /** Stable non-secret key reference (rkey_...). */
  apiKeyId: string
  /** Owning Atai user — derived from the key record. */
  userId: string
  /** Bound Atai project — derived from the key record. */
  projectId: string
  /** development | production — derived from the key record, never the request. */
  environment: RuntimeEnvironment
  /** Capability scopes granted to this key (empty array = all capabilities). */
  scopes: CapabilityScope[]
}

/**
 * The canonical runtime credential scheme. Single source of truth for the
 * extractor and documentation: `Authorization: Bearer atai_<environment>_<secret>`.
 */
export const RUNTIME_AUTH_SCHEME = "Bearer"
