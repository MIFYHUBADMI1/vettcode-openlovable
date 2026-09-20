import "server-only"
import { apiKeysCol } from "@/lib/db/runtime-collections"
import type { RuntimeAuthFailureReason } from "@/runtime/contracts/auth"
import { effectiveKeyStatus, isApiKeyExpired } from "./expiration"
import type { ApiKeyDoc } from "../types"

/**
 * Atai Runtime — key classification by hash (server-only).
 *
 * ONE indexed lookup resolves the full lifecycle state of a presented
 * credential. Used by the runtime authentication layer (Phase 4) to
 * fail closed with a precise server-side reason while the external response
 * stays stable (Phase 4 §18/§22).
 *
 * @module lib/runtime/keys/classify
 */

export interface ApiKeyClassification {
  /** The key record when the hash resolves at all (any status). */
  doc: ApiKeyDoc
  /**
   * Null when the key is currently usable (stored status "active" AND not
   * past expiresAt). Otherwise the server-side reason: "revoked" | "expired".
   * Stored status "active" with a past expiresAt classifies as "expired" —
   * stored status alone is never trusted over real expiry (Phase 4 §9/§10).
   */
  failureReason: Extract<RuntimeAuthFailureReason, "revoked" | "expired"> | null
}

/**
 * Classify a key by its hash. Returns null when no key has this hash
 * (unknown credential). Never throws for lifecycle reasons — unknown hash
 * is a null return, not an error.
 */
export async function classifyApiKeyByHash(
  keyHash: string,
): Promise<ApiKeyClassification | null> {
  const col = await apiKeysCol()
  const doc = await col.findOne({ keyHash })

  if (!doc) return null

  if (doc.status === "revoked") {
    return { doc, failureReason: "revoked" }
  }

  // Expiry is evaluated from expiresAt, not from the stored status — a key
  // marked "active" whose expiresAt has passed is EXPIRED (§9/§10).
  if (isApiKeyExpired(doc)) {
    return { doc, failureReason: "expired" }
  }

  if (doc.status !== "active") {
    // Status "expired" (set by the Phase 3 sweep) — treat as expired.
    return { doc, failureReason: "expired" }
  }

  return { doc, failureReason: null }
}

// Re-exported for consumers that need the raw state helpers alongside
// classification (kept in one module for the auth path's single import).
export { effectiveKeyStatus, isApiKeyExpired }
