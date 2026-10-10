/**
 * ATAI — Universal Credit Valuation (Finance)
 * ================================================================
 *
 * ONE authoritative definition of the standard USD-equivalent value of
 * ATAI credits, approved for universal use across ATAI:
 *
 *     3,750 ATAI credits = US$1.00
 *
 * This valuation is UNIVERSAL — it is not scoped to visual generation or any
 * other single runtime capability. Every Finance/reporting calculation that
 * needs a USD-equivalent value for a credit quantity must go through this
 * module instead of hard-coding its own conversion constant.
 *
 * ── What this valuation is NOT ────────────────────────────────────────
 *
 * The valuation answers exactly one question: "what is the standard
 * USD-equivalent value of this quantity of credits?" It does NOT establish:
 *
 *   1. Credit quantity   — how many credits were granted/consumed/reversed.
 *   2. Payment revenue   — actual cash received through Dodo Payments
 *                          (recorded in `payment_records`, net of refunds).
 *   3. Provider cost     — real monetary cost reported by external providers.
 *   4. Profitability     — a separate calculation needing defensible revenue
 *                          AND cost definitions.
 *
 * 7,500 consumed credits have a standard value of $2.00. That alone is NOT
 * $2.00 of revenue, NOT $2.00 of provider cost, and NOT $2.00 of profit.
 * Never label a standard credit value as cash collected or profit.
 *
 * ── Precision ─────────────────────────────────────────────────────────
 *
 * The repository has no arbitrary-precision decimal dependency, so this
 * module uses exact INTEGER arithmetic (BigInt) at micro-USD resolution
 * (1e-6 USD) and rounds half away from zero exactly once, at that boundary.
 *
 * Rules for callers:
 *   - Credit quantities are integers in ATAI's model; fractional inputs are
 *     rejected rather than silently rounded.
 *   - AGGREGATE FIRST, CONVERT ONCE (see `sumCreditsToUsd`). Never round
 *     individual ledger rows and then sum the rounded results.
 *   - Round to cents only at a reporting/display boundary
 *     (`creditsToUsdCents`), never mid-aggregation.
 *   - Signed inputs keep their sign; use `consumedCreditsValueUsd` when a
 *     report wants the positive value of consumed credits, and
 *     `ledgerMovementValueUsd` to preserve debit/credit direction.
 *
 * @module lib/billing/credit-valuation
 */

/** Approved universal valuation: 3,750 ATAI credits = US$1.00. */
export const ATAI_CREDITS_PER_USD = 3750

/**
 * Version stamp of the valuation basis. Include this in any reporting
 * contract that expresses credit values in USD so the basis is explicit and
 * auditable (a future re-baseline must not silently change history).
 */
export const CREDIT_VALUATION_VERSION = "ATAI_CREDIT_VALUATION_V1"

/** Human-readable basis statement for reports, docs and API contracts. */
export const CREDIT_VALUATION_BASIS =
  `${CREDIT_VALUATION_VERSION}: 3,750 ATAI credits = US$1.00 ` +
  "(standard credit valuation only — not revenue, provider cost, or profit)"

/** Micro-USD resolution used for exact internal arithmetic (1e-6 USD). */
const MICROS_PER_USD = 1_000_000

const CREDITS_PER_USD_BIG = BigInt(ATAI_CREDITS_PER_USD)
const MICROS_PER_USD_BIG = BigInt(MICROS_PER_USD)

// ─── Internal helpers ────────────────────────────────────────────────────────

function assertIntegerCredits(credits: number): void {
  if (typeof credits !== "number" || !Number.isFinite(credits)) {
    throw new RangeError(`creditsToUsd: expected a finite number, received ${String(credits)}`)
  }
  if (!Number.isInteger(credits)) {
    throw new RangeError(
      `creditsToUsd: credit quantities must be integers (received ${credits}). ` +
        "Aggregate fractional per-row values first, then convert once.",
    )
  }
  if (!Number.isSafeInteger(credits)) {
    throw new RangeError(`creditsToUsd: credit quantity exceeds safe integer range (${credits})`)
  }
}

/** Exact division with rounding half away from zero (BigInt, no drift). */
function divRound(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n
  const abs = negative ? -numerator : numerator
  const quotient = abs / denominator
  const remainder = abs % denominator
  // remainder * 2 >= denominator  ⇔  remainder >= 0.5
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient
  return negative ? -rounded : rounded
}

// ─── Core valuation ──────────────────────────────────────────────────────────

/**
 * Exact conversion of an integer credit quantity to micro-USD (1e-6 USD),
 * rounded half away from zero at the micro-USD boundary.
 *
 * Signed inputs preserve their sign, so a ledger debit can be valued as a
 * negative movement without losing accounting direction.
 *
 * @throws RangeError on non-integer, non-finite, or unsafe quantities.
 */
export function creditsToUsdMicros(credits: number): bigint {
  assertIntegerCredits(credits)
  const numerator = BigInt(credits) * MICROS_PER_USD_BIG
  return divRound(numerator, CREDITS_PER_USD_BIG)
}

/**
 * Standard USD-equivalent value of a credit quantity.
 *
 * `standardCreditValueUsd = credits / 3750`
 *
 * Exact at micro-USD resolution; the returned float is therefore accurate to
 * within half a micro-dollar. Round to cents only at a display boundary.
 */
export function creditsToUsd(credits: number): number {
  return Number(creditsToUsdMicros(credits)) / MICROS_PER_USD
}

/** Convert already-computed micro-USD back to a USD float. */
export function usdMicrosToUsd(micros: bigint): number {
  return Number(micros) / MICROS_PER_USD
}

/**
 * Value a set of credit quantities by AGGREGATING THE QUANTITIES FIRST and
 * converting once. This is the required pattern for ledger/usage reports:
 * per-row rounding then summing would drift on large result sets.
 */
export function sumCreditsToUsd(creditQuantities: readonly number[]): number {
  let total = 0
  for (const quantity of creditQuantities) {
    assertIntegerCredits(quantity)
    total += quantity
  }
  return creditsToUsd(total)
}

/**
 * Standard USD-equivalent value of CONSUMED credits, returned as a positive
 * amount (consumption reports describe a magnitude, not a ledger movement).
 */
export function consumedCreditsValueUsd(credits: number): number {
  return creditsToUsd(Math.abs(credits))
}

/**
 * Standard USD-equivalent value of a ledger movement, preserving its
 * accounting direction: credits are positive, debits are negative.
 */
export function ledgerMovementValueUsd(amount: number, direction: "credit" | "debit"): number {
  const magnitude = Math.abs(amount)
  return creditsToUsd(direction === "debit" ? -magnitude : magnitude)
}

/**
 * Standard USD-equivalent value rounded to WHOLE CENTS — for reporting and
 * display boundaries only. Never use this while accumulating a total.
 */
export function creditsToUsdCents(credits: number): number {
  const micros = creditsToUsdMicros(credits)
  const negative = micros < 0n
  const abs = negative ? -micros : micros
  // 1 cent = 10,000 micro-USD (1 USD = 100 cents = 1,000,000 micro-USD).
  const cents = divRound(abs, 10_000n)
  return negative ? -Number(cents) : Number(cents)
}
