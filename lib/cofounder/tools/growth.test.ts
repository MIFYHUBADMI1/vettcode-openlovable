import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const mocks = vi.hoisted(() => ({
  flagEnabled: vi.fn(() => true),
  getGrowthOverview: vi.fn(),
}))

vi.mock("@/lib/marketing/feature-flags", () => ({
  isGrowthOverviewEnabledForUser: mocks.flagEnabled,
}))

vi.mock("@/lib/marketing/growth-overview", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/marketing/growth-overview")>()
  return { ...actual, getGrowthOverview: mocks.getGrowthOverview }
})

import { store } from "@/lib/store/store"
import { getGrowthOverviewTool, projectGrowthOverviewForTool } from "./growth"
import type { ToolContext } from "../types"

/**
 * get_growth_overview tool tests (Phase 2, spec section 6). The tool must be
 * read-only, tenant-isolated (projectId from the model, ownership from the
 * session), flag-aware, and must carry the availability states through to the
 * model instead of inventing numbers.
 */

const ctx: ToolContext = {
  user: { id: "user_1", name: "F", email: "f@example.com", emailVerified: true },
  credits: { available: 100, balance: 100, reserved: 0 },
}

function metric(state: string, value: number | null) {
  return { state, value, definition: "d", caveat: "c" }
}

const overviewFixture = {
  projectId: "proj_1",
  projectName: "Test Project",
  projectState: "created",
  projectStateLabel: "Created",
  generatedAt: 10,
  window: { from: 0, to: 30 * 24 * 3600 * 1000 },
  site: { state: "never_deployed", caveat: "Deployment state only." },
  whatAtaiKnows: {
    plan: { hasSpecification: true, health: { percent: 40, completeSections: 12, totalSections: 30, missing: [{ id: "pricing", label: "Pricing" }], needsWork: [] }, targetUsers: [] },
    ownerGoals: null,
    aiPlanDocuments: [{ id: "growthPlan", label: "Growth plan", present: true, characterCount: 200, origin: "ai_generated_planning_context", executed: false }],
  },
  metrics: {
    runtimeRequests: metric("measured_zero", 0),
    checkoutCalls: metric("measured_zero", 0),
    creditsConsumedByProject: metric("available", 5),
    siteVisitors: metric("not_instrumented", null),
    completedPayments: metric("not_instrumented", null),
    appRevenue: metric("not_instrumented", null),
    conversionRate: metric("not_instrumented", null),
    ownerAccountReferrals: metric("available", 2),
    projectLevelReferrals: metric("not_instrumented", null),
  },
  nextSteps: Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, kind: "deploy", title: `Step ${i}`, detail: "x".repeat(300), basis: "observed_project_state", executed: false })),
  trustNotes: ["note one"],
}

let getProjectSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  mocks.flagEnabled.mockReturnValue(true)
  getProjectSpy = vi.spyOn(store, "getProject").mockResolvedValue({ id: "proj_1", userId: "user_1", name: "Test Project" } as never)
  mocks.getGrowthOverview.mockResolvedValue(overviewFixture)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("get_growth_overview tool", () => {
  it("is registered as a READ tool that never requires confirmation", () => {
    expect(getGrowthOverviewTool.risk).toBe("READ")
    expect(getGrowthOverviewTool.requiresConfirmation).toBe(false)
    expect(getGrowthOverviewTool.prepare).toBeUndefined()
    expect(getGrowthOverviewTool.executeApproved).toBeUndefined()
  })

  it("refers another tenant's project id with the uniform access failure", async () => {
    getProjectSpy.mockResolvedValue({ id: "proj_9", userId: "someone_else" } as never)
    const result = await getGrowthOverviewTool.execute!({ projectId: "proj_9" }, ctx)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.code).toBe("UNAUTHORIZED_PROJECT_ACCESS")
    expect(mocks.getGrowthOverview).not.toHaveBeenCalled()
  })

  it("refers a missing project the same way (no existence leak)", async () => {
    getProjectSpy.mockResolvedValue(null as never)
    const result = await getGrowthOverviewTool.execute!({ projectId: "nope" }, ctx)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.code).toBe("UNAUTHORIZED_PROJECT_ACCESS")
  })

  it("reports unavailability instead of half-serving when the flag is off", async () => {
    mocks.flagEnabled.mockReturnValue(false)
    const result = await getGrowthOverviewTool.execute!({ projectId: "proj_1" }, ctx)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.code).toBe("FEATURE_DISABLED")
    expect(mocks.getGrowthOverview).not.toHaveBeenCalled()
  })

  it("resolves the owner only from the session context — the model cannot pass a userId", async () => {
    await getGrowthOverviewTool.execute!({ projectId: "proj_1", userId: "victim" }, ctx)
    expect(mocks.getGrowthOverview.mock.calls[0][0].user.id).toBe("user_1")
  })

  it("returns read-only data with a structured market navigation target", async () => {
    const result = await getGrowthOverviewTool.execute!({ projectId: "proj_1" }, ctx)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.type).toBe("growth_overview")
      expect(result.navigation).toEqual({ target: "market", projectId: "proj_1" })
    }
  })

  it("projects a bounded payload: metric states preserved, next steps capped, plan text never dumped", () => {
    const data = projectGrowthOverviewForTool(overviewFixture as never)
    const m = (data as { metrics: Record<string, { state: string; value: number | null }> }).metrics
    expect(m.siteVisitors.state).toBe("not_instrumented")
    expect(m.siteVisitors.value).toBeNull()
    expect(m.runtimeRequests.state).toBe("measured_zero")
    const steps = (data as { nextSteps: Array<{ title: string; executed: boolean; detail: string }> }).nextSteps
    expect(steps.length).toBeLessThanOrEqual(3)
    expect(steps.every((s) => s.executed === false)).toBe(true)
    expect((data as { aiPlansDrafted: Array<{ note: string }> }).aiPlansDrafted[0].note).toContain("not executed")
    // Serialized payload stays model-size.
    expect(JSON.stringify(data).length).toBeLessThan(8000)
  })
})
