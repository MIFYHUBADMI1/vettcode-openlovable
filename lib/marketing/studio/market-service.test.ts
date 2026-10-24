import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const {
  mockRouteRuntime,
  mockListApiKeys,
  mockGetProject,
  mockDeriveBrandVoice,
  mockInsertOne,
  mockUpdateOne,
  mockDeleteOne,
  mockContentFindOne,
  mockUsageFindOne,
  mockEnforceLimits,
  mockGetAvailableCredits,
} = vi.hoisted(() => ({
  mockRouteRuntime: vi.fn(),
  mockListApiKeys: vi.fn(),
  mockGetProject: vi.fn(),
  mockDeriveBrandVoice: vi.fn(),
  mockInsertOne: vi.fn(),
  mockUpdateOne: vi.fn(),
  mockDeleteOne: vi.fn(),
  mockContentFindOne: vi.fn(),
  mockUsageFindOne: vi.fn(),
  mockEnforceLimits: vi.fn(),
  mockGetAvailableCredits: vi.fn(),
}))

vi.mock("@/lib/logging/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock("@/lib/store/store", () => ({
  store: { getProject: mockGetProject },
}))

vi.mock("@/lib/store/id", () => ({
  cryptoId: () => "testid",
}))

vi.mock("@/lib/db/collections", () => ({
  contentItemsCol: async () => ({
    insertOne: mockInsertOne,
    findOne: mockContentFindOne,
    updateOne: mockUpdateOne,
    deleteOne: mockDeleteOne,
    find: () => ({
      sort: () => ({
        limit: () => ({
          toArray: async () => [],
        }),
      }),
    }),
  }),
}))

vi.mock("@/lib/db/runtime-collections", () => ({
  runtimeUsageCol: async () => ({ findOne: mockUsageFindOne }),
}))

vi.mock("@/lib/billing/credit-service", () => ({
  getAvailableCredits: mockGetAvailableCredits,
}))

vi.mock("@/lib/runtime/keys/service", () => ({
  listApiKeys: mockListApiKeys,
}))

vi.mock("@/lib/runtime/control/enforce-limits", () => ({
  enforceProjectRuntimeLimits: mockEnforceLimits,
}))

vi.mock("@/lib/runtime/router/adapters/availability", () => ({
  capabilityAvailability: () => ({
    "ai.text": { provider: "openrouter", configured: true, missingEnvVars: [], operations: [] },
    "ai.image": { provider: "openrouter", configured: true, missingEnvVars: [], operations: [] },
    "ai.speech": { provider: "openrouter", configured: true, missingEnvVars: [], operations: [] },
    "ai.video": { provider: "openrouter", configured: true, missingEnvVars: [], operations: [] },
  }),
}))

vi.mock("@/lib/runtime/router/router", () => ({
  routeRuntimeRequest: mockRouteRuntime,
}))

vi.mock("./generator", () => ({
  deriveBrandVoice: mockDeriveBrandVoice,
}))

import {
  deleteMarketContent,
  generateMarketContent,
  getMarketStudioState,
  pollMarketVideo,
  resolveProjectRuntimeIdentity,
  scopesCover,
} from "./market-service"

const PROJECT = { id: "p1", userId: "u1", name: "Acme", specification: {} }

let requestCounter = 0

beforeEach(() => {
  vi.clearAllMocks()
  requestCounter = 0

  mockGetProject.mockResolvedValue(PROJECT)
  mockDeriveBrandVoice.mockReturnValue({ voice: "Confident and concrete.", sources: ["Value proposition"] })
  mockListApiKeys.mockResolvedValue([])
  mockGetAvailableCredits.mockResolvedValue(500)
  mockUsageFindOne.mockResolvedValue({ creditsCharged: 7 })
  mockInsertOne.mockResolvedValue({ acknowledged: true })
  mockUpdateOne.mockResolvedValue({ modifiedCount: 1 })
  mockDeleteOne.mockResolvedValue({ deletedCount: 1 })
  mockEnforceLimits.mockResolvedValue(undefined)

  mockRouteRuntime.mockImplementation(async (_auth: unknown, request: { capability: string; operation: string }) => ({
    requestId: `req_${++requestCounter}`,
    capability: request.capability,
    operation: request.operation,
    data: { content: "Generated copy", model: "openai/test-model" },
  }))
})

describe("scopesCover", () => {
  it("treats an empty scope list as all capabilities", () => {
    expect(scopesCover([], "ai.text")).toBe(true)
  })

  it("accepts exact and dotted sub-scopes, and rejects unrelated ones", () => {
    expect(scopesCover(["ai.image"], "ai.image")).toBe(true)
    expect(scopesCover(["ai.image.generate"], "ai.image")).toBe(true)
    expect(scopesCover(["ai.text"], "ai.image")).toBe(false)
  })
})

describe("resolveProjectRuntimeIdentity", () => {
  it("prefers an active production key that covers the capability", async () => {
    mockListApiKeys.mockResolvedValue([
      {
        id: "rkey_dev",
        environment: "development",
        status: "active",
        scopes: [],
        keyPrefix: "atai_dev_abc",
        name: "Dev key",
        createdAt: 20,
      },
      {
        id: "rkey_prod",
        environment: "production",
        status: "active",
        scopes: ["ai.text"],
        keyPrefix: "atai_live_def",
        name: "Production key",
        createdAt: 10,
      },
    ])
    const identity = await resolveProjectRuntimeIdentity({ userId: "u1", projectId: "p1", capability: "ai.text" })
    expect(identity.keySource).toBe("project_api_key")
    expect(identity.auth.apiKeyId).toBe("rkey_prod")
    expect(identity.keyLabel).toContain("Production key")
  })

  it("skips revoked, expired, and scope-mismatched keys", async () => {
    mockListApiKeys.mockResolvedValue([
      { id: "revoked", environment: "production", status: "revoked", scopes: [], keyPrefix: "a", name: "r", createdAt: 3 },
      { id: "expired", environment: "production", status: "active", scopes: [], keyPrefix: "b", name: "e", createdAt: 2, expiresAt: Date.now() - 1_000 },
      { id: "wrong-scope", environment: "production", status: "active", scopes: ["ai.image"], keyPrefix: "c", name: "w", createdAt: 1 },
    ])
    const identity = await resolveProjectRuntimeIdentity({ userId: "u1", projectId: "p1", capability: "ai.text" })
    expect(identity.keySource).toBe("workspace")
    expect(identity.auth.scopes).toEqual([])
  })

  it("falls back to the workspace identity when the project has no keys", async () => {
    const identity = await resolveProjectRuntimeIdentity({ userId: "u1", projectId: "p1", capability: "ai.speech" })
    expect(identity.keySource).toBe("workspace")
    expect(identity.auth.projectId).toBe("p1")
    expect(identity.auth.userId).toBe("u1")
  })
})

describe("generateMarketContent", () => {
  it("generates text through the project runtime and persists an audit trail", async () => {
    const item = await generateMarketContent({
      userId: "u1",
      projectId: "p1",
      kind: "copy",
      brief: "Launch our analytics dashboard",
      tone: "confident",
      length: "short",
    })

    expect(mockRouteRuntime).toHaveBeenCalledTimes(1)
    const [auth, request] = mockRouteRuntime.mock.calls[0]
    expect(auth).toMatchObject({ userId: "u1", projectId: "p1" })
    expect(request).toMatchObject({ capability: "ai.text", operation: "chat" })

    expect(item.body).toBe("Generated copy")
    expect(item.creditsCharged).toBe(7)
    expect(item.runtime.keySource).toBe("workspace")
    expect(item.runtime.calls).toHaveLength(1)
    expect(item.media).toBeUndefined()

    const doc = mockInsertOne.mock.calls[0][0]
    expect(doc).toMatchObject({
      kind: "marketing_asset",
      assetKind: "copy",
      projectId: "p1",
      userId: "u1",
      body: "Generated copy",
      creditsCharged: 7,
    })
    expect(doc.runtime.calls[0]).toMatchObject({ capability: "ai.text", creditsCharged: 7 })
  })

  it("returns and stores an image as a data URL", async () => {
    mockRouteRuntime.mockResolvedValue({
      requestId: "req_image",
      capability: "ai.image",
      operation: "generateImage",
      data: { images: [{ b64: "aGVsbG8=", mediaType: "image/webp" }] },
    })

    const item = await generateMarketContent({
      userId: "u1",
      projectId: "p1",
      kind: "image",
      brief: "A founder using the dashboard",
      aspectRatio: "4:5",
    })

    expect(item.kind).toBe("image")
    expect(item.media?.kind).toBe("image")
    expect(item.media?.dataUrl).toBe("data:image/webp;base64,aGVsbG8=")
    const request = mockRouteRuntime.mock.calls[0][1]
    expect(request.input).toMatchObject({ aspect_ratio: "4:5", output_format: "webp", n: 1 })
    expect(String(request.input.model)).toContain("image")
  })

  it("performs a provided voice script without a second text call", async () => {
    mockRouteRuntime.mockResolvedValue({
      requestId: "req_audio",
      capability: "ai.speech",
      operation: "speak",
      data: { audioBase64: "YXVkaW8=", mimeType: "audio/mpeg" },
    })

    const item = await generateMarketContent({
      userId: "u1",
      projectId: "p1",
      kind: "voice",
      brief: "Product teaser",
      script: "Meet the dashboard that explains itself.",
      voiceStyle: "warm",
    })

    expect(mockRouteRuntime).toHaveBeenCalledTimes(1)
    expect(mockRouteRuntime.mock.calls[0][1].input).toMatchObject({
      input: "Meet the dashboard that explains itself.",
      response_format: "mp3",
    })
    expect(item.media?.dataUrl).toBe("data:audio/mpeg;base64,YXVkaW8=")
    expect(item.body).toBe("Meet the dashboard that explains itself.")
  })

  it("fails closed on someone else's project", async () => {
    mockGetProject.mockResolvedValue({ ...PROJECT, userId: "someone_else" })
    await expect(
      generateMarketContent({ userId: "u1", projectId: "p1", kind: "copy", brief: "x" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED_PROJECT_ACCESS" })
    expect(mockRouteRuntime).not.toHaveBeenCalled()
  })

  it("rejects an empty brief", async () => {
    await expect(
      generateMarketContent({ userId: "u1", projectId: "p1", kind: "copy", brief: "   " }),
    ).rejects.toMatchObject({ code: "VALIDATION" })
  })
})

describe("pollMarketVideo", () => {
  it("updates the existing asset instead of creating a second one", async () => {
    mockContentFindOne.mockResolvedValue({
      id: "content_1",
      userId: "u1",
      projectId: "p1",
      kind: "marketing_asset",
      assetKind: "video",
      template: "market_studio",
      status: "draft",
      title: "Video for Acme",
      body: "prompt",
      version: 1,
      origin: "ai_generated_marketing_content",
      creditsCharged: 50,
      model: "google/veo-3",
      media: { kind: "video", jobId: "job_1", status: "submitted" },
      runtime: {
        keySource: "workspace",
        apiKeyId: "rkey_workspace_p1",
        keyLabel: "Workspace session",
        calls: [],
        totalCreditsCharged: 50,
      },
      brief: { brief: "Storefront" },
      createdAt: 1,
      updatedAt: 1,
    })
    mockRouteRuntime.mockResolvedValue({
      requestId: "req_poll",
      capability: "ai.video",
      operation: "generateVideo",
      data: { jobId: "job_1", status: "completed", raw: { url: "https://cdn.example/clip.mp4" } },
    })

    const item = await pollMarketVideo({ userId: "u1", projectId: "p1", contentId: "content_1" })

    expect(mockUpdateOne).toHaveBeenCalledTimes(1)
    expect(mockInsertOne).not.toHaveBeenCalled()
    expect(item.media?.status).toBe("completed")
    expect(item.media?.providerOutput).toEqual({ url: "https://cdn.example/clip.mp4" })
    expect(item.creditsCharged).toBe(57)
  })
})

describe("deleteMarketContent", () => {
  it("deletes only an asset owned by this user in this project", async () => {
    const deleted = await deleteMarketContent({ userId: "u1", projectId: "p1", contentId: "content_1" })
    expect(deleted).toBe(true)
    expect(mockDeleteOne).toHaveBeenCalledWith({
      id: "content_1",
      projectId: "p1",
      userId: "u1",
      kind: "marketing_asset",
    })
  })
})

describe("getMarketStudioState", () => {
  it("reports capability readiness, credit balance, and the runtime identity", async () => {
    const state = await getMarketStudioState("u1", "p1")
    expect(state.capabilities.every((capability) => capability.available)).toBe(true)
    expect(state.creditsAvailable).toBe(500)
    expect(state.key.source).toBe("workspace")
    expect(state.textConfigured).toBe(true)
  })
})
