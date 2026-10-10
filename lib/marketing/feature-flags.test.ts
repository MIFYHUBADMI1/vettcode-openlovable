import { afterEach, describe, expect, it, vi } from "vitest"

// The repo runs Vitest outside the Next server bundle — mock the server-only
// guard the same way other suites do.
vi.mock("server-only", () => ({}))

import { isGrowthOverviewEnabledForUser } from "./feature-flags"

/**
 * Growth Overview feature flag (spec section A1): plain env flags following the
 * existing USE_ENHANCED_PIPELINE convention — kill switch, hard-on, and a
 * deterministic percent rollout keyed on a hash of the user id.
 */

const ORIGINAL = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL }
})

describe("growth overview flag", () => {
  it("honors the kill switch for everyone", () => {
    process.env.GROWTH_OVERVIEW_ENABLED = "false"
    process.env.GROWTH_OVERVIEW_ROLLOUT_PERCENT = "100"
    expect(isGrowthOverviewEnabledForUser("user_a")).toBe(false)
    expect(isGrowthOverviewEnabledForUser("user_b")).toBe(false)
  })

  it("honors the hard-on override", () => {
    process.env.GROWTH_OVERVIEW_ENABLED = "true"
    process.env.GROWTH_OVERVIEW_ROLLOUT_PERCENT = "0"
    expect(isGrowthOverviewEnabledForUser("user_a")).toBe(true)
  })

  it("is enabled by default (full rollout) when no env vars are set", () => {
    delete process.env.GROWTH_OVERVIEW_ENABLED
    delete process.env.GROWTH_OVERVIEW_ROLLOUT_PERCENT
    expect(isGrowthOverviewEnabledForUser("user_a")).toBe(true)
  })

  it("splits cohorts deterministically at a partial rollout", () => {
    delete process.env.GROWTH_OVERVIEW_ENABLED
    process.env.GROWTH_OVERVIEW_ROLLOUT_PERCENT = "50"
    // Same user → same answer, always.
    const first = isGrowthOverviewEnabledForUser("user_x")
    for (let i = 0; i < 10; i++) {
      expect(isGrowthOverviewEnabledForUser("user_x")).toBe(first)
    }
    // Percent 0 and 100 are exact boundaries.
    process.env.GROWTH_OVERVIEW_ROLLOUT_PERCENT = "0"
    expect(isGrowthOverviewEnabledForUser("user_x")).toBe(false)
    process.env.GROWTH_OVERVIEW_ROLLOUT_PERCENT = "100"
    expect(isGrowthOverviewEnabledForUser("user_x")).toBe(true)
  })

  it("treats a garbage percent as fully off (fail-safe)", () => {
    delete process.env.GROWTH_OVERVIEW_ENABLED
    process.env.GROWTH_OVERVIEW_ROLLOUT_PERCENT = "banana"
    expect(isGrowthOverviewEnabledForUser("user_x")).toBe(false)
  })
})
