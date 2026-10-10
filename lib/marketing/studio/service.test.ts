import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

// Only the network call is stubbed; the pure prompt/voice layer stays real.
const generateCopy = vi.fn()
vi.mock("./generator", async (importActual) => {
  const actual = await importActual<typeof import("./generator")>()
  return { ...actual, generateCopy: (...a: unknown[]) => generateCopy(...a) }
})

const insertOne = vi.fn()
const findOne = vi.fn()
const toArray = vi.fn()
const findChain = { sort: vi.fn(() => findChain), limit: vi.fn(() => findChain), toArray }
const find = vi.fn(() => findChain)
vi.mock("@/lib/db/collections", () => ({
  contentItemsCol: vi.fn(async () => ({ insertOne, findOne, find })),
}))

const getProject = vi.fn()
vi.mock("@/lib/store/store", () => ({
  store: { getProject: (...a: unknown[]) => getProject(...a) },
  cryptoId: () => "testid",
}))

import { generateMarketingDraft, reviseContentItem, listContentItems } from "./service"

/**
 * Marketing Studio service (Phase 4 — W3). Proves the drafts persist with the
 * content-vs-spec-prose origin guard, editing appends an immutable version, and
 * ownership is enforced fail-closed WITHOUT ever calling the model.
 */

function project(over: Record<string, unknown> = {}) {
  return { id: "proj_1", userId: "owner", name: "Acme", specification: { brandIdentity: "Bold", valueProposition: "Ship fast" }, ...over }
}

beforeEach(() => {
  vi.clearAllMocks()
  insertOne.mockResolvedValue({ acknowledged: true })
  generateCopy.mockResolvedValue({ text: "Generated copy body", model: "openrouter/auto" })
})

describe("generateMarketingDraft", () => {
  it("persists a v1 draft labeled as AI-generated marketing content", async () => {
    getProject.mockResolvedValue(project())
    const out = await generateMarketingDraft({ userId: "owner", projectId: "proj_1", template: "landing_hero" })
    expect(out.version).toBe(1)
    expect(out.body).toBe("Generated copy body")
    const doc = insertOne.mock.calls[0][0]
    expect(doc.origin).toBe("ai_generated_marketing_content")
    expect(doc.status).toBe("draft")
    expect(doc.version).toBe(1)
    expect(doc.userId).toBe("owner")
    expect(doc.projectId).toBe("proj_1")
    // There is no publish/scheduling field of any kind.
    expect(doc).not.toHaveProperty("publishedAt")
    expect(doc).not.toHaveProperty("scheduledFor")
    // Brand voice + project name were fed to the model.
    const genArg = generateCopy.mock.calls[0][0]
    expect(genArg.projectName).toBe("Acme")
    expect(genArg.brandVoice).toMatch(/Bold|Ship fast/)
  })

  it("refuses a non-owner WITHOUT generating or persisting", async () => {
    getProject.mockResolvedValue(project({ userId: "someone_else" }))
    await expect(generateMarketingDraft({ userId: "owner", projectId: "proj_1", template: "feature_blurb" })).rejects.toMatchObject({ code: "UNAUTHORIZED_PROJECT_ACCESS" })
    expect(generateCopy).not.toHaveBeenCalled()
    expect(insertOne).not.toHaveBeenCalled()
  })

  it("rejects an unknown template before touching the model", async () => {
    getProject.mockResolvedValue(project())
    await expect(generateMarketingDraft({ userId: "owner", projectId: "proj_1", template: "publish_to_instagram" as never })).rejects.toMatchObject({ code: "VALIDATION" })
    expect(generateCopy).not.toHaveBeenCalled()
  })
})

describe("reviseContentItem", () => {
  it("appends an immutable next version chained to the original (free, still a draft)", async () => {
    findOne.mockResolvedValue({ id: "content_parent", userId: "owner", projectId: "proj_1", template: "landing_hero", title: "Landing hero for Acme", body: "old", version: 1, origin: "ai_generated_marketing_content" })
    const doc = await reviseContentItem({ userId: "owner", projectId: "proj_1", contentId: "content_parent", body: "  revised copy  " })
    expect(doc.version).toBe(2)
    expect(doc.parentContentId).toBe("content_parent")
    expect(doc.body).toBe("revised copy")
    expect(doc.creditsCharged).toBe(0)
    expect(doc.status).toBe("draft")
    expect(doc.origin).toBe("ai_generated_marketing_content")
    // The parent is looked up tenant-scoped, never overwritten.
    expect(findOne).toHaveBeenCalledWith({ id: "content_parent", projectId: "proj_1" })
    expect(insertOne).toHaveBeenCalledTimes(1)
  })

  it("refuses to revise content that is not the caller's", async () => {
    findOne.mockResolvedValue({ id: "content_x", userId: "someone_else", projectId: "proj_1", template: "landing_hero", version: 1, body: "y", title: "t", origin: "ai_generated_marketing_content" })
    await expect(reviseContentItem({ userId: "owner", projectId: "proj_1", contentId: "content_x", body: "new" })).rejects.toMatchObject({ code: "UNAUTHORIZED_PROJECT_ACCESS" })
    expect(insertOne).not.toHaveBeenCalled()
  })

  it("rejects an empty revision", async () => {
    findOne.mockResolvedValue({ id: "content_parent", userId: "owner", projectId: "proj_1", template: "landing_hero", version: 1, body: "y", title: "t", origin: "ai_generated_marketing_content" })
    await expect(reviseContentItem({ userId: "owner", projectId: "proj_1", contentId: "content_parent", body: "   " })).rejects.toMatchObject({ code: "VALIDATION" })
  })
})

describe("listContentItems", () => {
  it("queries tenant-scoped drafts newest-first", async () => {
    toArray.mockResolvedValue([])
    await listContentItems("proj_1")
    expect(find).toHaveBeenCalledWith({ projectId: "proj_1" })
    expect(findChain.sort).toHaveBeenCalledWith({ updatedAt: -1 })
  })
})
