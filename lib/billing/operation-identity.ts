/**
 * Atai Finance — Phase 3 stable operation identities (Workstream C).
 *
 * A retryable billable operation must be identified by something that SURVIVES
 * the retry. Random-per-attempt keys (`cryptoId()`) make every retry look like
 * a brand-new charge; a millisecond timestamp lets a double-click produce two
 * distinct keys. This module provides the two primitives the credit paths need:
 *
 *  1. `scopedIntentKey()` — turns a CLIENT-supplied intent identifier into a
 *     ledger idempotency key that is *scoped by the authenticated user and the
 *     server-derived operation*. A client key is NEVER authorization: it only
 *     names the operation the caller already proved it may run. Cross-user and
 *     cross-operation collisions are structurally impossible because the server
 *     prefix is part of the key.
 *  2. `dayEpoch()` — the day-bucket used by account-level purchases that carry
 *     no other durable identifier, mirroring the existing
 *     `sub_grant_<subscriptionId>_period_<dayEpoch>` precedent. A same-day
 *     double-click produces the SAME key, so the second click is a recognized
 *     no-op instead of a second charge.
 *
 * Both produce bounded, secret-free strings safe to persist in the ledger.
 *
 * ── Why the key shape is collision-safe ─────────────────────────────────
 *
 * The ledger's unique index is GLOBAL: `credit_ledger.idempotencyKey` is
 * unique across every user. So a key built by concatenating fields with the
 * SAME separator used inside those fields is not just ugly, it is exploitable:
 * with `intent_<op>_<project>_<user>_<intent>` and an intent charset that
 * allows `_`, caller `user="u_x", intent="k"` and caller `user="u",
 * intent="x_k"` fold into one string — and the second caller's charge is
 * silently recognized as "already applied", i.e. a free billable operation
 * paid for by someone else's ledger row.
 *
 * The fix is a delimiter that appears in NO component: the scope part and the
 * client intent are joined by `~`, which is excluded from both charsets. The
 * split is therefore provably unique, the map (operation, project, user,
 * intent) → key is injective, and truncation can never alias two identities —
 * an over-long component is rejected instead of sliced.
 *
 * @module lib/billing/operation-identity
 */

/** Longest accepted client intent. */
const MAX_INTENT_LENGTH = 128
/** Longest accepted server scope component (user / project ids). */
const MAX_SCOPE_COMPONENT_LENGTH = 96
/** Opaque-id charset. `_` and `-` are allowed INSIDE components, so the
 * scope↔intent boundary uses a character no component may contain. */
const SAFE_COMPONENT = /^[A-Za-z0-9:._-]+$/
const SAFE_INTENT = new RegExp(`^[A-Za-z0-9:._-]{6,${MAX_INTENT_LENGTH}}$`)
const SCOPE_INTENT_DELIMITER = "~"

function isSafeComponent(value: string, maxLength: number): boolean {
  return value.length > 0 && value.length <= maxLength && SAFE_COMPONENT.test(value)
}

/**
 * Validate and scope a client-supplied intent identifier.
 *
 * @param raw    whatever the client sent (unknown until validated)
 * @param params.userId     authenticated user (session-derived)
 * @param params.operation  server-derived operation name, e.g. "seo_audit"
 * @param params.projectId  server-validated project (ownership already enforced)
 * @returns a stable ledger idempotency key, or `undefined` when no usable
 *          intent was supplied — or when any scope component is not a bounded
 *          opaque id. Callers then fall back to their previous per-attempt key:
 *          an unusable intent costs idempotency, it never produces an ambiguous
 *          (and therefore shareable) ledger key.
 */
export function scopedIntentKey(
  raw: unknown,
  params: { userId: string; operation: string; projectId?: string },
): string | undefined {
  if (typeof raw !== "string") return undefined
  const intent = raw.trim()
  if (!SAFE_INTENT.test(intent)) return undefined
  // Every scope component is server-derived; validating them keeps the key
  // injective even if an id format ever grows a delimiter.
  if (!isSafeComponent(params.operation, 48)) return undefined
  if (!isSafeComponent(params.userId, MAX_SCOPE_COMPONENT_LENGTH)) return undefined
  if (params.projectId && !isSafeComponent(params.projectId, MAX_SCOPE_COMPONENT_LENGTH)) return undefined
  const project = params.projectId ? `_${params.projectId}` : ""
  return `intent_${params.operation}${project}_${params.userId}${SCOPE_INTENT_DELIMITER}${intent}`
}

/** Day-bucket epoch (UTC days since 1970) — the same convention used by the
 * subscription-period grant keys. */
export function dayEpoch(timestampMs: number = Date.now()): number {
  return Math.floor(timestampMs / 86_400_000)
}
