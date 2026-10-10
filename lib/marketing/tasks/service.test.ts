import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

const insertTask = vi.fn()
const insertHistory = vi.fn()
const findOne = vi.fn()
const findOneAndUpdate = vi.fn()
const toArray = vi.fn()
const findChain = { sort: vi.fn(() => findChain), limit: vi.fn(() => findChain), toArray }
const find = vi.fn(() => findChain)
const histFind = vi.fn(() => findChain)

vi.mock("@/lib/db/collections", () => ({
  growthTasksCol: vi.fn(async () => ({ insertOne: insertTask, findOne, find, findOneAndUpdate })),
  growthTaskHistoryCol: vi.fn(async () => ({ insertOne: insertHistory, find: histFind })),
}))

const getProject = vi.fn()
vi.mock("@/lib/store/store", () => ({
  store: { getProject: (...a: unknown[]) => getProject(...a) },
  cryptoId: () => "testid",
}))

import {
  createGrowthTask,
  updateTaskStatus,
  updateTaskFields,
  listTasks,
  getTaskHistory,
} from "./service"

/**
 * Growth task service (Phase 5 — W4). Proves the LIST persists tasks with real
 * null due/completed states, re-asserts project ownership fail-closed BEFORE any
 * write, records an append-only history row per change, and NEVER executes or
 * schedules anything.
 */

function project(over: Record<string, unknown> = {}) {
  return { id: "proj_1", userId: "owner", name: "Acme", ...over }
}

beforeEach(() => {
  vi.clearAllMocks()
  insertTask.mockResolvedValue({ acknowledged: true })
  insertHistory.mockResolvedValue({ acknowledged: true })
})

describe("createGrowthTask", () => {
  it("persists an open task with real null due/completed and a created history row", async () => {
    getProject.mockResolvedValue(project())
    const doc = await createGrowthTask({ userId: "owner", projectId: "proj_1", title:  "  Ship the landing hero  ", origin: "user_created" })
    expect(doc.id).toBe("task_testid")
    expect(doc.title).toBe("Ship the landing hero")
    expect(doc.status).toBe("open")
    expect(doc.priority).toBe("medium")
    expect(doc.dueAt).toBeNull()
    expect(doc.completedAt).toBeNull()
    expect(doc.origin).toBe("user_created")
    // A created row is appended to the durable history.
    expect(insertHistory).toHaveBeenCalledTimes(1)
    const history = insertHistory.mock.calls[0][0]
    expect(history.action).toBe("created")
    expect(history.taskId).toBe("task_testid")
    expect(history.changedBy).toBe("owner")
    // It is a LIST row — no execution/scheduling field exists.
    expect(doc).not.toHaveProperty("scheduledFor")
    expect(doc).not.toHaveProperty("ranAt")
  })

  it("keeps a finite numeric due date and coerces a bad one to null", async () => {
    getProject.mockResolvedValue(project())
    const withDue = await createGrowthTask({ userId: "owner", projectId: "proj_1", title: "Fix deploy", dueAt: 1700000000000, origin: "next_step_seed", sourceNextStepId: "deploy" })
    expect(withDue.dueAt).toBe(1700000000000)
    expect(withDue.sourceNextStepId).toBe("deploy")
    const bad = await createGrowthTask({ userId: "owner", projectId: "proj_1", title: "No due", dueAt: Number.NaN, origin: "user_created" })
    expect(bad.dueAt).toBeNull()
  })

  it("rejects an empty title before touching the store", async () => {
    getProject.mockResolvedValue(project())
    await expect(createGrowthTask({ userId: "owner", projectId: "proj_1", title: "   ", origin: "user_created" })).rejects.toMatchObject({ code: "VALIDATION" })
    expect(insertTask).not.toHaveBeenCalled()
    expect(insertHistory).not.toHaveBeenCalled()
  })

  it("refuses a non-owner WITHOUT persisting (fail-closed re-check)", async () => {
    getProject.mockResolvedValue(project({ userId: "someone_else" }))
    await expect(createGrowthTask({ userId: "owner", projectId: "proj_1", title: "Sneaky task", origin: "user_created" })).rejects.toMatchObject({ code: "UNAUTHORIZED_PROJECT_ACCESS" })
    expect(insertTask).not.toHaveBeenCalled()
    expect(insertHistory).not.toHaveBeenCalled()
  })

  it("refuses when the project is missing entirely", async () => {
    getProject.mockResolvedValue(null)
    await expect(createGrowthTask({ userId: "owner", projectId: "ghost", title: "Orphan task", origin: "user_created" })).rejects.toMatchObject({ code: "UNAUTHORIZED_PROJECT_ACCESS" })
    expect(insertTask).not.toHaveBeenCalled()
  })
})

describe("updateTaskStatus", () => {
  it("sets completedAt on the done edge and appends a status history row", async () => {
    getProject.mockResolvedValue(project())
    findOne.mockResolvedValue({ id: "task_1", userId: "owner", projectId: "proj_1", status: "open", completedAt: null })
    findOneAndUpdate.mockResolvedValue({ id: "task_1", userId: "owner", projectId: "proj_1", status: "done", completedAt: 123, priority: "medium", dueAt: null })
    const out = await updateTaskStatus({ userId: "owner", projectId: "proj_1", taskId: "task_1", status: "done" })
    expect(out.status).toBe("done")
    const set = findOneAndUpdate.mock.calls[0][1].$set
    expect(set.status).toBe("done")
    expect(set.completedAt).toBeGreaterThan(0)
    expect(insertHistory).toHaveBeenCalledTimes(1)
    expect(insertHistory.mock.calls[0][0]).toMatchObject({ action: "status", field: "status", from: "open", to: "done" })
  })

  it("is a no-op for the same status (no write, no history)", async () => {
    getProject.mockResolvedValue(project())
    findOne.mockResolvedValue({ id: "task_1", userId: "owner", projectId: "proj_1", status: "done", completedAt: 5 })
    const out = await updateTaskStatus({ userId: "owner", projectId: "proj_1", taskId: "task_1", status: "done" })
    expect(out.status).toBe("done")
    expect(findOneAndUpdate).not.toHaveBeenCalled()
    expect(insertHistory).not.toHaveBeenCalled()
  })

  it("refuses to touch another tenant's task", async () => {
    getProject.mockResolvedValue(project())
    findOne.mockResolvedValue({ id: "task_1", userId: "mallory", projectId: "proj_1", status: "open", completedAt: null })
    await expect(updateTaskStatus({ userId: "owner", projectId: "proj_1", taskId: "task_1", status: "done" })).rejects.toMatchObject({ code: "UNAUTHORIZED_PROJECT_ACCESS" })
    expect(findOneAndUpdate).not.toHaveBeenCalled()
  })
})

describe("updateTaskFields", () => {
  it("applies only the changed fields and logs one updated row per field", async () => {
    getProject.mockResolvedValue(project())
    findOne.mockResolvedValue({ id: "task_1", userId: "owner", projectId: "proj_1", status: "open", title: "Old", priority: "low", dueAt: null, completedAt: null })
    findOneAndUpdate.mockResolvedValue({ id: "task_1", userId: "owner", projectId: "proj_1", status: "open", title: "New", priority: "high", dueAt: null, completedAt: null })
    const out = await updateTaskFields({ userId: "owner", projectId: "proj_1", taskId: "task_1", title: "New", priority: "high" })
    expect(out.title).toBe("New")
    const set = findOneAndUpdate.mock.calls[0][1].$set
    expect(set.title).toBe("New")
    expect(set.priority).toBe("high")
    // Two fields changed → two history rows (title, priority).
    const fields = insertHistory.mock.calls.map((c) => c[0].field)
    expect(fields).toEqual(expect.arrayContaining(["title", "priority"]))
    expect(insertHistory).toHaveBeenCalledTimes(2)
  })

  it("does nothing when no field actually changes", async () => {
    getProject.mockResolvedValue(project())
    findOne.mockResolvedValue({ id: "task_1", userId: "owner", projectId: "proj_1", status: "open", title: "Same", priority: "medium", dueAt: null, completedAt: null })
    const out = await updateTaskFields({ userId: "owner", projectId: "proj_1", taskId: "task_1", title: "Same" })
    expect(out.title).toBe("Same")
    expect(findOneAndUpdate).not.toHaveBeenCalled()
    expect(insertHistory).not.toHaveBeenCalled()
  })
})

describe("listTasks / getTaskHistory", () => {
  it("queries tenant-scoped tasks newest-first, optionally filtered by status", async () => {
    toArray.mockResolvedValue([])
    await listTasks("proj_1", { status: "open" })
    expect(find).toHaveBeenCalledWith({ projectId: "proj_1", status: "open" })
    expect(findChain.sort).toHaveBeenCalledWith({ updatedAt: -1 })
  })

  it("reads history oldest-first, tenant-scoped", async () => {
    toArray.mockResolvedValue([])
    await getTaskHistory("proj_1", "task_1")
    expect(histFind).toHaveBeenCalledWith({ taskId: "task_1", projectId: "proj_1" })
    expect(findChain.sort).toHaveBeenCalledWith({ createdAt: 1 })
  })
})
