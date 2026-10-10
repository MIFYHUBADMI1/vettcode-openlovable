import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

const insertCampaign = vi.fn()
const insertHistory = vi.fn()
const findOne = vi.fn()
const findOneAndUpdate = vi.fn()
const toArray = vi.fn()
const findChain = { sort: vi.fn(() => findChain), limit: vi.fn(() => findChain), toArray }
const find = vi.fn(() => findChain)
const histFind = vi.fn(() => findChain)

vi.mock("@/lib/db/collections", () => ({
  campaignsCol: vi.fn(async () => ({ insertOne: insertCampaign, findOne, find, findOneAndUpdate })),
  campaignHistoryCol: vi.fn(async () => ({ insertOne: insertHistory, find: histFind })),
}))

const getProject = vi.fn()
vi.mock("@/lib/store/store", () => ({
  store: { getProject: (...a: unknown[]) => getProject(...a) },
  cryptoId: () => "testid",
}))

import {
  createCampaign,
  updateCampaignStatus,
  updateCampaignFields,
  listCampaigns,
  getCampaignHistory,
  CAMPAIGN_TRANSITIONS,
} from "./service"

/**
 * Campaign service (Phase 6 — W5). Proves the PLAN store persists drafts with
 * real null budget/dates, re-asserts project ownership fail-closed BEFORE any
 * write, enforces the lifecycle transition machine (terminal completed/cancelled,
 * pausedAt/cancelledAt edges), records append-only history per change, and NEVER
 * executes, sends, spends, or schedules anything.
 */

function project(over: Record<string, unknown> = {}) {
  return { id: "proj_1", userId: "owner", name: "Acme", ...over }
}

beforeEach(() => {
  vi.clearAllMocks()
  insertCampaign.mockResolvedValue({ acknowledged: true })
  insertHistory.mockResolvedValue({ acknowledged: true })
})

describe("createCampaign", () => {
  it("persists a draft plan with real null budget/dates and a created history row", async () => {
    getProject.mockResolvedValue(project())
    const doc = await createCampaign({
      userId: "owner",
      projectId: "proj_1",
      name: "  Product hunt launch  ",
      objective: "first 100 signups",
      channels: ["social", "email", "bogus", "social"],
      origin: "user_created",
    })
    expect(doc.id).toBe("campaign_testid")
    expect(doc.name).toBe("Product hunt launch")
    expect(doc.status).toBe("draft")
    expect(doc.plannedBudgetCents).toBeNull()
    expect(doc.startDate).toBeNull()
    expect(doc.endDate).toBeNull()
    expect(doc.pausedAt).toBeNull()
    expect(doc.cancelledAt).toBeNull()
    // Invalid + duplicate channels are dropped; only valid, unique ones survive.
    expect(doc.channels).toEqual(["social", "email"])
    expect(insertHistory).toHaveBeenCalledTimes(1)
    expect(insertHistory.mock.calls[0][0]).toMatchObject({ action: "created", campaignId: "campaign_testid", changedBy: "owner" })
    // It is a PLAN row — no execution/spend/scheduling field exists.
    expect(doc).not.toHaveProperty("spentCents")
    expect(doc).not.toHaveProperty("scheduledFor")
    expect(doc).not.toHaveProperty("ranAt")
  })

  it("coerces a bad budget and a bad start date, keeps finite ones", async () => {
    getProject.mockResolvedValue(project())
    const ok = await createCampaign({ userId: "owner", projectId: "proj_1", name: "Launch", plannedBudgetCents: 12500, startDate: 1700000000000, origin: "user_created" })
    expect(ok.plannedBudgetCents).toBe(12500)
    expect(ok.startDate).toBe(1700000000000)
    const bad = await createCampaign({ userId: "owner", projectId: "proj_1", name: "No budget", plannedBudgetCents: -5, startDate: Number.NaN, origin: "user_created" })
    expect(bad.plannedBudgetCents).toBeNull()
    expect(bad.startDate).toBeNull()
  })

  it("rejects an empty name before touching the store", async () => {
    getProject.mockResolvedValue(project())
    await expect(createCampaign({ userId: "owner", projectId: "proj_1", name: "   ", origin: "user_created" })).rejects.toMatchObject({ code: "VALIDATION" })
    expect(insertCampaign).not.toHaveBeenCalled()
    expect(insertHistory).not.toHaveBeenCalled()
  })

  it("refuses a non-owner WITHOUT persisting (fail-closed re-check)", async () => {
    getProject.mockResolvedValue(project({ userId: "someone_else" }))
    await expect(createCampaign({ userId: "owner", projectId: "proj_1", name: "Sneaky plan", origin: "user_created" })).rejects.toMatchObject({ code: "UNAUTHORIZED_PROJECT_ACCESS" })
    expect(insertCampaign).not.toHaveBeenCalled()
  })
})

describe("updateCampaignStatus", () => {
  it("moves draft → active and appends a status history row", async () => {
    getProject.mockResolvedValue(project())
    findOne.mockResolvedValue({ id: "campaign_1", userId: "owner", projectId: "proj_1", status: "draft", pausedAt: null, cancelledAt: null })
    findOneAndUpdate.mockResolvedValue({ id: "campaign_1", userId: "owner", projectId: "proj_1", status: "active", pausedAt: null, cancelledAt: null })
    const out = await updateCampaignStatus({ userId: "owner", projectId: "proj_1", campaignId: "campaign_1", status: "active" })
    expect(out.status).toBe("active")
    const set = findOneAndUpdate.mock.calls[0][1].$set
    expect(set.status).toBe("active")
    expect(set.pausedAt).toBeNull()
    expect(insertHistory).toHaveBeenCalledTimes(1)
    expect(insertHistory.mock.calls[0][0]).toMatchObject({ action: "status", field: "status", from: "draft", to: "active" })
  })

  it("sets pausedAt on the pause edge and clears it on resume", async () => {
    getProject.mockResolvedValue(project())
    findOne.mockResolvedValue({ id: "campaign_1", userId: "owner", projectId: "proj_1", status: "active", pausedAt: null, cancelledAt: null })
    findOneAndUpdate.mockResolvedValue({ id: "campaign_1", status: "paused", pausedAt: 555, cancelledAt: null })
    await updateCampaignStatus({ userId: "owner", projectId: "proj_1", campaignId: "campaign_1", status: "paused" })
    expect(findOneAndUpdate.mock.calls[0][1].$set.pausedAt).toBeGreaterThan(0)

    // Resume clears pausedAt.
    vi.clearAllMocks()
    getProject.mockResolvedValue(project())
    findOne.mockResolvedValue({ id: "campaign_1", userId: "owner", projectId: "proj_1", status: "paused", pausedAt: 555, cancelledAt: null })
    findOneAndUpdate.mockResolvedValue({ id: "campaign_1", status: "active", pausedAt: null, cancelledAt: null })
    await updateCampaignStatus({ userId: "owner", projectId: "proj_1", campaignId: "campaign_1", status: "active" })
    expect(findOneAndUpdate.mock.calls[0][1].$set.pausedAt).toBeNull()
  })

  it("sets cancelledAt on the cancel edge", async () => {
    getProject.mockResolvedValue(project())
    findOne.mockResolvedValue({ id: "campaign_1", userId: "owner", projectId: "proj_1", status: "active", pausedAt: null, cancelledAt: null })
    findOneAndUpdate.mockResolvedValue({ id: "campaign_1", status: "cancelled", pausedAt: null, cancelledAt: 999 })
    await updateCampaignStatus({ userId: "owner", projectId: "proj_1", campaignId: "campaign_1", status: "cancelled" })
    expect(findOneAndUpdate.mock.calls[0][1].$set.cancelledAt).toBeGreaterThan(0)
  })

  it("refuses an illegal transition (completed is terminal)", async () => {
    getProject.mockResolvedValue(project())
    findOne.mockResolvedValue({ id: "campaign_1", userId: "owner", projectId: "proj_1", status: "completed", pausedAt: null, cancelledAt: null })
    await expect(updateCampaignStatus({ userId: "owner", projectId: "proj_1", campaignId: "campaign_1", status: "active" })).rejects.toMatchObject({ code: "VALIDATION" })
    expect(findOneAndUpdate).not.toHaveBeenCalled()
    expect(insertHistory).not.toHaveBeenCalled()
  })

  it("is a no-op for the same status (no write, no history)", async () => {
    getProject.mockResolvedValue(project())
    findOne.mockResolvedValue({ id: "campaign_1", userId: "owner", projectId: "proj_1", status: "active", pausedAt: null, cancelledAt: null })
    const out = await updateCampaignStatus({ userId: "owner", projectId: "proj_1", campaignId: "campaign_1", status: "active" })
    expect(out.status).toBe("active")
    expect(findOneAndUpdate).not.toHaveBeenCalled()
    expect(insertHistory).not.toHaveBeenCalled()
  })

  it("exposes a transition machine with terminal completed/cancelled", () => {
    expect(CAMPAIGN_TRANSITIONS.completed).toEqual([])
    expect(CAMPAIGN_TRANSITIONS.cancelled).toEqual([])
    expect(CAMPAIGN_TRANSITIONS.draft).toContain("active")
    expect(CAMPAIGN_TRANSITIONS.active).toContain("paused")
  })
})

describe("updateCampaignFields", () => {
  it("applies only the changed fields and logs one updated row per field", async () => {
    getProject.mockResolvedValue(project())
    findOne.mockResolvedValue({ id: "campaign_1", userId: "owner", projectId: "proj_1", status: "draft", name: "Old", objective: "", channels: ["email"], plannedBudgetCents: null, utmCampaign: null, startDate: null, endDate: null })
    findOneAndUpdate.mockResolvedValue({ id: "campaign_1", userId: "owner", projectId: "proj_1", status: "draft", name: "New", objective: "", channels: ["email"], plannedBudgetCents: 5000, utmCampaign: null, startDate: null, endDate: null })
    const out = await updateCampaignFields({ userId: "owner", projectId: "proj_1", campaignId: "campaign_1", name: "New", plannedBudgetCents: 5000 })
    expect(out.name).toBe("New")
    const set = findOneAndUpdate.mock.calls[0][1].$set
    expect(set.name).toBe("New")
    expect(set.plannedBudgetCents).toBe(5000)
    const fields = insertHistory.mock.calls.map((c) => c[0].field)
    expect(fields).toEqual(expect.arrayContaining(["name", "plannedBudgetCents"]))
    expect(insertHistory).toHaveBeenCalledTimes(2)
  })

  it("does nothing when no field actually changes", async () => {
    getProject.mockResolvedValue(project())
    findOne.mockResolvedValue({ id: "campaign_1", userId: "owner", projectId: "proj_1", status: "draft", name: "Same", objective: "", channels: [], plannedBudgetCents: null, utmCampaign: null, startDate: null, endDate: null })
    const out = await updateCampaignFields({ userId: "owner", projectId: "proj_1", campaignId: "campaign_1", name: "Same" })
    expect(out.name).toBe("Same")
    expect(findOneAndUpdate).not.toHaveBeenCalled()
    expect(insertHistory).not.toHaveBeenCalled()
  })
})

describe("listCampaigns / getCampaignHistory", () => {
  it("queries tenant-scoped campaigns newest-first, optionally filtered by status", async () => {
    toArray.mockResolvedValue([])
    await listCampaigns("proj_1", { status: "active" })
    expect(find).toHaveBeenCalledWith({ projectId: "proj_1", status: "active" })
    expect(findChain.sort).toHaveBeenCalledWith({ updatedAt: -1 })
  })

  it("reads history oldest-first, tenant-scoped", async () => {
    toArray.mockResolvedValue([])
    await getCampaignHistory("proj_1", "campaign_1")
    expect(histFind).toHaveBeenCalledWith({ campaignId: "campaign_1", projectId: "proj_1" })
    expect(findChain.sort).toHaveBeenCalledWith({ createdAt: 1 })
  })
})
