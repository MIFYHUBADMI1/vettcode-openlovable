/**
 * Runtime Control Center — breakdown aggregations & period estimate tests.
 *
 * Verifies: project scoping (every aggregation filters by projectId +
 * createdAt), environment filtering, error-only filtering, per-row numeric
 * integrity (unavailable provider cost is null, never 0), row caps, and the
 * clearly-labeled insufficient-data path of the period estimate.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

const { mockAggregate, mockCollection } = vi.hoisted(() => {
  const mockAggregate = vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) })
  return {
    mockAggregate,
    mockCollection: { aggregate: mockAggregate },
  }
})

vi.mock("@/lib/db/runtime-collections", () => ({
  runtimeUsageCol: vi.fn().mockResolvedValue(mockCollection),
  ensureRuntimeIndexes: vi.fn().mockResolvedValue(undefined),
}))

import {
  breakdownByApiKey,
  breakdownByCapability,
  breakdownByError,
  breakdownByModel,
  estimatePeriodUsage,
} from "./breakdown"

function capturedPipeline(): Array<Record<string, unknown>> {
  expect(mockAggregate).toHaveBeenCalled()
  return mockAggregate.mock.calls[mockAggregate.mock.calls.length - 1][0] as Array<Record<string, unknown>>
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAggregate.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) })
})

describe("breakdown aggregations", () => {
  it("scopes every aggregation to the project and a bounded createdAt window", async () => {
    await breakdownByApiKey("proj_a", {})
    const pipeline = capturedPipeline()
    const match = pipeline[0].$match as Record<string, unknown>
    expect(match.projectId).toBe("proj_a")
    const created = match.createdAt as { $gte: number; $lte: number }
    expect(created.$gte).toBeLessThan(created.$lte)
  })

  it("applies the environment filter when provided", async () => {
    await breakdownByCapability("proj_a", { environment: "production" })
    const match = capturedPipeline()[0].$match as Record<string, unknown>
    expect(match.environment).toBe("production")
  })

  it("omits the environment filter when not provided", async () => {
    await breakdownByCapability("proj_a", {})
    const match = capturedPipeline()[0].$match as Record<string, unknown>
    expect(match.environment).toBeUndefined()
  })

  it("groups by capability and caps rows at 50", async () => {
    await breakdownByCapability("proj_a", {})
    const pipeline = capturedPipeline()
    expect(JSON.stringify(pipeline.some((s) => "$group" in s))).toBe("true")
    const limit = pipeline.find((s) => "$limit" in s) as { $limit: number }
    expect(limit.$limit).toBe(50)
  })

  it("error breakdown filters to failed requests only", async () => {
    await breakdownByError("proj_a", {})
    const match = capturedPipeline()[0].$match as Record<string, unknown>
    expect(match.status).toBe("failed")
  })

  it("maps rows: numeric provider cost summed, missing cost stays null (never 0)", async () => {
    mockAggregate.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          _id: "ai.text",
          requests: 10,
          succeeded: 9,
          failed: 1,
          creditsCharged: 120,
          totalLatencyMs: 2_500,
          providerCostUsd: 0,
          providerNumeric: 0,
          providerCostUnavailableCount: 10,
        },
      ]),
    })
    const rows = await breakdownByCapability("proj_a", {})
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      key: "ai.text",
      requests: 10,
      succeeded: 9,
      failed: 1,
      creditsCharged: 120,
      avgLatencyMs: 250,
      providerCostUsd: null,
      providerCostUnavailableCount: 10,
    })
  })

  it("sums numeric provider cost when the provider reported it", async () => {
    mockAggregate.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          _id: "openai/gpt-4o-mini",
          requests: 4,
          succeeded: 4,
          failed: 0,
          creditsCharged: 0,
          totalLatencyMs: 400,
          providerCostUsd: 0.048,
          providerNumeric: 4,
          providerCostUnavailableCount: 0,
        },
      ]),
    })
    const rows = await breakdownByModel("proj_a", {})
    expect(rows[0].providerCostUsd).toBeCloseTo(0.048, 6)
    expect(rows[0].providerCostUnavailableCount).toBe(0)
  })
})

describe("estimatePeriodUsage", () => {
  it("returns insufficientData (no fabricated numbers) for sparse usage", async () => {
    mockAggregate.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        { requests: 3, creditsCharged: 30, providerCostUsd: 0, providerNumeric: 0, firstAt: Date.now() - 1_000 },
      ]),
    })
    const estimate = await estimatePeriodUsage("proj_a", {})
    expect(estimate.insufficientData).toBe(true)
    expect(estimate.kind).toBe("estimate")
    expect(estimate.observedRequests).toBe(3)
    expect(estimate.projectedCredits).toBe(0)
  })

  it("returns insufficientData when observation spans less than 24h even with many requests", async () => {
    mockAggregate.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          requests: 500,
          creditsCharged: 5_000,
          providerCostUsd: 0,
          providerNumeric: 0,
          firstAt: Date.now() - 60 * 60 * 1_000,
        },
      ]),
    })
    const estimate = await estimatePeriodUsage("proj_a", {})
    expect(estimate.insufficientData).toBe(true)
  })

  it("projects the observed rate onto 30 days when data is sufficient", async () => {
    const now = Date.now()
    mockAggregate.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          requests: 3_000,
          creditsCharged: 30_000,
          providerCostUsd: 3,
          providerNumeric: 3_000,
          firstAt: now - 10 * 24 * 60 * 60 * 1_000,
        },
      ]),
    })
    const estimate = await estimatePeriodUsage("proj_a", { from: now - 10 * 24 * 60 * 60 * 1_000, to: now })
    expect(estimate.insufficientData).toBe(false)
    expect(estimate.kind).toBe("estimate")
    // 300 requests/day × 30 days = 9,000.
    expect(estimate.projectedRequests).toBe(9_000)
    expect(estimate.projectedCredits).toBe(90_000)
    expect(estimate.projectedProviderCostUsd).toBeCloseTo(9, 0)
    expect(estimate.basis).toContain("30 days")
  })

  it("reports provider cost as unavailable (null) when no event carried one", async () => {
    const now = Date.now()
    mockAggregate.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        {
          requests: 3_000,
          creditsCharged: 30_000,
          providerCostUsd: 0,
          providerNumeric: 0,
          firstAt: now - 10 * 24 * 60 * 60 * 1_000,
        },
      ]),
    })
    const estimate = await estimatePeriodUsage("proj_a", {})
    expect(estimate.insufficientData).toBe(false)
    expect(estimate.projectedProviderCostUsd).toBeNull()
  })
})
