/**
 * Atai Runtime — Billing transaction types (additive only).
 *
 * The existing Atai credit ledger (lib/billing/credit-service.ts + the
 * `credit_ledger` collection) remains the SINGLE authoritative balance
 * system. Runtime consumption will debit it in a later phase — this file
 * only lands the transaction-type vocabulary so the ledger can accept
 * runtime entries without another migration.
 *
 * NO runtime_balance / runtime_wallet / runtime_credits — no second balance
 * system is created, ever.
 *
 * @module runtime/contracts/billing
 */

/**
 * Runtime ledger transaction types, to be used with the existing
 * `consumeCredits` / `grantCredits` (lib/billing/credit-service.ts) once the
 * charging phase lands. Prefix `runtime_` keeps them unambiguous in the
 * shared ledger.
 */
export const RUNTIME_LEDGER_TRANSACTION_TYPES = [
  /** Debit — per-request runtime consumption (charged after provider call). */
  "runtime_usage",
  /** Debit — reservation for a multi-request or async runtime job. */
  "runtime_reservation",
  /** Credit — refund of a runtime reservation/charge (failure, overestimate). */
  "runtime_refund",
] as const

export type RuntimeLedgerTransactionType =
  (typeof RUNTIME_LEDGER_TRANSACTION_TYPES)[number]

/**
 * Runtime idempotency key prefix. The existing ledger enforces uniqueness on
 * `idempotencyKey` (unique index) — a retried runtime request reusing the
 * same key can never double-charge. The requestId links usage event and
 * ledger entry; this prefix namespaces it in the shared ledger.
 */
export const RUNTIME_IDEMPOTENCY_PREFIX = "runtime_"

/**
 * Build the ledger idempotency key for a runtime usage charge. One requestId
 * maps to exactly one charge, regardless of retries.
 */
export function runtimeUsageIdempotencyKey(requestId: string): string {
  return `${RUNTIME_IDEMPOTENCY_PREFIX}${requestId}`
}

/**
 * Type guard — is this ledger transaction type a runtime one? Useful for
 * downstream code that switches on transaction type and wants to route
 * runtime entries without exhaustively knowing them.
 */
export function isRuntimeTransactionType(t: string): t is RuntimeLedgerTransactionType {
  return (RUNTIME_LEDGER_TRANSACTION_TYPES as readonly string[]).includes(t)
}
