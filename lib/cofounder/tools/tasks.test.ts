import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const mocks = vi.hoisted(() => ({
  flagEnabled: vi.fn(() => true),
  createGrowthTask: vi.fn(),
  listTasks: vi.fn(),
  createPendingAction: vi.fn(),
}))

vi.mock("@/lib/marketing/feature-flags", () => ({
  isGrowthTasksEnabledForUser: mocks.flagEnabled,
}))
vi.mock("@/lib/marketing/tasks/service", () => ({
  createGrowthTask: mocks.createGrowthTask,
  listTasks: mocks.listTasks,
}))
vi.mock("@/lib/cofounder/pending-actions", () => ({
  createPendingAction: mocks.createPendingAction,
}))

import { store } from "@/lib/store/store"
import { proposeGrowthTaskTool, listGrowthTasksTool } from "./tasks"
import type { ToolContext } from "../types"

/**
 * Growth task tools (Phase 5 — W4). The CONFIRM propose tool must create a
 * pending action WITHOUT persisting anything and only write on the approved path
 * (free — no credits/refunds); the READ list tool is immediate. Both honor the
 * default-off flag and refuse cross-tenant projects uniformly, and the service
 * always receives the SESSION user id — never a model-supplied one. Neither tool
 * runs or schedules anything.
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
  mocks.createPendingAction.mockResolvedValue({ id: "pa_1", userId: "user_1", toolName: "propose_growth_task", risk: "CONFIRM", status: "pending", expiresAt: Date.now() + 900000, createdAt: Date.now() })
  mocks.createGrowthTask.mockResolvedValue({ id: "task_1", projectId: "proj_1", title: "Ship hero", status: "open", priority: "medium", dueAt: null, origin: "ai_generated" })
  mocks.listTasks.mockResolvedValue([{ id: "task_1", title: "Ship hero", status: "open", priority: "medium", dueAt: null, origin: "user_created" }])
  getProjectSpy = vi.spyOn(store, "getProject").mockResolvedValue(ownedProject() as never)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("propose_growth_task prepare", () => {
  it("is a CONFIRM tool with no immediate execute", () => {
    expect(proposeGrowthTaskTool.risk).toBe("CONFIRM")
    expect(proposeGrowthTaskTool.requiresConfirmation).toBe(true)
    expect(proposeGrowthTaskTool.execute).toBeUndefined()
    expect(typeof proposeGrowthTaskTool.prepare).toBe("function")
    expect(typeof proposeGrowthTaskTool.executeApproved).toBe("function")
  })

  it("creates a pending action WITHOUT persisting and WITHOUT a credit cost", async () => {
    const out = await proposeGrowthTaskTool.prepare!({ projectId: "proj_1", title: "Ship the landing hero" }, ctx)
    expect(out.ok).toBe(true)
    expect(mocks.createGrowthTask).not.toHaveBeenCalled()
    expect(mocks.createPendingAction).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_1", toolName: "propose_growth_task", risk: "CONFIRM" }),
    )
    // Tasks are free — no cost is ever priced onto the card.
    const arg = mocks.createPendingAction.mock.calls[0][0]
    expect(arg).not.toHaveProperty("cost")
  })

  it("refuses when the flag is off (fatal, no pending action)", async () => {
    mocks.flagEnabled.mockReturnValue(false)
    const out = await proposeGrowthTaskTool.prepare!({ projectId: "proj_1", title: "Ship the landing hero" }, ctx)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.code).toBe("FEATURE_DISABLED")
    expect(mocks.createPendingAction).not.toHaveBeenCalled()
  })

  it("refuses another tenant's project uniformly", async () => {
    getProjectSpy.mockResolvedValue(ownedProject({ userId: "someone_else" }) as never)
    const out = await proposeGrowthTaskTool.prepare!({ projectId: "proj_9", title: "Sneaky task title" }, ctx)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.code).toBe("UNAUTHORIZED_PROJECT_ACCESS")
  })

  it("rejects a too-short title (schema validation) without a pending action", async () => {
    const out = await proposeGrowthTaskTool.prepare!({ projectId: "proj_1", title: "ab" }, ctx)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error.code).toBe("VALIDATION")
    expect(mocks.createPendingAction).not.toHaveBeenCalled()
  })
})

describe("propose_growth_task executeApproved", () => {
  it("persists exactly one ai_generated task with the SESSION user id and tasks navigation", async () => {
    const out = await proposeGrowthTaskTool.executeApproved!({ projectId: "proj_1", title: "Ship the landing hero" }, { ...ctx, pendingActionId: "pa_1" })
    expect(out.success).toBe(true)
    if (out.success) {
      expect(out.type).toBe("growth_task")
      expect(out.navigation).toEqual({ target: "tasks", projectId: "proj_1" })
      expect(out.pendingActionId).toBe("pa_1")
    }
    expect(mocks.createGrowthTask).toHaveBeenCalledTimes(1)
    const arg = mocks.createGrowthTask.mock.calls[0][0]
    expect(arg.userId).toBe("user_1")
    expect(arg.projectId).toBe("proj_1")
    expect(arg.origin).toBe("ai_generated")
  })

  it("writes nothing for a non-owned project", async () => {
    getProjectSpy.mockResolvedValue(ownedProject({ userId: "mallory" }) as never)
    const out = await proposeGrowthTaskTool.executeApproved!({ projectId: "proj_1", title: "Ship the landing hero" }, ctx)
    expect(out.success).toBe(false)
    expect(mocks.createGrowthTask).not.toHaveBeenCalled()
  })

  it("refuses at approval time if the flag has since been turned off", async () => {
    mocks.flagEnabled.mockReturnValue(false)
    const out = await proposeGrowthTaskTool.executeApproved!({ projectId: "proj_1", title: "Ship the landing hero" }, ctx)
    expect(out.success).toBe(false)
    if (!out.success) expect(out.error.code).toBe("FEATURE_DISABLED")
    expect(mocks.createGrowthTask).not.toHaveBeenCalled()
  })

  it("emits no scheduling/execution field — a task is a manual to-do", async () => {
    const out = await proposeGrowthTaskTool.executeApproved!({ projectId: "proj_1", title: "Ship the landing hero" }, ctx)
    const keys = [...JSON.stringify(out).matchAll(/"([a-zA-Z]*(?:schedule|cron|runAt|execute)[a-zA-Z]*)"\s*:/gi)].map((m) => m[1])
    expect(keys).toEqual([])
  })
})

describe("list_growth_tasks (READ)", () => {
  it("is an immediate READ tool that returns the founder's own tasks", async () => {
    expect(listGrowthTasksTool.risk).toBe("READ")
    expect(listGrowthTasksTool.requiresConfirmation).toBe(false)
    const out = await listGrowthTasksTool.execute!({ projectId: "proj_1" }, ctx)
    expect(out.success).toBe(true)
    if (out.success) {
      expect(out.type).toBe("growth_tasks_list")
      expect(out.navigation).toEqual({ target: "tasks", projectId: "proj_1" })
    }
    expect(mocks.listTasks).toHaveBeenCalledWith("proj_1", expect.objectContaining({ limit: 20 }))
  })

  it("refuses when the flag is off", async () => {
    mocks.flagEnabled.mockReturnValue(false)
    const out = await listGrowthTasksTool.execute!({ projectId: "proj_1" }, ctx)
    expect(out.success).toBe(false)
    if (!out.success) expect(out.error.code).toBe("FEATURE_DISABLED")
    expect(mocks.listTasks).not.toHaveBeenCalled()
  })

  it("refuses another tenant's project uniformly", async () => {
    getProjectSpy.mockResolvedValue(ownedProject({ userId: "mallory" }) as never)
    const out = await listGrowthTasksTool.execute!({ projectId: "proj_1" }, ctx)
    expect(out.success).toBe(false)
    if (!out.success) expect(out.error.code).toBe("UNAUTHORIZED_PROJECT_ACCESS")
  })
})
