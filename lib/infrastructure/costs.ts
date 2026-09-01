/**
 * MirrorSite Infrastructure Cost Configuration.
 *
 * This is the single authoritative source for infrastructure cost calculations.
 * Totalum credit pricing is internal and changes infrequently.
 *
 * IMPORTANT: This represents the internal accounting value used for
 * estimated cost/profit calculations. The actual Totalum billing may differ
 * depending on MirrorSite's Totalum subscription tier.
 */

/**
 * Estimated cost per Totalum infrastructure credit in UGX.
 * This is the internal accounting value — 1 MirrorSite credit = 1 UGX.
 *
 * Update this value when Totalum pricing changes.
 * This should be verified against actual Totalum invoices periodically.
 */
export const TOTALUM_CREDIT_COST_UGX = 500

/**
 * Get the estimated infrastructure cost for a given Totalum credit usage.
 * Returns the cost in MirrorSite credits (= UGX).
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
