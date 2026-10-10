import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const mocks = vi.hoisted(() => ({
  flagEnabled: vi.fn(() => true),
  generationConfigured: vi.fn(() => true),
  templateLabel: vi.fn((t: string) => `Label:${t}`),
  affordability: vi.fn(),
  charge: vi.fn(),
  refund: vi.fn(),
  cost: vi.fn(() => 10),
  generateMarketingDraft: vi.fn(),
  createPendingAction: vi.fn(),
}))

vi.mock("@/lib/marketing/feature-flags", () => ({
  isStudioEnabledForUser: mocks.flagEnabled,
}))
vi.mock("@/lib/marketing/studio/credits", () => ({
  getStudioAffordability: mocks.affordability,
  chargeStudioCredits: mocks.charge,
  refundStudioCredits: mocks.refund,
  getStudioCost: mocks.cost,
}))
vi.mock("@/lib/marketing/studio/generator", () => ({
  isGenerationConfigured: mocks.generationConfigured,
  studioTemplateLabel: mocks.templateLabel,
}))
vi.mock("@/lib/marketing/studio/service", () => ({
  generateMarketingDraft: mocks.generateMarketingDraft,
}))
vi.mock("@/lib/cofounder/pending-actions", () => ({
  createPendingAction: mocks.createPendingAction,
}))

import { store } from "@/lib/store/store"
import { generateMarketingCopyTool } from "./studio"
import type { ToolContext } from "../types"

/**
 * generate_marketing_copy CONFIRM tool (Phase 4 — W3). It must be confirmation-
 * gated (prepare prices WITHOUT generating or charging; only executeApproved
 * spends + generates), honor the default-off flag and provider config, refuse
 * cross-tenant projects uniformly, and NEVER publish — it returns a draft saved
 * in the Studio. The session-derived user id is what reaches the service.
 */

const ctx: ToolContext = {
  user: { id: "user_1", name: "F", email: "f@example.com", emailVerified: true },
  credits: { available: 100, balance: 100, reserved: 0 },
  conversationId: "conv_1",
}

function ownedProject(over: Record<string, unknown> = {}) {
  return { id: "proj_1", userId: "user_1", name: "Test Project", specification: {}, ...over }
}

let getProjectSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  mocks.flagEnabled.mockReturnValue(true)
  mocks.generationConfigured.mockReturnValue(true)
  mocks.cost.mockReturnValue(10)
  mocks.affordability.mockReturnValue({ cost: 10, available: 100, affordable: true })
  mocks.charge.mockResolvedValue(true)
  mocks.refund.mockResolvedValue(undefined)
  mocks.createPendingAction.mockResolvedValue({ id: "pa_1", userId: "user_1", toolName: "generate_marketing_copy", risk: "CONFIRM", status: "pending", expiresAt: Date.now() + 900000, createdAt: Date.now() })
  mocks.generateMarketingDraft.mockResolvedValue({
    contentId: "content_1", projectId: "proj_1", template: "landing_hero", title: "Landing hero for Test Project",
    body: "Draft copy", version: 1, model: "openrouter/auto", brandVoiceSources: ["Brand & visual identity"],
  })
  getProjectSpy = vi.spyOn(store, "getProject").mockResolvedValue(ownedProject() as never)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("generate_marketing_copy prepare", () => {
  it("is a CONFIRM tool with no immediate execute", () => {
    expect(generateMarketingCopyTool.risk).toBe("CONFIRM")
    expect(generateMarketingCopyTool.requiresConfirmation).toBe(true)
    expect(generateMarketingCopyTool.execute).toBeUndefined()
    expect(typeof generateMarketingCopyTool.prepare).toBe("function")
    expect(typeof generateMarketingCopyTool.executeApproved).toBe("function")
  })

  it("creates a priced pending action WITHOUT generating or charging", async () => {
    const out = await generateMarketingCopyTool.prepare!({ projectId: "proj_1", template: "landing_hero" }, ctx)
    expect(out.ok).toBe(true)
    expect(mocks.generateMarketingDraft).not.toHaveBeenCalled()
    expect(mocks.charge).not.toHaveBeenCalled()
    expect(mocks.createPendingAction).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_1", toolName: "generate_marketing_copy", risk: "CONFIRM", cost: expect.objectContaining({ amount: 10 }) }),
    )
  })

  it("refuses when the flag is off (fatal, no pending action)", async () => {
    mocks.flagEnabled.mockReturnValue(false)
    const out = await generateMarketingCopyTool.prepare!({ projectId: "proj_1", template: "landing_hero" }, ctx)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.code).toBe("FEATURE_DISABLED")
    expect(mocks.createPendingAction).not.toHaveBeenCalled()
  })

  it("refuses when the model provider isn't configured", async () => {
    mocks.generationConfigured.mockReturnValue(false)
    const out = await generateMarketingCopyTool.prepare!({ projectId: "proj_1", template: "landing_hero" }, ctx)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.code).toBe("AI_UNAVAILABLE")
  })

  it("refuses insufficient credits at prepare time", async () => {
    mocks.affordability.mockReturnValue({ cost: 10, available: 3, affordable: false })
    const out = await generateMarketingCopyTool.prepare!({ projectId: "proj_1", template: "landing_hero" }, ctx)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.code).toBe("INSUFFICIENT_CREDITS")
  })

  it("refuses another tenant's project uniformly", async () => {
    getProjectSpy.mockResolvedValue(ownedProject({ userId: "someone_else" }) as never)
    const out = await generateMarketingCopyTool.prepare!({ projectId: "proj_9", template: "landing_hero" }, ctx)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.code).toBe("UNAUTHORIZED_PROJECT_ACCESS")
  })

  it("rejects an unknown template (schema validation) without a pending action", async () => {
    const out = await generateMarketingCopyTool.prepare!({ projectId: "proj_1", template: "publish_everywhere" } as never, ctx)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.code).toBe("VALIDATION")
    expect(mocks.createPendingAction).not.toHaveBeenCalled()
  })
})

describe("generate_marketing_copy executeApproved", () => {
  it("charges idempotently on the approval id, generates one draft, and returns studio navigation", async () => {
    const out = await generateMarketingCopyTool.executeApproved!({ projectId: "proj_1", template: "landing_hero" }, { ...ctx, pendingActionId: "pa_1" })
    expect(out.success).toBe(true)
    if (out.success) {
      expect(out.type).toBe("marketing_content")
      expect(out.navigation).toEqual({ target: "studio", projectId: "proj_1" })
      expect(out.pendingActionId).toBe("pa_1")
    }
    // Charge is idempotent on the approved pending-action id.
    expect(mocks.charge).toHaveBeenCalledWith("user_1", "proj_1", "pa_1")
    // Service receives the SESSION user id, never a model-supplied one.
    expect(mocks.generateMarketingDraft).toHaveBeenCalledWith(expect.objectContaining({ userId: "user_1", projectId: "proj_1", template: "landing_hero" }))
    expect(mocks.generateMarketingDraft.mock.calls[0][0].userId).toBe("user_1")
  })

  it("refunds credits when generation fails", async () => {
    mocks.generateMarketingDraft.mockRejectedValue(new Error("model boom"))
    const out = await generateMarketingCopyTool.executeApproved!({ projectId: "proj_1", template: "landing_hero" }, ctx)
    expect(out.success).toBe(false)
    expect(mocks.refund).toHaveBeenCalledWith("user_1", "proj_1")
  })

  it("never charges or generates for a non-owned project", async () => {
    getProjectSpy.mockResolvedValue(ownedProject({ userId: "mallory" }) as never)
    const out = await generateMarketingCopyTool.executeApproved!({ projectId: "proj_1", template: "landing_hero" }, ctx)
    expect(out.success).toBe(false)
    expect(mocks.charge).not.toHaveBeenCalled()
    expect(mocks.generateMarketingDraft).not.toHaveBeenCalled()
  })

  it("produces a DRAFT only — no publish/schedule action or field is ever emitted", async () => {
    const out = await generateMarketingCopyTool.executeApproved!({ projectId: "proj_1", template: "landing_hero" }, ctx)
    expect(out.success).toBe(true)
    if (out.success) {
      // It navigates to the Studio view (where drafts live), never a publish route.
      expect(out.navigation?.target).toBe("studio")
    }
    // No FIELD named like publish/schedule exists in the payload (prose mentioning
    // "not published" is fine — we check object keys, not values).
    const keys = [...JSON.stringify(out).matchAll(/"([a-zA-Z]*(?:publish|schedule|goLive)[a-zA-Z]*)"\s*:/gi)].map((m) => m[1])
    expect(keys).toEqual([])
  })
})
