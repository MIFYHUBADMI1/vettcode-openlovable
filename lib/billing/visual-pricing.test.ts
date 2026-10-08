import { describe, it, expect } from "vitest"
import {
  computeVisualCredits,
  VISUAL_MARKUP,
  VISUAL_CREDITS_PER_USD,
  VISUAL_FALLBACK_CREDITS,
  VISUAL_DEFAULT_MODEL_CREDITS,
} from "./visual-pricing"

describe("computeVisualCredits", () => {
  it("charges the flat 100 credits on the default model even when a cost is reported", () => {
    const result = computeVisualCredits({
      fixedCreditCost: VISUAL_DEFAULT_MODEL_CREDITS,
      providerCost: 0.42,
    })
    expect(result.credits).toBe(100)
    expect(result.finalCost).toBeUndefined()
    expect(result.providerCost).toBe(0.42)
  })

  it("charges the flat 100 credits on the default model when no cost is reported", () => {
    const result = computeVisualCredits({
      fixedCreditCost: VISUAL_DEFAULT_MODEL_CREDITS,
      providerCost: null,
    })
    expect(result.credits).toBe(100)
    expect(result.providerCost).toBeUndefined()
  })

  it("applies the 45% margin and converts at $1 = 4000 credits for premium models", () => {
    const result = computeVisualCredits({ providerCost: 0.05 })
    // 0.05 × 1.45 = 0.0725 → 0.0725 × 4000 = 290
    expect(result.providerCost).toBe(0.05)
    expect(result.finalCost).toBeCloseTo(0.0725, 10)
    expect(result.credits).toBe(290)
  })

  it("rounds fractional credits up and never charges less than 1 credit", () => {
    expect(computeVisualCredits({ providerCost: 0.0001 }).credits).toBe(1)
    // 0.1 × 1.45 × 4000 = 580 exactly
    expect(computeVisualCredits({ providerCost: 0.1 }).credits).toBe(580)
    // 0.15 × 1.45 × 4000 = 870 exactly
    expect(computeVisualCredits({ providerCost: 0.15 }).credits).toBe(870)
    // 0.01 × 1.45 × 4000 = 58
    expect(computeVisualCredits({ providerCost: 0.01 }).credits).toBe(58)
  })

  it("charges the 1600-credit fallback when a premium model reports no cost", () => {
    expect(computeVisualCredits({ providerCost: null }).credits).toBe(VISUAL_FALLBACK_CREDITS)
    expect(computeVisualCredits({ providerCost: undefined }).credits).toBe(1600)
    expect(computeVisualCredits({ providerCost: 0 }).credits).toBe(1600)
    expect(computeVisualCredits({}).credits).toBe(1600)
  })

  it("keeps the pricing constants at their specified values", () => {
    expect(VISUAL_MARKUP).toBe(1.45)
    expect(VISUAL_CREDITS_PER_USD).toBe(4000)
    expect(VISUAL_FALLBACK_CREDITS).toBe(1600)
    expect(VISUAL_DEFAULT_MODEL_CREDITS).toBe(100)
  })
})
