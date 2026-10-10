import { afterEach, describe, expect, it, vi } from "vitest"

// The repo runs Vitest outside the Next server bundle — mock the server-only
// guard the same way other suites do.
vi.mock("server-only", () => ({}))

import { isGrowthOverviewEnabledForUser, isSeoAuditEnabledForUser, isStudioEnabledForUser, isGrowthTasksEnabledForUser, isCampaignsEnabledForUser } from "./feature-flags"

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

/**
 * SEO audit flag (Phase 3 — W2): identical mechanism, but DEFAULT-OFF — a
 * credit-charging, crawl-based capability is unreachable until an operator
 * opts in (hard-on, or a rollout cohort).
 */
describe("seo audit flag", () => {
  it("is OFF by default when no env vars are set", () => {
    delete process.env.SEO_AUDIT_ENABLED
    delete process.env.SEO_AUDIT_ROLLOUT_PERCENT
    expect(isSeoAuditEnabledForUser("user_a")).toBe(false)
  })

  it("honors the hard-on override", () => {
    process.env.SEO_AUDIT_ENABLED = "true"
    delete process.env.SEO_AUDIT_ROLLOUT_PERCENT
    expect(isSeoAuditEnabledForUser("user_a")).toBe(true)
  })

  it("honors the kill switch even with a full rollout percent", () => {
    process.env.SEO_AUDIT_ENABLED = "false"
    process.env.SEO_AUDIT_ROLLOUT_PERCENT = "100"
    expect(isSeoAuditEnabledForUser("user_a")).toBe(false)
    expect(isSeoAuditEnabledForUser("user_b")).toBe(false)
  })

  it("splits cohorts deterministically at a partial rollout", () => {
    delete process.env.SEO_AUDIT_ENABLED
    process.env.SEO_AUDIT_ROLLOUT_PERCENT = "50"
    const first = isSeoAuditEnabledForUser("user_x")
    for (let i = 0; i < 10; i++) {
      expect(isSeoAuditEnabledForUser("user_x")).toBe(first)
    }
    process.env.SEO_AUDIT_ROLLOUT_PERCENT = "0"
    expect(isSeoAuditEnabledForUser("user_x")).toBe(false)
    process.env.SEO_AUDIT_ROLLOUT_PERCENT = "100"
    expect(isSeoAuditEnabledForUser("user_x")).toBe(true)
  })

  it("treats a garbage percent as fully off (fail-safe)", () => {
    delete process.env.SEO_AUDIT_ENABLED
    process.env.SEO_AUDIT_ROLLOUT_PERCENT = "banana"
    expect(isSeoAuditEnabledForUser("user_x")).toBe(false)
  })
})

/**
 * Marketing Studio flag (Phase 4 — W3): identical default-OFF mechanism as the
 * SEO flag — a credit-charging, AI-generating capability is unreachable until an
 * operator opts in.
 */
describe("marketing studio flag", () => {
  it("is OFF by default when no env vars are set", () => {
    delete process.env.STUDIO_ENABLED
    delete process.env.STUDIO_ROLLOUT_PERCENT
    expect(isStudioEnabledForUser("user_a")).toBe(false)
  })

  it("honors the hard-on override", () => {
    process.env.STUDIO_ENABLED = "true"
    delete process.env.STUDIO_ROLLOUT_PERCENT
    expect(isStudioEnabledForUser("user_a")).toBe(true)
  })

  it("honors the kill switch even with a full rollout percent", () => {
    process.env.STUDIO_ENABLED = "false"
    process.env.STUDIO_ROLLOUT_PERCENT = "100"
    expect(isStudioEnabledForUser("user_a")).toBe(false)
    expect(isStudioEnabledForUser("user_b")).toBe(false)
  })

  it("splits cohorts deterministically at a partial rollout", () => {
    delete process.env.STUDIO_ENABLED
    process.env.STUDIO_ROLLOUT_PERCENT = "50"
    const first = isStudioEnabledForUser("user_x")
    for (let i = 0; i < 10; i++) {
      expect(isStudioEnabledForUser("user_x")).toBe(first)
    }
    process.env.STUDIO_ROLLOUT_PERCENT = "0"
    expect(isStudioEnabledForUser("user_x")).toBe(false)
    process.env.STUDIO_ROLLOUT_PERCENT = "100"
    expect(isStudioEnabledForUser("user_x")).toBe(true)
  })

  it("treats a garbage percent as fully off (fail-safe)", () => {
    delete process.env.STUDIO_ENABLED
    process.env.STUDIO_ROLLOUT_PERCENT = "banana"
    expect(isStudioEnabledForUser("user_x")).toBe(false)
  })
})

/**
 * Growth tasks flag (Phase 5 — W4): identical default-OFF mechanism. Unlike
 * Studio/SEO this capability is FREE (no credits), but the operator-opt-in
 * posture is the same — an AI-proposed, founder-approvable write surface stays
 * unreachable until explicitly enabled.
 */
describe("growth tasks flag", () => {
  it("is OFF by default when no env vars are set", () => {
    delete process.env.GROWTH_TASKS_ENABLED
    delete process.env.GROWTH_TASKS_ROLLOUT_PERCENT
    expect(isGrowthTasksEnabledForUser("user_a")).toBe(false)
  })

  it("honors the hard-on override", () => {
    process.env.GROWTH_TASKS_ENABLED = "true"
    delete process.env.GROWTH_TASKS_ROLLOUT_PERCENT
    expect(isGrowthTasksEnabledForUser("user_a")).toBe(true)
  })

  it("honors the kill switch even with a full rollout percent", () => {
    process.env.GROWTH_TASKS_ENABLED = "false"
    process.env.GROWTH_TASKS_ROLLOUT_PERCENT = "100"
    expect(isGrowthTasksEnabledForUser("user_a")).toBe(false)
    expect(isGrowthTasksEnabledForUser("user_b")).toBe(false)
  })

  it("splits cohorts deterministically at a partial rollout", () => {
    delete process.env.GROWTH_TASKS_ENABLED
    process.env.GROWTH_TASKS_ROLLOUT_PERCENT = "50"
    const first = isGrowthTasksEnabledForUser("user_x")
    for (let i = 0; i < 10; i++) {
      expect(isGrowthTasksEnabledForUser("user_x")).toBe(first)
    }
    process.env.GROWTH_TASKS_ROLLOUT_PERCENT = "0"
    expect(isGrowthTasksEnabledForUser("user_x")).toBe(false)
    process.env.GROWTH_TASKS_ROLLOUT_PERCENT = "100"
    expect(isGrowthTasksEnabledForUser("user_x")).toBe(true)
  })

  it("treats a garbage percent as fully off (fail-safe)", () => {
    delete process.env.GROWTH_TASKS_ENABLED
    process.env.GROWTH_TASKS_ROLLOUT_PERCENT = "banana"
    expect(isGrowthTasksEnabledForUser("user_x")).toBe(false)
  })
})

/**
 * Campaigns flag (Phase 6 — W5): identical default-OFF mechanism. Campaigns are
 * FREE and PLAN-ONLY (no credits, no execution, no spend, no scheduler), but the
 * operator-opt-in posture is the same — an AI-proposed, founder-approvable write
 * surface stays unreachable until explicitly enabled.
 */
describe("campaigns flag", () => {
  it("is OFF by default when no env vars are set", () => {
    delete process.env.CAMPAIGNS_ENABLED
    delete process.env.CAMPAIGNS_ROLLOUT_PERCENT
    expect(isCampaignsEnabledForUser("user_a")).toBe(false)
  })

  it("honors the hard-on override", () => {
    process.env.CAMPAIGNS_ENABLED = "true"
    delete process.env.CAMPAIGNS_ROLLOUT_PERCENT
    expect(isCampaignsEnabledForUser("user_a")).toBe(true)
  })

  it("honors the kill switch even with a full rollout percent", () => {
    process.env.CAMPAIGNS_ENABLED = "false"
    process.env.CAMPAIGNS_ROLLOUT_PERCENT = "100"
    expect(isCampaignsEnabledForUser("user_a")).toBe(false)
    expect(isCampaignsEnabledForUser("user_b")).toBe(false)
  })

  it("splits cohorts deterministically at a partial rollout", () => {
    delete process.env.CAMPAIGNS_ENABLED
    process.env.CAMPAIGNS_ROLLOUT_PERCENT = "50"
    const first = isCampaignsEnabledForUser("user_x")
    for (let i = 0; i < 10; i++) {
      expect(isCampaignsEnabledForUser("user_x")).toBe(first)
    }
    process.env.CAMPAIGNS_ROLLOUT_PERCENT = "0"
    expect(isCampaignsEnabledForUser("user_x")).toBe(false)
    process.env.CAMPAIGNS_ROLLOUT_PERCENT = "100"
    expect(isCampaignsEnabledForUser("user_x")).toBe(true)
  })

  it("treats a garbage percent as fully off (fail-safe)", () => {
    delete process.env.CAMPAIGNS_ENABLED
    process.env.CAMPAIGNS_ROLLOUT_PERCENT = "banana"
    expect(isCampaignsEnabledForUser("user_x")).toBe(false)
  })
})
