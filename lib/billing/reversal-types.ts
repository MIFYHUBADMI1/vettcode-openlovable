/**
 * Atai Finance — Phase 3 shared ledger reversal vocabulary (Workstream D).
 *
 * Admin credit reports need ONE honest definition of "credits handed back to
 * the user". The ledger writes that with several transaction types depending on
 * WHY the credits came back, and the old admin aggregations filtered on a
 * literal `"refund"` token that no code path ever writes (and on
 * `"build_refund"`, which is the legacy build-refund label) — so real
 * clawbacks were invisible in those reports.
 *
 * Verified writers and the direction each one actually writes:
 *  - `runtime_refund`   — runtime metering overcharge refund, written through
 *                         `grantCredits` → direction **credit**
 *                         (`lib/runtime/metering/charge`).
 *  - `other_reversal`   — feature-failure refunds (Collaborate, SEO audit,
 *                         Marketing Studio, Resources AI), written through
 *                         `grantCredits` → direction **credit**.
 *  - `build_release`    — reserved build credits released back
 *                         (`releaseReservation`) → direction **credit**.
 *  - `build_refund`     — legacy label kept so historical rows still count
 *                         (same meaning: credits handed back).
 *  - `refund_reversal`  — Dodo payment-refund CLAWBACK, written through
 *                         `reverseCredits` → direction **debit**. It takes
 *                         granted credits AWAY after a refund; it is NOT a
 *                         refund of consumed credits.
 *
 * That split is why the direction-scoped lists below exist: summing a clawback
 * into "credits handed back to users" would invert a real movement and
 * double-net the money side (Phase 3 §6).
 *
 * @module lib/billing/reversal-types
 */

/** Reversal rows whose authoritative direction is `credit` — credits handed
 * back to the user. */
export const CREDIT_BACK_REVERSAL_TRANSACTION_TYPES = [
  "runtime_refund",
  "other_reversal",
  "build_release",
  "build_refund",
] as const

/** Reversal rows whose authoritative direction is `debit` — credits clawed back
 * FROM the user after a provider refund. */
export const CLAWBACK_REVERSAL_TRANSACTION_TYPES = ["refund_reversal"] as const

/** Ledger `transactionType` values that represent ANY reversal-shaped row. */
export const CREDIT_REVERSAL_TRANSACTION_TYPES = [
  ...CREDIT_BACK_REVERSAL_TRANSACTION_TYPES,
  ...CLAWBACK_REVERSAL_TRANSACTION_TYPES,
] as const

export type CreditReversalTransactionType = (typeof CREDIT_REVERSAL_TRANSACTION_TYPES)[number]

/** The direction a reversal type is authoritative for; undefined for anything
 * outside the reversal vocabulary (callers must not guess). */
export function expectedReversalDirection(transactionType: string): "credit" | "debit" | undefined {
  if ((CREDIT_BACK_REVERSAL_TRANSACTION_TYPES as readonly string[]).includes(transactionType)) return "credit"
  if ((CLAWBACK_REVERSAL_TRANSACTION_TYPES as readonly string[]).includes(transactionType)) return "debit"
  return undefined
}
