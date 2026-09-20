/**
 * GET /api/projects/[id]/runtime/usage/export — bounded CSV export route.
 *
 * Exercises the route boundary: ownership gate (404, no existence leak),
 * per-user rate limiting, validation of range params, CSV response shape,
 * and the honesty headers (row count / truncation / cap).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

const { mockRequireUser, mockCheckOwnership, mockCheckRateLimit, mockToArray, mockCountDocuments, mockFind } =
  vi.hoisted(() => ({
    mockRequireUser: vi.fn(),
    mockCheckOwnership: vi.fn(),
    mockCheckRateLimit: vi.fn().mockResolvedValue(undefined),
    mockToArray: vi.fn().mockResolvedValue([]),
    mockCountDocuments: vi.fn().mockResolvedValue(0),
    mockFind: vi.fn(),
  }))

vi.mock("@/lib/auth/session", () => ({
  requireUser: mockRequireUser,
}))

vi.mock("@/lib/runtime/ownership", () => ({
  checkProjectOwnership: mockCheckOwnership,
}))

vi.mock("@/lib/auth/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock("@/lib/db/runtime-collections", () => ({
  ensureRuntimeIndexes: vi.fn().mockResolvedValue(undefined),
  runtimeUsageCol: vi.fn().mockResolvedValue({
    find: mockFind,
    countDocuments: mockCountDocuments,
  }),
}))

import { GET } from "./route"
import { AppError } from "@/lib/errors"
import { MAX_EXPORT_ROWS } from "@/lib/runtime/control/export"

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_1",
    requestId: "rtreq_1",
    apiKeyId: "key_1",
    environment: "production",
    capability: "ai.text",
    provider: "openrouter",
    status: "succeeded",
    latencyMs: 100,
    creditsCharged: 5,
    createdAt: 1_758_000_000_000,
    costMetadata: {},
    ...overrides,
  }
}

function wire(docs: unknown[], total = docs.length) {
  mockToArray.mockResolvedValue(docs)
  mockCountDocuments.mockResolvedValue(total)
  mockFind.mockReturnValue({
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnValue({ toArray: mockToArray }),
  })
}

function call(id = "proj_1", query = "") {
  return GET(new Request(`http://localhost/api/projects/${id}/runtime/usage/export${query}`), {
    params: Promise.resolve({ id }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckRateLimit.mockResolvedValue(undefined)
  mockRequireUser.mockResolvedValue({ id: "user_1" })
  mockCheckOwnership.mockResolvedValue({ ok: true })
  wire([])
})

describe("usage export route", () => {
  it("returns 404 (no existence leak) when the project is missing or not owned", async () => {
    mockCheckOwnership.mockResolvedValue({ ok: false })
    const res = await call("proj_foreign")
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("UNAUTHORIZED_PROJECT_ACCESS")
  })

  it("rate-limits exports per user", async () => {
    mockCheckRateLimit.mockRejectedValue(new AppError("RATE_LIMITED"))
    const res = await call()
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe("RATE_LIMITED")
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "runtime-usage-export", identifier: "user_1" }),
    )
  })

  it("rejects invalid range params", async () => {
    const res = await call("proj_1", "?from=notanumber")
    expect(res.status).toBe(422)
  })

  it("streams a CSV attachment with honesty headers", async () => {
    wire([event()], 1)
    const res = await call("proj_1", "?environment=production&status=failed")

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/csv")
    expect(res.headers.get("content-disposition")).toContain("attachment; filename=atai-runtime-usage_")
    expect(res.headers.get("x-export-rows")).toBe("1")
    expect(res.headers.get("x-export-truncated")).toBe("false")
    expect(res.headers.get("x-export-max-rows")).toBe(String(MAX_EXPORT_ROWS))
    expect(res.headers.get("cache-control")).toBe("no-store")

    const csv = await res.text()
    expect(csv.startsWith("request_id,timestamp_utc,")).toBe(true)
    expect(csv).toContain("rtreq_1")

    // Filters flow through to the shared matchFilter logic.
    const filter = mockFind.mock.calls[0][0] as Record<string, unknown>
    expect(filter).toMatchObject({ projectId: "proj_1", environment: "production", status: "failed" })
  })

  it("marks the export truncated when the row cap cut events off", async () => {
    wire([event()], MAX_EXPORT_ROWS + 5)
    const res = await call()
    expect(res.headers.get("x-export-truncated")).toBe("true")
    expect(res.headers.get("x-export-total-matching")).toBe(String(MAX_EXPORT_ROWS + 5))
    const csv = await res.text()
    // File holds 1 row; omitted = 1005 matching − 1 in file.
    expect(csv).toContain(`EXPORT TRUNCATED: ${MAX_EXPORT_ROWS + 4} older event(s) omitted`)
  })
})
