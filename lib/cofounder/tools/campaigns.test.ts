import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const mocks = vi.hoisted(() => ({
  flagEnabled: vi.fn(() => true),
  createCampaign: vi.fn(),
  listCampaigns: vi.fn(),
  createPendingAction: vi.fn(),
}))

vi.mock("@/lib/marketing/feature-flags", () => ({
  isCampaignsEnabledForUser: mocks.flagEnabled,
}))
vi.mock("@/lib/marketing/campaigns/service", () => ({
  createCampaign: mocks.createCampaign,
  listCampaigns: mocks.listCampaigns,
}))
vi.mock("@/lib/cofounder/pending-actions", () => ({
  createPendingAction: mocks.createPendingAction,
}))

import { store } from "@/lib/store/store"
import { proposeCampaignTool, listCampaignsTool } from "./campaigns"
import type { ToolContext } from "../types"

/**
 * Campaign tools (Phase 6 — W5). The CONFIRM propose tool must create a pending
 * action WITHOUT persisting anything and only write on the approved path (free —
 * no credits/refunds, and NEVER a spend/execution); the READ list tool is
 * immediate. Both honor the default-off flag and refuse cross-tenant projects
 * uniformly, and the service always receives the SESSION user id — never a
 * model-supplied one. Neither tool sends, posts, spends, or schedules anything.
 */

const ctx: ToolContext = {
  user: { id: "user_1", name: "F", email: "f@example.com", emailVerified: true },
  credits: { available: 100, balance: 100, reserved: 0 },
  conversationId: "conv_1",
}

function ownedProject(over: Record<string, unknown> = {}) {
  return { id: "proj_1", userId: "user_1", name: "Test Project", ...over }
}

let getProjectSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  mocks.flagEnabled.mockReturnValue(true)
  mocks.createPendingAction.mockResolvedValue({ id: "pa_1", userId: "user_1", toolName: "propose_campaign", risk: "CONFIRM", status: "pending", expiresAt: Date.now() + 900000, createdAt: Date.now() })
  mocks.createCampaign.mockResolvedValue({ id: "campaign_1", projectId: "proj_1", name: "Launch", status: "draft", channels: ["social"], origin: "ai_generated" })
  mocks.listCampaigns.mockResolvedValue([{ id: "campaign_1", name: "Launch", status: "draft", channels: ["social"], origin: "user_created" }])
  getProjectSpy = vi.spyOn(store, "getProject").mockResolvedValue(ownedProject() as never)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("propose_campaign prepare", () => {
  it("is a CONFIRM tool with no immediate execute", () => {
    expect(proposeCampaignTool.risk).toBe("CONFIRM")
    expect(proposeCampaignTool.requiresConfirmation).toBe(true)
    expect(proposeCampaignTool.execute).toBeUndefined()
    expect(typeof proposeCampaignTool.prepare).toBe("function")
    expect(typeof proposeCampaignTool.executeApproved).toBe("function")
  })

  it("creates a pending action WITHOUT persisting and WITHOUT a credit cost", async () => {
    const out = await proposeCampaignTool.prepare!({ projectId: "proj_1", name: "Product hunt launch" }, ctx)
    expect(out.ok).toBe(true)
    expect(mocks.createCampaign).not.toHaveBeenCalled()
    expect(mocks.createPendingAction).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_1", toolName: "propose_campaign", risk: "CONFIRM" }),
    )
    // Campaigns are free — no cost is ever priced onto the card.
    const arg = mocks.createPendingAction.mock.calls[0][0]
    expect(arg).not.toHaveProperty("cost")
  })

  it("refuses when the flag is off (fatal, no pending action)", async () => {
    mocks.flagEnabled.mockReturnValue(false)
    const out = await proposeCampaignTool.prepare!({ projectId: "proj_1", name: "Product hunt launch" }, ctx)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.code).toBe("FEATURE_DISABLED")
    expect(mocks.createPendingAction).not.toHaveBeenCalled()
  })

  it("refuses another tenant's project uniformly", async () => {
    getProjectSpy.mockResolvedValue(ownedProject({ userId: "someone_else" }) as never)
    const out = await proposeCampaignTool.prepare!({ projectId: "proj_9", name: "Sneaky plan name" }, ctx)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.code).toBe("UNAUTHORIZED_PROJECT_ACCESS")
  })

  it("rejects a too-short name (schema validation) without a pending action", async () => {
    const out = await proposeCampaignTool.prepare!({ projectId: "proj_1", name: "ab" }, ctx)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.code).toBe("VALIDATION")
    expect(mocks.createPendingAction).not.toHaveBeenCalled()
  })
})

describe("propose_campaign executeApproved", () => {
  it("persists exactly one ai_generated plan with the SESSION user id and campaigns navigation", async () => {
    const out = await proposeCampaignTool.executeApproved!({ projectId: "proj_1", name: "Product hunt launch" }, { ...ctx, pendingActionId: "pa_1" })
    expect(out.success).toBe(true)
    if (out.success) {
      expect(out.type).toBe("campaign")
      expect(out.navigation).toEqual({ target: "campaigns", projectId: "proj_1" })
      expect(out.pendingActionId).toBe("pa_1")
    }
    expect(mocks.createCampaign).toHaveBeenCalledTimes(1)
    const arg = mocks.createCampaign.mock.calls[0][0]
    expect(arg.userId).toBe("user_1")
    expect(arg.projectId).toBe("proj_1")
    expect(arg.origin).toBe("ai_generated")
  })

  it("writes nothing for a non-owned project", async () => {
    getProjectSpy.mockResolvedValue(ownedProject({ userId: "mallory" }) as never)
    const out = await proposeCampaignTool.executeApproved!({ projectId: "proj_1", name: "Product hunt launch" }, ctx)
    expect(out.success).toBe(false)
    expect(mocks.createCampaign).not.toHaveBeenCalled()
  })

  it("refuses at approval time if the flag has since been turned off", async () => {
    mocks.flagEnabled.mockReturnValue(false)
    const out = await proposeCampaignTool.executeApproved!({ projectId: "proj_1", name: "Product hunt launch" }, ctx)
    expect(out.success).toBe(false)
    if (!out.success) expect(out.error.code).toBe("FEATURE_DISABLED")
    expect(mocks.createCampaign).not.toHaveBeenCalled()
  })

  it("emits no spend/scheduling/execution field — a campaign is a plan only", async () => {
    const out = await proposeCampaignTool.executeApproved!({ projectId: "proj_1", name: "Product hunt launch" }, ctx)
    const keys = [...JSON.stringify(out).matchAll(/"([a-zA-Z]*(?:schedule|cron|runAt|execute|spent|spend|send)[a-zA-Z]*)"\s*:/gi)].map((m) => m[1])
    expect(keys).toEqual([])
  })
})

describe("list_campaigns (READ)", () => {
  it("is an immediate READ tool that returns the founder's own campaigns", async () => {
    expect(listCampaignsTool.risk).toBe("READ")
    expect(listCampaignsTool.requiresConfirmation).toBe(false)
    const out = await listCampaignsTool.execute!({ projectId: "proj_1" }, ctx)
    expect(out.success).toBe(true)
    if (out.success) {
      expect(out.type).toBe("campaigns_list")
      expect(out.navigation).toEqual({ target: "campaigns", projectId: "proj_1" })
    }
    expect(mocks.listCampaigns).toHaveBeenCalledWith("proj_1", expect.objectContaining({ limit: 20 }))
  })

  it("refuses when the flag is off", async () => {
    mocks.flagEnabled.mockReturnValue(false)
    const out = await listCampaignsTool.execute!({ projectId: "proj_1" }, ctx)
    expect(out.success).toBe(false)
    if (!out.success) expect(out.error.code).toBe("FEATURE_DISABLED")
    expect(mocks.listCampaigns).not.toHaveBeenCalled()
  })

  it("refuses another tenant's project uniformly", async () => {
    getProjectSpy.mockResolvedValue(ownedProject({ userId: "mallory" }) as never)
    const out = await listCampaignsTool.execute!({ projectId: "proj_1" }, ctx)
    expect(out.success).toBe(false)
    if (!out.success) expect(out.error.code).toBe("UNAUTHORIZED_PROJECT_ACCESS")
  })
})
