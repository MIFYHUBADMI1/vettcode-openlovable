/**
 * Atai Infrastructure Cost Configuration.
 *
 * This is the single authoritative source for infrastructure cost calculations.
 * Totalum credit pricing is internal and changes infrequently.
 *
 * IMPORTANT: This represents the internal accounting value used for
 * estimated cost/profit calculations. The actual Totalum billing may differ
 * depending on Atai's Totalum subscription tier.
 *
 * ── Not a Finance valuation, not a payment currency ──────────────────────
 * UGX here is only an INTERNAL COST-ACCOUNTING UNIT for Totalum (the
 * infrastructure provider). It is not a payment currency — no active payment
 * path uses UGX (Dodo Payments is the only gateway) — and it is NOT ATAI's
 * credit valuation.
 *
 * ATAI's universal standard valuation (3,750 credits = US$1.00) lives in
 * `lib/billing/credit-valuation.ts`. Any Finance/reporting calculation must
 * use that module. These helpers are NOT to be used for Finance reporting:
 * they express provider cost and gross margin in credit units, which is not
 * a defensible revenue/cost/profit definition (see the Phase 1 audit notes).
 */

/**
 * Estimated cost per Totalum infrastructure credit in UGX.
 * This is the internal accounting value — 1 Atai Credit = 1 UGX.
 *
 * Update this value when Totalum pricing changes.
 * This should be verified against actual Totalum invoices periodically.
 */
export const TOTALUM_CREDIT_COST_UGX = 500

/**
 * Get the estimated infrastructure cost for a given Totalum credit usage.
 * Returns the cost in Atai Credits (= UGX).
 */
export function estimateInfraCost(totalumCreditsUsed: number): number {
  return totalumCreditsUsed * TOTALUM_CREDIT_COST_UGX
}

/**
 * Calculate gross profit from revenue and estimated infrastructure cost.
 */
export function calculateGrossProfit(revenueCredits: number, estimatedCostCredits: number) {
  const grossProfit = revenueCredits - estimatedCostCredits
  const grossMargin = revenueCredits > 0 ? (grossProfit / revenueCredits) * 100 : 0
  return { grossProfit, grossMargin }
}
