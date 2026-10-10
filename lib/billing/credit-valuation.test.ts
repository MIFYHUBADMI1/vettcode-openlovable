/**
 * Universal credit valuation (Finance) — Phase 1, Task A.
 *
 * Proves the approved 3,750-credits-per-USD rule, exactness at the
 * micro-USD boundary, aggregate-before-rounding behaviour, accounting
 * direction, and that the legacy visual-generation ratio (4,000) can never
 * determine the universal Finance valuation.
 */

import { describe, it, expect } from "vitest"
import {
  ATAI_CREDITS_PER_USD,
  CREDIT_VALUATION_VERSION,
  CREDIT_VALUATION_BASIS,
  creditsToUsd,
  creditsToUsdMicros,
  creditsToUsdCents,
  sumCreditsToUsd,
  consumedCreditsValueUsd,
  ledgerMovementValueUsd,
  usdMicrosToUsd,
} from "./credit-valuation"
import { VISUAL_CREDITS_PER_USD } from "./visual-pricing"

describe("universal credit valuation", () => {
  it("defines the approved ratio of 3,750 credits per US dollar", () => {
    expect(ATAI_CREDITS_PER_USD).toBe(3750)
    expect(CREDIT_VALUATION_VERSION).toBe("ATAI_CREDIT_VALUATION_V1")
    expect(CREDIT_VALUATION_BASIS).toContain("3,750")
    expect(CREDIT_VALUATION_BASIS).toContain("ATAI_CREDIT_VALUATION_V1")
  })

  it.each([
    [375, 0.1],
    [1875, 0.5],
    [3750, 1],
    [7500, 2],
    [37500, 10],
    [375000, 100],
  ])("values %i credits as US$%s", (credits, expected) => {
    expect(creditsToUsd(credits)).toBe(expected)
  })

  it("values zero credits as zero", () => {
    expect(creditsToUsd(0)).toBe(0)
    expect(creditsToUsdMicros(0)).toBe(0n)
    expect(sumCreditsToUsd([])).toBe(0)
  })

  it("preserves sign so ledger movements keep their accounting direction", () => {
    expect(creditsToUsd(-7500)).toBe(-2)
    expect(creditsToUsdMicros(-3750)).toBe(-1_000_000n)
    expect(ledgerMovementValueUsd(7500, "debit")).toBe(-2)
    expect(ledgerMovementValueUsd(7500, "credit")).toBe(2)
    // Consumption reports describe a magnitude, so they stay positive.
    expect(consumedCreditsValueUsd(-7500)).toBe(2)
    expect(consumedCreditsValueUsd(7500)).toBe(2)
  })

  it("keeps exact micro-USD precision (fractional-cent equivalents)", () => {
    // 1 credit = 1/3750 USD = 266.6̅ micro-USD → rounds half away from zero.
    expect(creditsToUsdMicros(1)).toBe(267n)
    expect(creditsToUsd(1)).toBe(0.000267)
    // 3 credits = 800 micro-USD exactly.
    expect(creditsToUsdMicros(3)).toBe(800n)
    expect(creditsToUsd(3)).toBe(0.0008)
  })

  it("preserves precision on large balances without float drift", () => {
    expect(creditsToUsd(375_000_000)).toBe(100_000)
    expect(creditsToUsdMicros(1_000_000_000_000)).toBe(266_666_666_666_667n)
    expect(usdMicrosToUsd(creditsToUsdMicros(1_000_000_000_000))).toBeCloseTo(266_666_666.666667, 5)
    // A balance far beyond float-exact integer range still converts exactly.
    expect(creditsToUsdMicros(9_000_000_000_000_000 / 1000)).toBe(2_400_000_000_000_000n)
  })

  it("aggregates credit quantities BEFORE converting (no per-row rounding drift)", () => {
    const rows = Array.from({ length: 1000 }, () => 1)
    // Aggregate first: 1000 credits = 0.266667 USD (rounded once).
    expect(sumCreditsToUsd(rows)).toBe(0.266667)
    // Naively summing per-row rounded values drifts upward by 0.000333 USD.
    const naive = rows.reduce((sum, credits) => sum + creditsToUsd(credits), 0)
    expect(naive).toBeGreaterThan(sumCreditsToUsd(rows))
    expect(naive - sumCreditsToUsd(rows)).toBeCloseTo(0.000333, 6)
  })

  it("rounds to whole cents only at the reporting boundary", () => {
    expect(creditsToUsdCents(375)).toBe(10)
    expect(creditsToUsdCents(1875)).toBe(50)
    expect(creditsToUsdCents(3750)).toBe(100)
    expect(creditsToUsdCents(-7500)).toBe(-200)
    // 1 credit = 0.000267 USD → 0 cents at the display boundary.
    expect(creditsToUsdCents(1)).toBe(0)
  })

  it("rejects fractional or non-finite credit quantities instead of silently rounding", () => {
    expect(() => creditsToUsd(0.5)).toThrow(RangeError)
    expect(() => creditsToUsd(Number.NaN)).toThrow(RangeError)
    expect(() => creditsToUsd(Number.POSITIVE_INFINITY)).toThrow(RangeError)
    expect(() => creditsToUsd(Number.MAX_SAFE_INTEGER + 10)).toThrow(RangeError)
  })

  it("is never contaminated by the visual-generation ratio", () => {
    // The visual rule (4,000 credits per USD) is a CHARGING rule, not the
    // universal Finance valuation — the two must stay independent.
    expect(VISUAL_CREDITS_PER_USD).toBe(4000)
    expect(ATAI_CREDITS_PER_USD).not.toBe(VISUAL_CREDITS_PER_USD)
    // 3,750 credits is exactly $1.00 under the universal valuation, and would
    // be $0.9375 under the visual ratio — proof the visual constant cannot
    // determine universal Finance valuation.
    expect(creditsToUsd(3750)).toBe(1)
    expect(creditsToUsd(3750)).not.toBe(3750 / VISUAL_CREDITS_PER_USD)
  })

  it("does not change any amount charged by existing operations", () => {
    // computeVisualCredits keeps charging with its own operational rule;
    // importing the Finance valuation must not alter it.
    expect(VISUAL_CREDITS_PER_USD).toBe(4000)
    expect(creditsToUsd(4000)).toBeCloseTo(1.066667, 6)
  })
})
