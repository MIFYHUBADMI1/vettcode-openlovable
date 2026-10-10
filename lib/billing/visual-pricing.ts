/**
 * Expected Visuals — credit pricing rules.
 *
 * Shared by the generate-visual API route (server) and the collaborate UI
 * (client) so the estimate shown before generating and the amount actually
 * charged can never drift apart.
 *
 * Pricing model (spec):
 * - Default model (`inclusionai/ming-image-0.1-design-layer`): a flat
 *   100 credits per generated image, regardless of provider cost.
 * - Premium models WITH a provider cost reported by OpenRouter:
 *   cost × 1.45 (45% profit margin) is converted to credits at
 *   $1 = 4000 credits.
 * - Premium models WITHOUT a reported cost: a flat 1600 credits per image.
 * - VISUAL_ESTIMATED_CREDITS (1000) is only the upfront estimate shown in
 *   the UI before generating — it is never the amount charged.
 *
 * ── Operational charging rule, NOT the Finance valuation ──────────────
 *
 * `VISUAL_CREDITS_PER_USD` is a VISUAL-GENERATION CHARGING RULE: it is the
 * rate at which marked-up provider cost is converted into the credits to
 * charge for one premium image. It exists so existing visual charges do not
 * change.
 *
 * It is NOT ATAI's credit valuation. ATAI's universal standard valuation is
 * 3,750 credits = US$1.00 and lives in `lib/billing/credit-valuation.ts`
 * (`ATAI_CREDITS_PER_USD`). Every Finance/reporting calculation must use that
 * module — never this constant, and never a second copy of either ratio.
 */

/** 45% profit margin applied on top of the provider-reported cost. */
export const VISUAL_MARKUP = 1.45

/**
 * Visual CHARGING rate: $1 of (marked-up) provider cost = 4000 credits.
 *
 * Scoped to premium image generation only. This must never be used as, or
 * confused with, ATAI's universal Finance valuation
 * (`ATAI_CREDITS_PER_USD` in lib/billing/credit-valuation.ts = 3750).
 */
export const VISUAL_CREDITS_PER_USD = 4000

/** Charge when a premium model returns an image but reports no cost. */
export const VISUAL_FALLBACK_CREDITS = 1600

/** Upfront estimate shown in the collaboration UI before generating. */
export const VISUAL_ESTIMATED_CREDITS = 1000

/** Flat cost per image on the default (basic tier) model. */
export const VISUAL_DEFAULT_MODEL_CREDITS = 100

export interface VisualPricingResult {
  /** Credits to charge the user for this generation. */
  credits: number
  /** Provider-reported cost in USD (echoed back when available). */
  providerCost?: number
  /** Provider cost after the 45% margin (only for dynamic pricing). */
  finalCost?: number
}

/**
 * Decide how many credits an image generation costs.
 *
 * @param fixedCreditCost - Set for flat-priced (basic tier) models; wins over
 *   any provider cost because those models charge a fixed amount.
 * @param providerCost - Cost in USD reported by OpenRouter with the image,
 *   or null/undefined/0 when the endpoint did not report one.
 */
export function computeVisualCredits(params: {
  fixedCreditCost?: number | null
  providerCost?: number | null
}): VisualPricingResult {
  const { fixedCreditCost, providerCost } = params

  // Flat-priced models (the default design model) always cost the same.
  if (fixedCreditCost != null && fixedCreditCost > 0) {
    return {
      credits: fixedCreditCost,
      ...(providerCost != null && providerCost > 0 ? { providerCost } : {}),
    }
  }

  // Dynamic pricing: cost + 45% margin, converted at $1 = 4000 credits.
  if (providerCost != null && providerCost > 0) {
    const finalCost = providerCost * VISUAL_MARKUP
    const credits = Math.max(1, Math.ceil(finalCost * VISUAL_CREDITS_PER_USD))
    return { credits, providerCost, finalCost }
  }

  // Premium model that generated an image without reporting a cost.
  return { credits: VISUAL_FALLBACK_CREDITS }
}
