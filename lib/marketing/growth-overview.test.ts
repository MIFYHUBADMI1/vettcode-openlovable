import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const mocks = vi.hoisted(() => ({
  summarizeProjectUsage: vi.fn(),
  clampRange: (from?: number, to?: number) => ({ from: from ?? 0, to: to ?? 0 }),
  countRuntimeDocs: vi.fn(),
  ensureRuntimeIndexes: vi.fn(async () => {}),
  ledgerAggregateRows: { value: [] as unknown[] },
  ledgerAggregate: vi.fn(),
  countReferrals: vi.fn(),
}))

vi.mock("@/lib/runtime/control/analytics", () => ({
  summarizeProjectUsage: mocks.summarizeProjectUsage,
  clampRange: mocks.clampRange,
}))

vi.mock("@/lib/db/runtime-collections", () => ({
  ensureRuntimeIndexes: mocks.ensureRuntimeIndexes,
  runtimeUsageCol: async () => ({ countDocuments: mocks.countRuntimeDocs }),
}))

vi.mock("@/lib/db/collections", () => ({
  creditLedgerCol: async () => ({
    aggregate: (pipeline: unknown[]) => {
      mocks.ledgerAggregate(pipeline)
      return { toArray: async () => mocks.ledgerAggregateRows.value }
    },
  }),
  referralsCol: async () => ({ countDocuments: mocks.countReferrals }),
}))

import {
  deriveNextSteps,
  getGrowthOverview,
  readAiPlanDocuments,
  readPlanKnowledge,
  readSiteAvailability,
  type GrowthOverviewInput,
} from "./growth-overview"

/**
 * Growth Overview service tests (Phase 2, spec sections 5–8). The heart of
 * this phase is the metric-trust model: a measured zero, a failed read, and
 * an uninstrumented capability must never collapse into one another, and no
 * fabricated growth number may ever appear.
 */

function projectFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "proj_1",
    name: "Test Project",
    state: "created",
    deployment: { status: "idle", updatedAt: 0 },
    deploymentHistory: [],
    ...overrides,
  } as never
}

const user: GrowthOverviewInput["user"] = { id: "user_1" }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.summarizeProjectUsage.mockResolvedValue({
    from: 1, to: 2, requests: 5, succeeded: 5, failed: 0, creditsCharged: 0, providerCostUsd: null, providerCostUnavailableCount: 0,
  })
  mocks.countRuntimeDocs.mockResolvedValue(0)
  mocks.ledgerAggregateRows.value = []
  mocks.countReferrals.mockResolvedValue(0)
})

describe("metric availability states", () => {
  it("returns available for non-zero real measurements", async () => {
    mocks.countRuntimeDocs.mockResolvedValue(3)
    mocks.ledgerAggregateRows.value = [{ debits: 12, reversals: 2, entries: 5 }]
    mocks.countReferrals.mockResolvedValue(4)

    const overview = await getGrowthOverview({ user, project: projectFixture() })
    expect(overview.metrics.runtimeRequests.state).toBe("available")
    expect(overview.metrics.runtimeRequests.value).toBe(5)
    expect(overview.metrics.checkoutCalls.value).toBe(3)
    // debits minus reversals — refunds reduce consumption honestly.
    expect(overview.metrics.creditsConsumedByProject.value).toBe(10)
    expect(overview.metrics.ownerAccountReferrals.value).toBe(4)
  })

  it("marks a genuine zero as measured_zero, never unavailable", async () => {
    mocks.summarizeProjectUsage.mockResolvedValue({
      from: 1, to: 2, requests: 0, succeeded: 0, failed: 0, creditsCharged: 0, providerCostUsd: null, providerCostUnavailableCount: 0,
    })
    const overview = await getGrowthOverview({ user, project: projectFixture() })
    expect(overview.metrics.runtimeRequests.state).toBe("measured_zero")
    expect(overview.metrics.runtimeRequests.value).toBe(0)
    expect(overview.metrics.siteVisitors.state).toBe("not_instrumented")
  })

  it("marks failed reads as unavailable with a null value — never 0", async () => {
    mocks.summarizeProjectUsage.mockRejectedValue(new Error("mongo down"))
    mocks.ledgerAggregate.mockImplementation(() => { throw new Error("boom") })
    mocks.countReferrals.mockRejectedValue(new Error("boom"))

    const overview = await getGrowthOverview({ user, project: projectFixture() })
    expect(overview.metrics.runtimeRequests.state).toBe("unavailable")
    expect(overview.metrics.runtimeRequests.value).toBeNull()
    expect(overview.metrics.creditsConsumedByProject.state).toBe("unavailable")
    expect(overview.metrics.ownerAccountReferrals.state).toBe("unavailable")
    // A failed read must never masquerade as a measured zero.
    expect(overview.metrics.runtimeRequests.state).not.toBe("measured_zero")
  })

  it("never fabricates visitors, completed payments, revenue, conversion, or project referrals", async () => {
    const overview = await getGrowthOverview({ user, project: projectFixture() })
    for (const key of ["siteVisitors", "completedPayments", "appRevenue", "conversionRate", "projectLevelReferrals"] as const) {
      expect(overview.metrics[key].state).toBe("not_instrumented")
      expect(overview.metrics[key].value).toBeNull()
      expect(overview.metrics[key].reason).toBeTruthy()
    }
  })

  it("carries explicit caveats so checkout calls are never payments and requests are never visitors", async () => {
    const overview = await getGrowthOverview({ user, project: projectFixture() })
    expect(overview.metrics.checkoutCalls.caveat.toLowerCase()).toContain("payments completed")
    expect(overview.metrics.runtimeRequests.caveat.toLowerCase()).toContain("not website visitors")
    expect(overview.metrics.creditsConsumedByProject.caveat.toLowerCase()).toContain("not revenue")
    expect(overview.metrics.ownerAccountReferrals.caveat.toLowerCase()).toContain("attributed to this specific project")
    expect(overview.trustNotes.join(" ")).toContain("they are not revenue")
  })

  it("queries the ledger with the owner from the session, never a client id", async () => {
    await getGrowthOverview({ user, project: projectFixture() })
    expect(mocks.ledgerAggregate).toHaveBeenCalledWith([
      expect.objectContaining({ $match: expect.objectContaining({ userId: "user_1", referenceType: "project", referenceId: "proj_1" }) }),
      expect.anything(),
    ])
  })
})

describe("site availability", () => {
  it("maps deployment records to honest deployment-only states", () => {
    expect(readSiteAvailability(projectFixture() as never).state).toBe("never_deployed")
    expect(readSiteAvailability(projectFixture({ deployment: { status: "deploying", updatedAt: 5 } }) as never).state).toBe("deploy_in_progress")
    expect(readSiteAvailability(projectFixture({ deployment: { status: "failed", updatedAt: 5, error: "boom" } }) as never).error).toBe("boom")
    const live = readSiteAvailability(projectFixture({ deployment: { status: "success", updatedAt: 9, productionUrl: "https://x.example" } }) as never)
    expect(live.state).toBe("live")
    expect(live.url).toBe("https://x.example")
    expect(live.caveat.toLowerCase()).toContain("does not imply visitors")
  })
})

describe("what Atai knows", () => {
  it("labels AI plan documents as generated planning context that was never executed", () => {
    const docs = readAiPlanDocuments(projectFixture({
      specification: { growthPlan: "Real growth plan text.", seoPlan: "not defined yet: pending" },
    }) as never)
    const growth = docs.find((d) => d.id === "growthPlan")!
    const seo = docs.find((d) => d.id === "seoPlan")!
    expect(growth.present).toBe(true)
    expect(growth.origin).toBe("ai_generated_planning_context")
    expect(growth.executed).toBe(false)
    // Placeholder text must not count as a drafted plan.
    expect(seo.present).toBe(false)
    expect(seo.characterCount).toBe(0)
  })

  it("reports no plan when the project has no specification", () => {
    const plan = readPlanKnowledge(projectFixture() as never)
    expect(plan.hasSpecification).toBe(false)
    expect(plan.health).toBeNull()
  })
})

describe("deterministic next-step derivation", () => {
  const base = {
    project: projectFixture({ id: "p1" }) as never,
    plan: { hasSpecification: false, health: null, targetUsers: [] },
    aiPlanDocuments: [],
    runtimeRequests: { state: "measured_zero", value: 0, definition: "", caveat: "" } as never,
  }

  it("suggests creating a plan when none exists", () => {
    const steps = deriveNextSteps({ ...base, site: readSiteAvailability(base.project) })
    expect(steps[0].kind).toBe("create_plan")
    expect(steps.every((s) => s.executed === false)).toBe(true)
    expect(steps[0].navigation).toEqual({ target: "collaborate", projectId: "p1" })
  })

  it("suggests fixing a failed deployment and never claims success", () => {
    const steps = deriveNextSteps({
      ...base,
      plan: { hasSpecification: true, health: { percent: 100, completeSections: 30, totalSections: 30, missing: [], needsWork: [] }, targetUsers: [] },
      site: { state: "deploy_failed", caveat: "" },
    })
    expect(steps.map((s) => s.kind)).toContain("fix_deployment")
  })

  it("suggests bringing first users when live with genuinely-zero requests — not fake marketing", () => {
    const steps = deriveNextSteps({
      ...base,
      plan: { hasSpecification: true, health: { percent: 100, completeSections: 30, totalSections: 30, missing: [], needsWork: [] }, targetUsers: [] },
      site: { state: "live", url: "https://x", caveat: "" },
    })
    expect(steps.map((s) => s.kind)).toContain("first_users")
  })

  it("caps suggestions at five and derives them from missing plan sections", () => {
    const missing = Array.from({ length: 8 }, (_, i) => ({ id: `s${i}` as never, label: `Section ${i}` }))
    const steps = deriveNextSteps({
      ...base,
      plan: { hasSpecification: true, health: { percent: 20, completeSections: 6, totalSections: 30, missing, needsWork: [] }, targetUsers: [] },
      aiPlanDocuments: [{ id: "growthPlan", label: "Growth plan", present: true, characterCount: 100, origin: "ai_generated_planning_context", executed: false }],
      site: { state: "never_deployed", caveat: "" },
    })
    expect(steps.length).toBeLessThanOrEqual(5)
    expect(steps.some((s) => s.kind === "complete_plan_section")).toBe(true)
    expect(steps.some((s) => s.kind === "review_ai_plan")).toBe(true)
  })
})
