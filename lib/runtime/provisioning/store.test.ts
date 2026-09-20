/**
 * Phase 8 — provisioning store-primitive tests.
 *
 * Exercises the REAL MongoStore provisioning methods against an in-memory
 * simulated projects collection (the repo's established mock pattern — the
 * real Mongo driver is never instantiated, §71/§122). Verifies:
 *
 *   - claimRuntimeProvisioning is a single atomic-style transition that
 *     rejects a second concurrent claim and takes over stale leases,
 *   - updateRuntimeProvisioning merges patches and REMOVES undefined fields,
 *   - getRuntimeProvisioning/findApiKeyMeta expose metadata only (no hash).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

const { mockFindOne, mockUpdateOne, mockKeysFindOne } = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockUpdateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  mockKeysFindOne: vi.fn().mockResolvedValue(null),
}))

vi.mock("@/lib/db/collections", () => ({
  usersCol: vi.fn(),
  projectsCol: vi.fn(),
  buildRunsCol: vi.fn(),
}))

vi.mock("@/lib/db/runtime-collections", () => ({
  apiKeysCol: vi.fn().mockResolvedValue({ findOne: mockKeysFindOne }),
  ensureRuntimeIndexes: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/billing/credit-service", () => ({
  getAvailableCredits: vi.fn().mockResolvedValue(0),
  getCreditHistory: vi.fn().mockResolvedValue([]),
  grantCredits: vi.fn(),
  consumeCredits: vi.fn(),
  reserveCredits: vi.fn(),
}))

vi.mock("@/lib/logging/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { MongoStore } from "@/lib/store/mongo-store"
import type { RuntimeProvisioningRecord } from "@/lib/runtime/provisioning/types"

type ProjDoc = {
  id: string
  userId: string
  runtimeProvisioning?: Record<string, RuntimeProvisioningRecord>
  [key: string]: unknown
}

function simulateProjectsCol(docs: ProjDoc[]) {
  return {
    findOne: mockFindOne,
    findOneAndUpdate: vi.fn(async (filter: Record<string, unknown>, update: Record<string, unknown>, _opts?: unknown) => {
      const doc = docs.find((d) => d.id === filter.id)
      if (!doc) return null
      // Emulate Mongo filter evaluation for the claim predicate:
      //   $or: [ status != PROVISIONING, claimedAt < cutoff, claimedAt missing ]
      const or = filter.$or as Array<Record<string, unknown>> | undefined
      if (or) {
        const envEntry = Object.keys(filter).find((k) => k.startsWith("runtimeProvisioning."))
        const env = envEntry ? envEntry.split(".")[1] : "production"
        const record = doc.runtimeProvisioning?.[env]
        const claimable = or.some((branch) => {
          const statusCond = branch[`runtimeProvisioning.${env}.status`] as { $ne?: string } | undefined
          if (statusCond && record?.status !== statusCond.$ne) return true
          const leaseCond = branch[`runtimeProvisioning.${env}.claimedAt`] as { $lt?: number } | undefined
          if (leaseCond) {
            if (leaseCond.$lt === undefined) return !("claimedAt" in (record ?? {}))
            if (typeof record?.claimedAt !== "number") return true
            return record.claimedAt < (leaseCond.$lt as number)
          }
          return false
        })
        if (!claimable) return null
      }
      // Legacy-takeover fallback (second findOneAndUpdate in mongo-store):
      // distinguishable by its FILTER SHAPE — no $or, but a status equality
      // condition plus claimedAt $exists:false. A record carrying a live
      // claimedAt must NOT match — emulating Mongo's missing-field semantics
      // here is exactly what the original shim got wrong (it applied updates
      // unconditionally, letting the legacy path steal a live lease).
      if (!or) {
        const statusKey = Object.keys(filter).find(
          (k) => k.startsWith("runtimeProvisioning.") && k.endsWith(".status") && filter[k] === "PROVISIONING",
        )
        const existsCondKey = Object.keys(filter).find(
          (k) => k.endsWith(".claimedAt") && (filter[k] as { $exists?: boolean })?.$exists === false,
        )
        if (statusKey && existsCondKey) {
          const envKey = statusKey.split(".")[1]
          const record = doc.runtimeProvisioning?.[envKey]
          const hasClaimTs = record !== undefined && "claimedAt" in record
          if (!record || hasClaimTs) return null
        }
      }
      const set = (update.$set ?? {}) as Record<string, unknown>
      for (const [k, v] of Object.entries(set)) {
        if (k === "updatedAt") {
          doc.updatedAt = v as number
          continue
        }
        const [, env, field] = k.split(".")
        doc.runtimeProvisioning = doc.runtimeProvisioning ?? {}
        doc.runtimeProvisioning[env] = doc.runtimeProvisioning[env] ?? { status: "NOT_PROVISIONED" }
        ;(doc.runtimeProvisioning[env] as unknown as Record<string, unknown>)[field] = v
      }
      return doc
    }),
    updateOne: mockUpdateOne,
  }
}

function docWithFilterProjection(doc: ProjDoc | null, projection?: Record<string, unknown>) {
  // Emulate Mongo's projection for the metadata-only reads.
  if (!doc) return null
  if (projection && projection.runtimeProvisioning === 1) {
    return { runtimeProvisioning: doc.runtimeProvisioning }
  }
  return doc
}

describe("MongoStore provisioning primitives (Phase 8)", () => {
  let docs: ProjDoc[]
  let storeInstance: MongoStore
  let projectsMock: ReturnType<typeof simulateProjectsCol>

  beforeEach(async () => {
    vi.clearAllMocks()
    docs = [{ id: "proj_A", userId: "user_A" }]
    projectsMock = simulateProjectsCol(docs)
    const collectionsMod = await import("@/lib/db/collections")
    vi.mocked(collectionsMod.projectsCol).mockResolvedValue(projectsMock as never)
    storeInstance = new MongoStore(0) // ttl 0 — no cache interference
  })

  it("claim succeeds once; the concurrent loser gets null", async () => {
    // Wire getRuntimeProvisioning's findOne through a projection-aware shim.
    mockFindOne.mockImplementation(async (_q: unknown, opts?: { projection?: Record<string, unknown> }) =>
      docWithFilterProjection(docs[0], opts?.projection),
    )

    const first = await storeInstance.claimRuntimeProvisioning("proj_A", "production")
    expect(first?.status).toBe("PROVISIONING")

    const second = await storeInstance.claimRuntimeProvisioning("proj_A", "production")
    expect(second).toBeNull()
  })

  it("claim takes over a stale lease (claimedAt older than the window)", async () => {
    docs[0].runtimeProvisioning = { production: { status: "PROVISIONING", claimedAt: Date.now() - 10 * 60_000 } }
    mockFindOne.mockImplementation(async (_q: unknown, opts?: { projection?: Record<string, unknown> }) =>
      docWithFilterProjection(docs[0], opts?.projection),
    )

    const claimed = await storeInstance.claimRuntimeProvisioning("proj_A", "production")
    expect(claimed).not.toBeNull()
    expect(claimed?.status).toBe("PROVISIONING")
  })

  it("a live lease is respected until it expires", async () => {
    docs[0].runtimeProvisioning = { production: { status: "PROVISIONING", claimedAt: Date.now() } }
    mockFindOne.mockImplementation(async (_q: unknown, opts?: { projection?: Record<string, unknown> }) =>
      docWithFilterProjection(docs[0], opts?.projection),
    )

    const claimed = await storeInstance.claimRuntimeProvisioning("proj_A", "production")
    expect(claimed).toBeNull()
  })

  it("updateRuntimeProvisioning merges the patch and removes undefined fields", async () => {
    docs[0].runtimeProvisioning = { production: { status: "KEY_CREATED", apiKeyId: "rkey_old", keyPrefix: "atai_production_xxxx…" } }
    mockFindOne.mockImplementation(async () => docs[0])

    await storeInstance.updateRuntimeProvisioning("proj_A", "production", {
      status: "READY",
      apiKeyId: undefined, // must REMOVE the field, not write null
      keyPrefix: undefined,
      provisionedAt: 123,
    })

    expect(mockUpdateOne).toHaveBeenCalledTimes(1)
    const update = mockUpdateOne.mock.calls[0][1] as { $set: Record<string, unknown>; $unset?: Record<string, unknown> }
    expect(update.$set["runtimeProvisioning.production.status"]).toBe("READY")
    expect(update.$set["runtimeProvisioning.production.provisionedAt"]).toBe(123)
    expect(update.$unset?.["runtimeProvisioning.production.apiKeyId"]).toBeDefined()
    expect(update.$unset?.["runtimeProvisioning.production.keyPrefix"]).toBeDefined()
  })

  it("getRuntimeProvisioning reads only the provisioning projection", async () => {
    docs[0].runtimeProvisioning = { production: { status: "READY", apiKeyId: "rkey_1" } }
    mockFindOne.mockImplementation(async (_q: unknown, opts?: { projection?: Record<string, unknown> }) =>
      docWithFilterProjection(docs[0], opts?.projection),
    )

    const record = await storeInstance.getRuntimeProvisioning("proj_A", "production")
    expect(record).toEqual({ status: "READY", apiKeyId: "rkey_1" })

    // Verify the projection excludes everything except runtimeProvisioning.
    const call = mockFindOne.mock.calls[0]
    expect(call[1].projection).toEqual({ runtimeProvisioning: 1 })
  })

  it("findApiKeyMeta returns non-secret metadata only (never the hash)", async () => {
    mockKeysFindOne.mockResolvedValueOnce({
      id: "rkey_1",
      projectId: "proj_A",
      environment: "production",
      status: "active",
      keyPrefix: "atai_production_abcd…",
      keyHash: "deadbeef" + "0".repeat(56),
    })

    const meta = await storeInstance.findApiKeyMeta("rkey_1")
    expect(meta).toEqual({
      id: "rkey_1",
      projectId: "proj_A",
      environment: "production",
      status: "active",
      keyPrefix: "atai_production_abcd…",
    })
    expect(mockKeysFindOne.mock.calls[0][1].projection).toEqual({ id: 1, projectId: 1, environment: 1, status: 1, keyPrefix: 1 })
    expect(JSON.stringify(meta)).not.toContain("deadbeef")
  })

  it("returns null for a missing project on claim (no phantom provisioning)", async () => {
    mockFindOne.mockResolvedValue(null)
    const claimed = await storeInstance.claimRuntimeProvisioning("proj_ghost", "production")
    expect(claimed).toBeNull()
  })
})
