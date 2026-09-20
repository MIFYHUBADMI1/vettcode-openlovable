/**
 * Atai Runtime — usage service + contracts tests (Phase 2 §34: runtime usage
 * documents, attribution fields, contract validation, billing vocabulary).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// Repo runs Vitest outside the Next server bundle — mock the marker package.
vi.mock("server-only", () => ({}))

const { mockInsertOne, mockFind } = vi.hoisted(() => ({
  mockInsertOne: vi.fn().mockResolvedValue({ insertedId: "mock-id" }),
  mockFind: vi.fn().mockReturnValue({
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue([]),
  }),
}))

vi.mock("@/lib/db/runtime-collections", () => ({
  runtimeUsageCol: vi.fn().mockResolvedValue({
    insertOne: mockInsertOne,
    find: mockFind,
  }),
  ensureRuntimeIndexes: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/store/id", () => ({
  cryptoId: vi.fn().mockReturnValue("rusage-test-id"),
}))

vi.mock("@/lib/logging/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { recordUsage, listUsageByProject, listUsageByUser, makeUsageEvent } from "./usage"
import {
  RuntimeUsageEventSchema,
  CapabilityIdSchema,
  CapabilityScopeSchema,
  formatRequestId,
} from "../../runtime/contracts/capabilities"
import {
  runtimeUsageIdempotencyKey,
  isRuntimeTransactionType,
  RUNTIME_LEDGER_TRANSACTION_TYPES,
} from "../../runtime/contracts/billing"

function validEvent() {
  return {
    id: "rusage_1",
    requestId: "rtreq_abc",
    userId: "user_1",
    projectId: "proj_1",
    apiKeyId: "rkey_1",
    environment: "production" as const,
    capability: "ai.text",
    provider: "openrouter",
    model: "test/model",
    status: "succeeded" as const,
    latencyMs: 120,
    creditsCharged: 5,
    createdAt: Date.now(),
  }
}

describe("runtime usage service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsertOne.mockResolvedValue({ insertedId: "mock-id" })
  })

  it("persists a valid usage event with all attribution fields", async () => {
    const ok = await recordUsage(validEvent())
    expect(ok).toBe(true)
    const doc = mockInsertOne.mock.calls[0][0]
    expect(doc.requestId).toBe("rtreq_abc")
    expect(doc.userId).toBe("user_1")
    expect(doc.projectId).toBe("proj_1")
    expect(doc.apiKeyId).toBe("rkey_1")
  })

  it("drops invalid events (missing attribution) without throwing", async () => {
    const bad = validEvent() as Record<string, unknown>
    delete bad.userId
    const ok = await recordUsage(bad as never)
    expect(ok).toBe(false)
    expect(mockInsertOne).not.toHaveBeenCalled()
  })

  it("never throws on DB failure (telemetry must not fail requests)", async () => {
    mockInsertOne.mockRejectedValue(new Error("db down"))
    await expect(recordUsage(validEvent())).resolves.toBe(false)
    expect(mockInsertOne.mock.calls.length).toBe(3)
  })

  it("retries a transient usage write and succeeds", async () => {
    mockInsertOne.mockRejectedValueOnce(new Error("db down")).mockResolvedValueOnce({ insertedId: "mock-id" })
    await expect(recordUsage(validEvent())).resolves.toBe(true)
    expect(mockInsertOne.mock.calls.length).toBe(2)
  })

  it("queries project/user usage with attribution filters", async () => {
    await listUsageByProject("proj_1", { limit: 5 })
    expect(mockFind.mock.calls[0][0]).toEqual({ projectId: "proj_1" })

    await listUsageByUser("user_1")
    expect(mockFind.mock.calls[1][0]).toEqual({ userId: "user_1" })
  })

  it("makeUsageEvent generates an id", () => {
    const { id, ...rest } = validEvent()
    const event = makeUsageEvent(rest)
    expect(event.id).toBe("rusage_rusage-test-id")
  })
})

describe("runtime contracts", () => {
  it("validates complete usage events via the shared schema", () => {
    expect(() => RuntimeUsageEventSchema.parse(validEvent())).not.toThrow()
  })

  it("capability IDs include the approved initial set (no CDN/DNS in Phase 2)", () => {
    for (const c of ["ai.text", "search.web", "payments", "db", "vectors"]) {
      expect(() => CapabilityIdSchema.parse(c)).not.toThrow()
    }
    // CDN/DNS/domain capabilities are explicitly out of scope for Phase 2.
    expect(() => CapabilityIdSchema.parse("cdn")).toThrow()
    expect(() => CapabilityIdSchema.parse("not.a.capability")).toThrow()
  })

  it("scope schema tolerates future dotted sub-operations of known capabilities", () => {
    expect(() => CapabilityScopeSchema.parse("ai.text")).not.toThrow()
    expect(() => CapabilityScopeSchema.parse("ai.image.generate")).not.toThrow()
    expect(() => CapabilityScopeSchema.parse("unknown.capability")).toThrow()
  })

  it("request IDs are unique, prefixed, and high-entropy", () => {
    const a = formatRequestId()
    const b = formatRequestId()
    expect(a).toMatch(/^rtreq_[a-f0-9]{32}$/)
    expect(a).not.toBe(b)
  })

  it("runtime billing vocabulary is additive and helper-guarded", () => {
    expect(
      RUNTIME_LEDGER_TRANSACTION_TYPES,
    ).toEqual(["runtime_usage", "runtime_reservation", "runtime_refund"])
    expect(isRuntimeTransactionType("runtime_usage")).toBe(true)
    expect(isRuntimeTransactionType("build_reservation")).toBe(false)
    expect(runtimeUsageIdempotencyKey("rtreq_abc")).toBe("runtime_rtreq_abc")
  })
})
