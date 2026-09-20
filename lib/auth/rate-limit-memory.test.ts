import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockFindOneAndUpdate } = vi.hoisted(() => ({
  mockFindOneAndUpdate: vi.fn(),
}))

vi.mock("@/lib/db/collections", () => ({
  rateLimitsCol: vi.fn(async () => ({
    findOneAndUpdate: mockFindOneAndUpdate,
    updateOne: vi.fn(),
  })),
  ensureIndexes: vi.fn(async () => undefined),
}))

import { checkRateLimit, resetMemoryRateLimitForTests } from "./rate-limit"
import { AppError } from "@/lib/errors"

describe("in-process rate-limit overlay", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMemoryRateLimitForTests()
  })

  it("does not hit Mongo again once this process has already exceeded the window", async () => {
    mockFindOneAndUpdate.mockResolvedValue({ count: 4 })
    await expect(
      checkRateLimit({ action: "runtime_auth_fail", identifier: "h", limit: 3, windowMs: 60_000 }),
    ).rejects.toBeInstanceOf(AppError)
    expect(mockFindOneAndUpdate).toHaveBeenCalledTimes(1)

    mockFindOneAndUpdate.mockClear()
    await expect(
      checkRateLimit({ action: "runtime_auth_fail", identifier: "h", limit: 3, windowMs: 60_000 }),
    ).rejects.toBeInstanceOf(AppError)
    expect(mockFindOneAndUpdate).not.toHaveBeenCalled()
  })
})
