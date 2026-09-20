import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

const { mockCheckRateLimit, mockGetConfig } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn(),
  mockGetConfig: vi.fn(),
}))

vi.mock("@/lib/auth/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock("./config-store", () => ({
  getCachedProjectRuntimeConfig: mockGetConfig,
}))

vi.mock("@/lib/errors", () => {
  class AppError extends Error {
    code: string
    constructor(code: string) {
      super(code)
      this.code = code
    }
  }
  return { AppError }
})

vi.mock("@/runtime/contracts/errors", () => ({
  runtimeError: (code: string) => {
    const e = new Error(code) as Error & { code: string }
    e.code = code
    return e
  },
}))

import { enforceProjectRuntimeLimits } from "./enforce-limits"

describe("enforceProjectRuntimeLimits", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue(undefined)
  })

  it("does not add a limiter when the project has no extra caps", async () => {
    mockGetConfig.mockResolvedValue({
      projectId: "proj_a",
      allowedModels: [],
      fallbackModels: [],
      allowEndUserModelSelection: true,
      limits: {},
      createdAt: 1,
      updatedAt: 1,
    })
    await enforceProjectRuntimeLimits({ projectId: "proj_a", environment: "production" })
    expect(mockCheckRateLimit).not.toHaveBeenCalled()
  })

  it("enforces project RPM through the existing limiter", async () => {
    mockGetConfig.mockResolvedValue({
      projectId: "proj_a",
      allowedModels: [],
      fallbackModels: [],
      allowEndUserModelSelection: true,
      limits: { requestsPerMinute: 40 },
      createdAt: 1,
      updatedAt: 1,
    })
    await enforceProjectRuntimeLimits({ projectId: "proj_a", environment: "production" })
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "runtime_project_rpm",
        identifier: "proj_a:production",
        limit: 40,
      }),
    )
  })
})
