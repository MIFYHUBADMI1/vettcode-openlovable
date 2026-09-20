import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

const { mockFindOne, mockUpdateOne } = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockUpdateOne: vi.fn(),
}))

vi.mock("@/lib/db/runtime-collections", () => ({
  projectRuntimeConfigCol: vi.fn().mockResolvedValue({
    findOne: mockFindOne,
    updateOne: mockUpdateOne,
  }),
  ensureRuntimeIndexes: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/logging/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import {
  getProjectRuntimeConfig,
  patchProjectRuntimeConfig,
  ConfigValidationError,
  clearProjectRuntimeConfigCache,
} from "./config-store"

describe("project runtime config", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearProjectRuntimeConfigCache()
    mockFindOne.mockResolvedValue(null)
    mockUpdateOne.mockResolvedValue({ upsertedCount: 1 })
  })

  it("returns unrestricted defaults when no document exists", async () => {
    const cfg = await getProjectRuntimeConfig("proj_a")
    expect(cfg.allowedModels).toEqual([])
    expect(cfg.allowEndUserModelSelection).toBe(true)
    expect(cfg.limits).toEqual({})
  })

  it("rejects rpm above the platform ceiling", async () => {
    await expect(
      patchProjectRuntimeConfig("user_1", "proj_a", { limits: { requestsPerMinute: 500 } }),
    ).rejects.toBeInstanceOf(ConfigValidationError)
  })

  it("rejects a default model outside the allowlist", async () => {
    await expect(
      patchProjectRuntimeConfig("user_1", "proj_a", {
        defaultModel: "openai/gpt-4o",
        allowedModels: ["openai/gpt-4o-mini"],
      }),
    ).rejects.toBeInstanceOf(ConfigValidationError)
  })

  it("persists a valid patch", async () => {
    mockFindOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        projectId: "proj_a",
        userId: "user_1",
        defaultModel: "openai/gpt-4o-mini",
        allowedModels: ["openai/gpt-4o-mini"],
        fallbackModels: [],
        allowEndUserModelSelection: false,
        limits: { requestsPerMinute: 60 },
        createdAt: 1,
        updatedAt: 2,
      })
    const saved = await patchProjectRuntimeConfig("user_1", "proj_a", {
      defaultModel: "openai/gpt-4o-mini",
      allowedModels: ["openai/gpt-4o-mini"],
      allowEndUserModelSelection: false,
      limits: { requestsPerMinute: 60 },
    })
    expect(mockUpdateOne).toHaveBeenCalled()
    expect(saved.defaultModel).toBe("openai/gpt-4o-mini")
    expect(saved.allowEndUserModelSelection).toBe(false)
    expect(saved.limits.requestsPerMinute).toBe(60)
  })
})
