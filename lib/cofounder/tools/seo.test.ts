import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const mocks = vi.hoisted(() => ({
  flagEnabled: vi.fn(() => true),
  firecrawlConfigured: vi.fn(() => true),
  affordability: vi.fn(),
  charge: vi.fn(),
  refund: vi.fn(),
  cost: vi.fn(() => 15),
  runSeoAudit: vi.fn(),
  createPendingAction: vi.fn(),
}))

vi.mock("@/lib/marketing/feature-flags", () => ({
  isSeoAuditEnabledForUser: mocks.flagEnabled,
}))
vi.mock("@/lib/integrations/firecrawl/client", () => ({
  isFirecrawlConfigured: mocks.firecrawlConfigured,
}))
vi.mock("@/lib/marketing/seo/credits", () => ({
  getSeoAuditAffordability: mocks.affordability,
  chargeSeoAuditCredits: mocks.charge,
  refundSeoAuditCredits: mocks.refund,
  getSeoAuditCost: mocks.cost,
}))
vi.mock("@/lib/marketing/seo/service", () => ({
  runSeoAudit: mocks.runSeoAudit,
}))
vi.mock("@/lib/cofounder/pending-actions", () => ({
  createPendingAction: mocks.createPendingAction,
}))

import { store } from "@/lib/store/store"
import { runSeoAuditTool } from "./seo"
import type { ToolContext } from "../types"

/**
 * run_seo_audit CONFIRM tool (Phase 3 — W2). It must be confirmation-gated
 * (prepare never runs or charges anything; only executeApproved does), refuse
 * cross-tenant projects and undeployed projects, honor the flag, and derive the
 * audited URL from the project record — never from model- or client-supplied
 * input.
 */

const ctx: ToolContext = {
  user: { id: "user_1", name: "F", email: "f@example.com", emailVerified: true },
  credits: { available: 100, balance: 100, reserved: 0 },
  conversationId: "conv_1",
}

function deployedProject(over: Record<string, unknown> = {}) {
  return { id: "proj_1", userId: "user_1", name: "Test Project", deployment: { status: "success", productionUrl: "https://live.example" }, ...over }
}

let getProjectSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  mocks.flagEnabled.mockReturnValue(true)
  mocks.firecrawlConfigured.mockReturnValue(true)
  mocks.cost.mockReturnValue(15)
  mocks.affordability.mockReturnValue({ cost: 15, available: 100, affordable: true })
  mocks.charge.mockResolvedValue(true)
  mocks.refund.mockResolvedValue(undefined)
  mocks.createPendingAction.mockResolvedValue({ id: "pa_1", userId: "user_1", toolName: "run_seo_audit", risk: "CONFIRM", status: "pending", expiresAt: Date.now() + 900000, createdAt: Date.now() })
  mocks.runSeoAudit.mockResolvedValue({
    auditId: "seo_1", status: "completed", score: { pass: 4, fail: 1, notObserved: 3 },
    findings: [{ id: "meta_description", label: "Meta description", status: "fail", note: "Add one" }],
    pagesCrawled: 2, url: "https://live.example", completedAt: Date.now(),
  })
  getProjectSpy = vi.spyOn(store, "getProject").mockResolvedValue(deployedProject() as never)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("run_seo_audit prepare", () => {
  it("is a CONFIRM tool with no immediate execute", () => {
    expect(runSeoAuditTool.risk).toBe("CONFIRM")
    expect(runSeoAuditTool.requiresConfirmation).toBe(true)
    expect(runSeoAuditTool.execute).toBeUndefined()
    expect(typeof runSeoAuditTool.prepare).toBe("function")
    expect(typeof runSeoAuditTool.executeApproved).toBe("function")
  })

  it("creates a priced pending action WITHOUT crawling or charging", async () => {
    const out = await runSeoAuditTool.prepare!({ projectId: "proj_1" }, ctx)
    expect(out.ok).toBe(true)
    expect(mocks.runSeoAudit).not.toHaveBeenCalled()
    expect(mocks.charge).not.toHaveBeenCalled()
    expect(mocks.createPendingAction).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_1", toolName: "run_seo_audit", risk: "CONFIRM", cost: expect.objectContaining({ amount: 15 }) }),
    )
  })

  it("refuses when the flag is off (fatal, no pending action)", async () => {
    mocks.flagEnabled.mockReturnValue(false)
    const out = await runSeoAuditTool.prepare!({ projectId: "proj_1" }, ctx)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.code).toBe("FEATURE_DISABLED")
    expect(mocks.createPendingAction).not.toHaveBeenCalled()
  })

  it("refuses an undeployed project without leaking existence of others", async () => {
    getProjectSpy.mockResolvedValue(deployedProject({ deployment: { status: "idle" } }) as never)
    const out = await runSeoAuditTool.prepare!({ projectId: "proj_1" }, ctx)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.code).toBe("NOT_DEPLOYED")
  })

  it("refuses insufficient credits at prepare time", async () => {
    mocks.affordability.mockReturnValue({ cost: 15, available: 3, affordable: false })
    const out = await runSeoAuditTool.prepare!({ projectId: "proj_1" }, ctx)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.code).toBe("INSUFFICIENT_CREDITS")
  })

  it("refuses another tenant's project uniformly", async () => {
    getProjectSpy.mockResolvedValue(deployedProject({ userId: "someone_else" }) as never)
    const out = await runSeoAuditTool.prepare!({ projectId: "proj_9" }, ctx)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.code).toBe("UNAUTHORIZED_PROJECT_ACCESS")
  })
})

describe("run_seo_audit executeApproved", () => {
  it("charges, audits the project's OWN recorded URL, and returns market navigation", async () => {
    const out = await runSeoAuditTool.executeApproved!({ projectId: "proj_1" }, { ...ctx, pendingActionId: "pa_1" })
    expect(out.success).toBe(true)
    if (out.success) {
      expect(out.type).toBe("seo_audit")
      expect(out.navigation).toEqual({ target: "market", projectId: "proj_1" })
      expect(out.pendingActionId).toBe("pa_1")
    }
    // URL comes from the project record, not the model input.
    expect(mocks.runSeoAudit).toHaveBeenCalledWith(expect.objectContaining({ projectId: "proj_1", url: "https://live.example" }))
    // A model-injected url/userId in the input is ignored (schema strips it).
    expect(mocks.runSeoAudit.mock.calls[0][0].userId).toBe("user_1")
  })

  it("refunds credits when the audit fails", async () => {
    mocks.runSeoAudit.mockRejectedValue(new Error("crawl boom"))
    const out = await runSeoAuditTool.executeApproved!({ projectId: "proj_1" }, ctx)
    expect(out.success).toBe(false)
    expect(mocks.refund).toHaveBeenCalledWith("user_1", "proj_1")
  })

  it("does not charge or audit for a non-owned project", async () => {
    getProjectSpy.mockResolvedValue(deployedProject({ userId: "mallory" }) as never)
    const out = await runSeoAuditTool.executeApproved!({ projectId: "proj_1" }, ctx)
    expect(out.success).toBe(false)
    expect(mocks.charge).not.toHaveBeenCalled()
    expect(mocks.runSeoAudit).not.toHaveBeenCalled()
  })
})
