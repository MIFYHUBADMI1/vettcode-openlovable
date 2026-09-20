import type { ApiKeyDoc } from "../types"

/**
 * Atai Runtime — expiration state helper (server-only).
 *
 * Expiration is an AUTHORIZATION state, not deletion: records are never
 * removed by expiry (no MongoDB TTL on api_keys), preserving audit history.
 *
 * The future Runtime API authentication layer treats
 * `now >= expiresAt` as expired (Phase 3 §20 contract). This helper is the
 * single definition of that rule — the middleware phase reuses it rather
 * than re-deciding the semantics.
 *
 * @module lib/runtime/keys/expiration
 */

/** True when the key's expiry instant has passed. Non-expiring keys → false. */
export function isApiKeyExpired(
  key: Pick<ApiKeyDoc, "expiresAt">,
  now: number = Date.now(),
): boolean {
  return key.expiresAt !== undefined && now >= key.expiresAt
}

/**
 * The effective authorization state of a key at a point in time, combining
 * stored status with expiry. "active" is returned only for keys that are
 * stored-active AND not yet expired.
 */
export function effectiveKeyStatus(
  key: Pick<ApiKeyDoc, "status" | "expiresAt">,
  now: number = Date.now(),
): "active" | "revoked" | "expired" {
  if (key.status === "revoked") return "revoked"
  if (isApiKeyExpired(key, now)) return "expired"
  return key.status
}
