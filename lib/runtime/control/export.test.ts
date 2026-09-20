/**
 * Unit tests for the bounded Usage-page CSV export service.
 *
 * Focus: RFC-4180 correctness, formula-injection safety, the honest
 * unavailable-cost representation (empty, never $0), the hard row cap with
 * its explicit truncation marker, and filter/range reuse from the analytics
 * module (export must match the page's semantics exactly).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

const { mockToArray, mockCountDocuments, mockFind, mockLimit } = vi.hoisted(() => ({
  mockToArray: vi.fn().mockResolvedValue([]),
  mockCountDocuments: vi.fn().mockResolvedValue(0),
  mockFind: vi.fn(),
  mockLimit: vi.fn(),
}))

vi.mock("@/lib/db/runtime-collections", () => ({
  ensureRuntimeIndexes: vi.fn().mockResolvedValue(undefined),
  runtimeUsageCol: vi.fn().mockResolvedValue({
    find: mockFind,
    countDocuments: mockCountDocuments,
  }),
}))

import { buildUsageCsv, MAX_EXPORT_ROWS } from "./export"
import { MAX_RANGE_MS } from "./analytics"
import type { RuntimeUsageEvent } from "@/runtime/contracts/capabilities"

function event(overrides: Partial<RuntimeUsageEvent> = {}): RuntimeUsageEvent {
  return {
    id: "evt_1",
    requestId: "rtreq_1",
    apiKeyId: "key_1",
    environment: "production",
    capability: "ai.text",
    operation: "chat",
    provider: "openrouter",
    model: "openai/gpt-4o-mini",
    status: "succeeded",
    latencyMs: 120,
    creditsCharged: 15,
    createdAt: 1_758_000_000_000,
    usage: { inputTokens: 10, outputTokens: 20 },
    costMetadata: { providerCost: 0.00042, providerCostCurrency: "USD" },
    ...overrides,
  } as RuntimeUsageEvent
}

function wire(docs: RuntimeUsageEvent[], total?: number) {
  mockToArray.mockResolvedValue(docs)
  mockCountDocuments.mockResolvedValue(total ?? docs.length)
  mockFind.mockReturnValue({
    sort: vi.fn().mockReturnThis(),
    limit: mockLimit.mockReturnValue({ toArray: mockToArray }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  wire([])
})

describe("buildUsageCsv", () => {
  it("emits the header plus one row per event with numeric provider cost", async () => {
    wire([event()])
    const { csv, rowCount, truncated } = await buildUsageCsv("proj_1", {})

    const lines = csv.trim().split("\r\n")
    expect(lines[0]).toBe(
      "request_id,timestamp_utc,environment,api_key_id,capability,operation,provider,model,status,latency_ms,credits_charged,provider_cost_usd,error_category",
    )
    expect(lines[1]).toContain("rtreq_1")
    expect(lines[1]).toContain("ai.text")
    expect(lines[1]).toContain("0.00042")
    expect(rowCount).toBe(1)
    expect(truncated).toBe(false)
  })

  it("leaves provider cost EMPTY (never $0) when unavailable", async () => {
    wire([event({ costMetadata: {} })])
    const { csv } = await buildUsageCsv("proj_1", {})
    const row = csv.trim().split("\r\n")[1]
    // ...credits,error_category → the cost cell sits between them, empty.
    expect(row).toMatch(/,15,,$/)
    expect(row).not.toContain("$0")
  })

  it("escapes commas and quotes per RFC 4180", async () => {
    wire([event({ requestId: 'weird,id"x' })])
    const { csv } = await buildUsageCsv("proj_1", {})
    expect(csv).toContain('"weird,id""x"')
  })

  it("neutralizes spreadsheet formula prefixes", async () => {
    wire([event({ capability: "=SUM(A1:A9)" })])
    const { csv } = await buildUsageCsv("proj_1", {})
    expect(csv).toContain("'=SUM(A1:A9)")
  })

  it("caps the query at MAX_EXPORT_ROWS and marks truncation explicitly", async () => {
    const docs = Array.from({ length: MAX_EXPORT_ROWS }, (_, i) => event({ id: `evt_${i}`, requestId: `rtreq_${i}` }))
    wire(docs, MAX_EXPORT_ROWS + 37)
    const { csv, rowCount, truncated, totalMatching } = await buildUsageCsv("proj_1", {})

    expect(mockLimit).toHaveBeenCalledWith(MAX_EXPORT_ROWS)
    expect(rowCount).toBe(MAX_EXPORT_ROWS)
    expect(totalMatching).toBe(MAX_EXPORT_ROWS + 37)
    expect(truncated).toBe(true)
    expect(csv).toContain(`EXPORT TRUNCATED: 37 older event(s) omitted`)
  })

  it("does not add a truncation marker when everything fits", async () => {
    wire([event()])
    const { csv } = await buildUsageCsv("proj_1", {})
    expect(csv).not.toContain("EXPORT TRUNCATED")
  })

  it("reuses the shared 90-day range clamp", async () => {
    wire([])
    const to = Date.now()
    const from = to - 200 * 24 * 60 * 60 * 1000 // far beyond the window
    await buildUsageCsv("proj_1", { from, to })

    const filter = mockFind.mock.calls[0][0] as { createdAt: { $gte: number; $lte: number } }
    expect(filter.createdAt.$lte - filter.createdAt.$gte).toBeLessThanOrEqual(MAX_RANGE_MS)
  })

  it("applies the same filter semantics as the usage list API", async () => {
    wire([])
    await buildUsageCsv("proj_1", {
      environment: "production",
      status: "failed",
      capability: "ai.text",
      model: "openai/gpt-4o-mini",
      apiKeyId: "key_1",
      requestId: "rtreq_9",
    })

    const filter = mockFind.mock.calls[0][0] as Record<string, unknown>
    expect(filter).toMatchObject({
      projectId: "proj_1",
      environment: "production",
      status: "failed",
      capability: "ai.text",
      model: "openai/gpt-4o-mini",
      apiKeyId: "key_1",
      requestId: "rtreq_9",
    })
  })

  it("scopes every query to the project id", async () => {
    wire([event()])
    const { csv } = await buildUsageCsv("proj_owned", {})
    const filter = mockFind.mock.calls[0][0] as Record<string, unknown>
    expect(filter.projectId).toBe("proj_owned")
    expect(csv).toBeDefined()
  })

  it("returns a header-only file with rowCount 0 for an empty window", async () => {
    wire([])
    const { csv, rowCount, truncated } = await buildUsageCsv("proj_1", {})
    const lines = csv.trim().split("\r\n")
    expect(lines).toHaveLength(1)
    expect(lines[0].startsWith("request_id,")).toBe(true)
    expect(rowCount).toBe(0)
    expect(truncated).toBe(false)
  })

  it("names the file after the clamped window", async () => {
    wire([])
    const to = 1_758_000_000_000
    const { filename } = await buildUsageCsv("proj_1", { from: to - 24 * 60 * 60 * 1000, to })
    expect(filename).toMatch(/^atai-runtime-usage_\d{4}-\d{2}-\d{2}_to_\d{4}-\d{2}-\d{2}\.csv$/)
  })
})
