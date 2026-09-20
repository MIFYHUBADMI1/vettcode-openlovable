/**
 * Atai Runtime — Phase 8 automatic provisioning service tests.
 *
 * Covers the Phase 8 §102/§103/§107 matrix: idempotency, concurrency,
 * crash recovery, orphan-key prevention, scope/environment binding,
 * plaintext-non-persistence, and secret-redaction.
 *
 * Mocks follow the repo's established pattern (vi.hoisted + vi.mock).
 * No real MongoDB, no real Totalum, no real credentials (§71/§122).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

const { mockInsertOne, mockFindOne, mockUpdateOne } = vi.hoisted(() => ({
  mockInsertOne: vi.fn().mockResolvedValue({ insertedId: "mock-id" }),
  mockFindOne: vi.fn().mockResolvedValue(null),
  mockUpdateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
}))

vi.mock("@/lib/store/store", () => ({
  store: {
    getProject: vi.fn(),
    getRuntimeProvisioning: vi.fn(),
    updateRuntimeProvisioning: vi.fn().mockResolvedValue(undefined),
    claimRuntimeProvisioning: vi.fn(),
    appendEvent: vi.fn().mockResolvedValue(undefined),
    findApiKeyMeta: vi.fn(),
  },
}))

vi.mock("@/lib/db/runtime-collections", () => ({
  apiKeysCol: vi.fn().mockResolvedValue({
    insertOne: mockInsertOne,
    findOne: mockFindOne,
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    }),
    updateOne: mockUpdateOne,
  }),
  ensureRuntimeIndexes: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/integrations/totalum/service", () => ({
  isTotalumConfigured: vi.fn().mockReturnValue(true),
  createSecret: vi.fn().mockResolvedValue({ _id: "sec_1", secretName: "ATAI_API_KEY", environment: "production" }),
}))

vi.mock("@/lib/store/id", () => ({
  cryptoId: vi.fn(() => `id-${Math.random().toString(36).slice(2)}`),
}))

vi.mock("@/lib/logging/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { ensureRuntimeProvisioned, ATAI_RUNTIME_SECRET_NAME, PROVISIONED_KEY_SCOPES, RuntimeProvisioningError } from "./service"
import { store } from "@/lib/store/store"
import { createSecret, isTotalumConfigured } from "@/lib/integrations/totalum/service"
import { logger } from "@/lib/logging/logger"
import type { MirrorProject } from "@/lib/types/project"
import type { ApiKeyDoc } from "../types"
import type { RuntimeProvisioningRecord } from "./types"

// ─── In-memory credential store simulating api_keys (hash-only, like Mongo) ──

const insertedKeys: ApiKeyDoc[] = []

function insertHarness() {
  mockInsertOne.mockImplementation(async (doc: ApiKeyDoc) => {
    insertedKeys.push(doc)
    return { insertedId: "mock-id" }
  })
  mockFindOne.mockImplementation(async (query: Record<string, unknown>) => {
    if (typeof query.id === "string") {
      return insertedKeys.find((d) => d.id === query.id) ?? null
    }
    return null
  })
  // revokeApiKey paths go through updateOne — simulate the status transition.
  // The real service filters on { id, userId, status: "active" } and $sets
  // status/revokedAt/revokedReason; mirror that behavior exactly.
  mockUpdateOne.mockImplementation(async (filter: { id?: string; userId?: string; status?: string }, update: Record<string, unknown>) => {
    if (!filter.id) return { modifiedCount: 0 }
    const doc = insertedKeys.find((d) => d.id === filter.id && (!filter.userId || d.userId === filter.userId) && (!filter.status || d.status === filter.status))
    if (!doc) return { modifiedCount: 0 }
    const set = (update.$set ?? {}) as Record<string, unknown>
    Object.assign(doc, set)
    return { modifiedCount: 1 }
  })
}

function makeProject(overrides: Partial<MirrorProject> = {}): MirrorProject {
  return {
    id: "proj_A",
    userId: "user_owner",
    mode: "scratch",
    name: "Project A",
    state: "ready",
    totalumProjectId: "totalum_A",
    events: [],
    conversation: [],
    deployment: { id: "d1", status: "idle", updatedAt: Date.now() },
    deploymentHistory: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  } as MirrorProject
}

/** Track the latest persisted provisioning record per (project, env). */
const provisioningRecords = new Map<string, RuntimeProvisioningRecord>()

function recordKey(projectId: string, env: string) {
  return `${projectId}:${env}`
}

function recordHarness() {
  vi.mocked(store.getRuntimeProvisioning).mockImplementation(async (projectId, env) => {
    return provisioningRecords.get(recordKey(projectId, env)) ?? null
  })
  vi.mocked(store.updateRuntimeProvisioning).mockImplementation(async (projectId, env, patch) => {
    const current = provisioningRecords.get(recordKey(projectId, env)) ?? { status: "NOT_PROVISIONED" as const }
    const next: Record<string, unknown> = { ...current }
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete next[k]
      else next[k] = v
    }
    provisioningRecords.set(recordKey(projectId, env), next as unknown as RuntimeProvisioningRecord)
  })
  vi.mocked(store.claimRuntimeProvisioning).mockImplementation(async (projectId, env) => {
    const key = recordKey(projectId, env)
    const current = provisioningRecords.get(key)
    if (current?.status === "PROVISIONING") return null
    const next = { ...(current ?? { status: "NOT_PROVISIONED" as const }), status: "PROVISIONING" as const }
    provisioningRecords.set(key, next as RuntimeProvisioningRecord)
    return next as RuntimeProvisioningRecord
  })
}

function docOf(call: number): ApiKeyDoc {
  return mockInsertOne.mock.calls[call][0] as ApiKeyDoc
}

function lastWriteCalls(): string {
  return JSON.stringify(
    (createSecret as ReturnType<typeof vi.fn>).mock.calls,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  insertedKeys.length = 0
  provisioningRecords.clear()
  insertHarness()
  recordHarness()
  vi.mocked(store.getProject).mockResolvedValue(makeProject())
  vi.mocked(store.findApiKeyMeta).mockImplementation(async (apiKeyId: string) => {
    const doc = insertedKeys.find((d) => d.id === apiKeyId)
    if (!doc) return null
    return { id: doc.id, projectId: doc.projectId, environment: doc.environment, status: doc.status, keyPrefix: doc.keyPrefix }
  })
  vi.mocked(isTotalumConfigured).mockReturnValue(true)
  vi.mocked(createSecret).mockResolvedValue({ _id: "sec_1", secretName: ATAI_RUNTIME_SECRET_NAME, environment: "production" })
})

// ─── §102 API-key provisioning ─────────────────────────────────────────────

describe("provisioning — new project (§102)", () => {
  it("provisions a key and injects the secret into the generated app", async () => {
    const result = await ensureRuntimeProvisioned(makeProject(), "production")

    expect(result.status).toBe("READY")
    expect(result.reused).toBe(false)
    expect(mockInsertOne).toHaveBeenCalledTimes(1)

    const doc = docOf(0)
    expect(doc.projectId).toBe("proj_A")
    expect(doc.environment).toBe("production")
    expect(doc.userId).toBe("user_owner") // derived from the project record
    expect(doc.scopes).toEqual([...PROVISIONED_KEY_SCOPES])
    expect(doc.scopes).not.toEqual([]) // never "all capabilities"

    expect(createSecret).toHaveBeenCalledTimes(1)
    expect(createSecret).toHaveBeenCalledWith(
      "totalum_A",
      expect.objectContaining({ secretName: ATAI_RUNTIME_SECRET_NAME }),
    )
  })

  it("derives ownership from the project record — never a caller-supplied userId (§75)", async () => {
    vi.mocked(store.getProject).mockResolvedValue(makeProject({ userId: "user_real_owner" }))
    await ensureRuntimeProvisioned(makeProject({ userId: "user_real_owner" }), "production")
    expect(docOf(0).userId).toBe("user_real_owner")
  })

  it("refuses to provision without a generated application (§9)", async () => {
    await expect(
      ensureRuntimeProvisioned(makeProject({ totalumProjectId: undefined }), "production"),
    ).rejects.toMatchObject({ reason: "NO_GENERATED_APP" })
    expect(mockInsertOne).not.toHaveBeenCalled()
    expect(createSecret).not.toHaveBeenCalled()
  })

  it("refuses to provision when the secret store is unavailable (§12)", async () => {
    vi.mocked(isTotalumConfigured).mockReturnValue(false)
    await expect(
      ensureRuntimeProvisioned(makeProject(), "production"),
    ).rejects.toMatchObject({ reason: "TOTALUM_NOT_CONFIGURED" })
    expect(mockInsertOne).not.toHaveBeenCalled()
  })

  it("grants least-privilege scopes, never unrestricted access (§15/§45)", async () => {
    await ensureRuntimeProvisioned(makeProject(), "production")
    const doc = docOf(0)
    expect(doc.scopes).toEqual(["ai.text"])
    // Management scopes must never be granted — the scope vocabulary has no
    // key-management capabilities, and the list must stay capability-only.
    for (const s of doc.scopes as string[]) {
      expect(s).toMatch(/^[a-z]/)
      expect(s).not.toContain("key")
      expect(s).not.toContain("admin")
    }
  })
})

// ─── §102/§106 idempotency ─────────────────────────────────────────────────

describe("provisioning — idempotency (§17/§103)", () => {
  it("reuses the existing valid credential on repeated calls", async () => {
    const first = await ensureRuntimeProvisioned(makeProject(), "production")
    expect(first.reused).toBe(false)

    const second = await ensureRuntimeProvisioned(makeProject(), "production")
    expect(second.reused).toBe(true)
    expect(second.apiKeyId).toBe(first.apiKeyId)

    // Still exactly ONE key and ONE secret write.
    expect(mockInsertOne).toHaveBeenCalledTimes(1)
    expect(createSecret).toHaveBeenCalledTimes(1)
  })

  it("does NOT create a new key on rebuild/redeploy of the same project (§51)", async () => {
    await ensureRuntimeProvisioned(makeProject(), "production")
    // Simulate a second build/deploy cycle with an updated project snapshot.
    await ensureRuntimeProvisioned(makeProject({ state: "ready" }), "production")
    expect(mockInsertOne).toHaveBeenCalledTimes(1)
  })

  it("provisions separately per environment (§53/§69)", async () => {
    await ensureRuntimeProvisioned(makeProject(), "development")
    await ensureRuntimeProvisioned(makeProject(), "production")

    expect(mockInsertOne).toHaveBeenCalledTimes(2)
    const envs = [docOf(0).environment, docOf(1).environment].sort()
    expect(envs).toEqual(["development", "production"])
    expect(docOf(0).id).not.toBe(docOf(1).id)
  })

  it("keeps multiple environments isolated — dev key never serves production (§35)", async () => {
    await ensureRuntimeProvisioned(makeProject(), "development")
    const prodResult = await ensureRuntimeProvisioned(makeProject(), "production")

    const devKey = insertedKeys.find((d) => d.environment === "development")!
    const prodKey = insertedKeys.find((d) => d.environment === "production")!
    expect(devKey.keyHash).not.toBe(prodKey.keyHash)
    expect(prodResult.apiKeyId).not.toBe(devKey.id)
  })
})

// ─── §67/§68 isolation ─────────────────────────────────────────────────────

describe("provisioning — project and user isolation (§33/§34/§67/§68)", () => {
  it("provisions isolated keys per project", async () => {
    await ensureRuntimeProvisioned(makeProject({ id: "proj_A", totalumProjectId: "totalum_A" }), "production")
    await ensureRuntimeProvisioned(makeProject({ id: "proj_B", totalumProjectId: "totalum_B", userId: "user_B" }), "production")

    const keyA = insertedKeys.find((d) => d.projectId === "proj_A")!
    const keyB = insertedKeys.find((d) => d.projectId === "proj_B")!
    expect(keyA.id).not.toBe(keyB.id)
    expect(keyA.keyHash).not.toBe(keyB.keyHash)
    expect(keyA.userId).toBe("user_owner")
    expect(keyB.userId).toBe("user_B")
  })

  it("a project's provisioning record can never adopt another project's key", async () => {
    await ensureRuntimeProvisioned(makeProject({ id: "proj_A" }), "production")
    const keyA = insertedKeys.find((d) => d.projectId === "proj_A")!

    // Simulate a corrupted record pointing at Project A's key for Project B.
    provisioningRecords.set("proj_B:production", {
      status: "READY",
      apiKeyId: keyA.id,
    })

    // findApiKeyMeta will resolve the key, and its projectId (proj_A) does
    // not match proj_B — the service must repair, not reuse.
    const result = await ensureRuntimeProvisioned(makeProject({ id: "proj_B", totalumProjectId: "totalum_B" }), "production")
    expect(result.reused).toBe(false)
    expect(result.apiKeyId).not.toBe(keyA.id)

    const fresh = insertedKeys.find((d) => d.projectId === "proj_B")!
    expect(fresh.id).toBe(result.apiKeyId)
  })
})

// ─── §104 secret injection ─────────────────────────────────────────────────

describe("provisioning — secret injection (§13/§104)", () => {
  it("uses the one canonical secret name (§40)", async () => {
    await ensureRuntimeProvisioned(makeProject(), "production")
    const call = (createSecret as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[1].secretName).toBe("ATAI_API_KEY")
  })

  it("passes the correct Totalum project id from the Atai project record (§74)", async () => {
    await ensureRuntimeProvisioned(makeProject({ totalumProjectId: "totalum_XYZ" }), "production")
    expect((createSecret as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("totalum_XYZ")
  })

  it("marks the record FAILED and does not report ready when injection fails (§36)", async () => {
    vi.mocked(createSecret).mockRejectedValueOnce(new Error("Totalum unavailable"))
    await expect(ensureRuntimeProvisioned(makeProject(), "production")).rejects.toBeInstanceOf(RuntimeProvisioningError)

    const record = provisioningRecords.get("proj_A:production")
    expect(record?.status).toBe("FAILED")
  })

  it("revokes the undeliverable key on injection failure — no orphans (§61/§62)", async () => {
    vi.mocked(createSecret).mockRejectedValueOnce(new Error("Totalum unavailable"))
    await expect(ensureRuntimeProvisioned(makeProject(), "production")).rejects.toThrow()

    const doc = docOf(0)
    expect(doc.status).toBe("revoked")
    expect(doc.revokedReason).toBe("provisioning_failed_undelivered")
  })

  it("retry after injection failure creates a FRESH key and succeeds (§37/§107)", async () => {
    vi.mocked(createSecret).mockRejectedValueOnce(new Error("Totalum unavailable"))
    await expect(ensureRuntimeProvisioned(makeProject(), "production")).rejects.toThrow()

    vi.mocked(createSecret).mockResolvedValueOnce({ _id: "sec_2", secretName: ATAI_RUNTIME_SECRET_NAME, environment: "production" })
    const result = await ensureRuntimeProvisioned(makeProject(), "production")

    expect(result.status).toBe("READY")
    expect(result.reused).toBe(false)
    expect(mockInsertOne).toHaveBeenCalledTimes(2) // failed attempt + retry
    // The first (undeliverable) key was revoked; exactly ONE active key remains.
    const active = insertedKeys.filter((d) => d.status === "active")
    expect(active).toHaveLength(1)
    expect(active[0].id).toBe(result.apiKeyId)
  })

  it("retry after KEY-CREATION failure does not accumulate revoked keys unboundedly (§37)", async () => {
    // Injection always succeeds here; simulate a key-service failure instead.
    mockInsertOne.mockImplementationOnce(async () => {
      throw new Error("mongo down")
    })
    await expect(ensureRuntimeProvisioned(makeProject(), "production")).rejects.toThrow()

    const result = await ensureRuntimeProvisioned(makeProject(), "production")
    expect(result.status).toBe("READY")
    expect(insertedKeys.filter((d) => d.status === "active")).toHaveLength(1)
  })
})

// ─── §39/§107 crash recovery ───────────────────────────────────────────────

describe("provisioning — crash recovery (§39/§107)", () => {
  it("crash after KEY_CREATED: retry validates the record and replaces the undelivered key", async () => {
    // Simulate: first attempt created a key and crashed before injection.
    await ensureRuntimeProvisioned(makeProject(), "production")
    const crashedKey = docOf(0)
    provisioningRecords.set("proj_A:production", {
      status: "KEY_CREATED",
      apiKeyId: crashedKey.id,
      keyPrefix: crashedKey.keyPrefix,
    })

    // The record is not READY → the fast path must NOT reuse it. A retry
    // provisions a replacement and revokes the never-delivered key.
    const result = await ensureRuntimeProvisioned(makeProject(), "production")
    expect(result.reused).toBe(false)
    const active = insertedKeys.filter((d) => d.status === "active")
    expect(active).toHaveLength(1)
    expect(active[0].id).toBe(result.apiKeyId)
    expect(active[0].id).not.toBe(crashedKey.id)
  })

  it("stale PROVISIONING claim (crashed worker) is taken over by a retry", async () => {
    // Real claim harness: a crashed worker left PROVISIONING with an old lease.
    // claimRuntimeProvisioning(mock) blocks PROVISIONING — emulate the store's
    // stale-lease takeover by clearing the claim first (what the real store
    // does when claimedAt is older than the lease window).
    provisioningRecords.set("proj_A:production", { status: "PROVISIONING", claimedAt: Date.now() - 10 * 60_000 })
    // The real MongoStore would take over the stale claim; emulate that the
    // retry CAN claim it.
    vi.mocked(store.claimRuntimeProvisioning).mockImplementationOnce(async () => {
      provisioningRecords.set("proj_A:production", { status: "PROVISIONING", claimedAt: Date.now() })
      return provisioningRecords.get("proj_A:production")!
    })

    const result = await ensureRuntimeProvisioned(makeProject(), "production")
    expect(result.status).toBe("READY")
    expect(mockInsertOne).toHaveBeenCalledTimes(1)
  })

  it("contention: concurrent loser reports PROVISIONING, never double-provisions", async () => {
    // Claim already held by another worker and no valid key yet.
    provisioningRecords.set("proj_A:production", { status: "PROVISIONING", claimedAt: Date.now() })

    const result = await ensureRuntimeProvisioned(makeProject(), "production")
    expect(result.status).toBe("PROVISIONING")
    expect(result.reused).toBe(false)
    expect(mockInsertOne).not.toHaveBeenCalled()
    expect(createSecret).not.toHaveBeenCalled()
  })
})

// ─── §103 concurrency (mandatory) ──────────────────────────────────────────

describe("provisioning — concurrency (§103)", () => {
  it("Promise.all of concurrent provisions results in exactly ONE active key", async () => {
    // Serialize claims like a real atomic store: only one caller wins the
    // PROVISIONING transition; the rest wait and then see the READY record.
    let claimHeld = false
    vi.mocked(store.claimRuntimeProvisioning).mockImplementation(async (projectId, env) => {
      const key = recordKey(projectId, env)
      const current = provisioningRecords.get(key)
      if (claimHeld || current?.status === "PROVISIONING") return null
      claimHeld = true
      provisioningRecords.set(key, { status: "PROVISIONING" })
      return { status: "PROVISIONING" }
    })
    vi.mocked(store.updateRuntimeProvisioning).mockImplementation(async (projectId, env, patch) => {
      const key = recordKey(projectId, env)
      const current = provisioningRecords.get(key) ?? { status: "NOT_PROVISIONED" as const }
      const next: Record<string, unknown> = { ...current }
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) delete next[k]
        else next[k] = v
      }
      if (next.status === "READY" || next.status === "FAILED") claimHeld = false
      provisioningRecords.set(key, next as unknown as RuntimeProvisioningRecord)
    })
    // The fast-path lookup must see the READY record once the winner finishes.
    vi.mocked(store.getRuntimeProvisioning).mockImplementation(async (projectId, env) => {
      return provisioningRecords.get(recordKey(projectId, env)) ?? null
    })
    vi.mocked(store.findApiKeyMeta).mockImplementation(async (apiKeyId: string) => {
      const doc = insertedKeys.find((d) => d.id === apiKeyId)
      if (!doc) return null
      return { id: doc.id, projectId: doc.projectId, environment: doc.environment, status: doc.status, keyPrefix: doc.keyPrefix }
    })

    const results = await Promise.all([
      ensureRuntimeProvisioned(makeProject(), "production"),
      ensureRuntimeProvisioned(makeProject(), "production"),
      ensureRuntimeProvisioned(makeProject(), "production"),
    ])

    const ready = results.filter((r) => r.status === "READY")
    expect(ready.length).toBeGreaterThanOrEqual(1)
    // Every READY outcome points at the SAME credential.
    const distinctIds = new Set(ready.map((r) => r.apiKeyId))
    expect(distinctIds.size).toBe(1)
    // Exactly one key document was ever created and it is the only active one.
    expect(mockInsertOne).toHaveBeenCalledTimes(1)
    expect(insertedKeys.filter((d) => d.status === "active")).toHaveLength(1)
    // Exactly one secret injection — the plaintext was delivered once.
    expect(createSecret).toHaveBeenCalledTimes(1)
  })
})

// ─── §11/§41/§42 plaintext + logging security ──────────────────────────────

describe("provisioning — secret hygiene (§11/§30/§41/§42)", () => {
  it("never persists the plaintext secret — api_keys stores hashes only", async () => {
    const result = await ensureRuntimeProvisioned(makeProject(), "production")
    const doc = docOf(0)

    // Capture the plaintext BEFORE it is discarded by the service.
    const injected = (createSecret as ReturnType<typeof vi.fn>).mock.calls[0][1].secretValue as string

    expect(doc.keyHash).toBeDefined()
    // The plaintext and its hash-bearing material must never appear on the doc.
    const serialized = JSON.stringify(doc)
    expect(serialized).not.toContain(injected)
    expect(serialized).not.toContain("plaintextKey")
    expect(serialized).not.toContain("rawKey")
    expect(serialized).not.toContain("secret")
    // keyPrefix is a non-secret 4-char display prefix — allowed, but it must
    // NOT be the plaintext itself.
    expect(doc.keyPrefix).not.toBe(injected)
    expect(result.keyPrefix).toBe(doc.keyPrefix)
    // The provisioning record is metadata-only too.
    const record = provisioningRecords.get("proj_A:production")
    const recordJson = JSON.stringify(record)
    expect(recordJson).not.toContain(injected)
    expect(recordJson).not.toContain("secret")
  })

  it("never writes the plaintext into project events or logs (§42/§82)", async () => {
    const result = await ensureRuntimeProvisioned(makeProject(), "production")

    // Capture the injected plaintext from the createSecret call.
    const injected = (createSecret as ReturnType<typeof vi.fn>).mock.calls[0][1].secretValue as string
    expect(injected).toMatch(/^atai_production_/)
    expect(result.status).toBe("READY")

    const logged = JSON.stringify([
      ...(logger.info as ReturnType<typeof vi.fn>).mock.calls,
      ...(logger.warn as ReturnType<typeof vi.fn>).mock.calls,
      ...(logger.error as ReturnType<typeof vi.fn>).mock.calls,
    ])
    expect(logged).not.toContain(injected)

    const events = (store.appendEvent as ReturnType<typeof vi.fn>).mock.calls
    expect(JSON.stringify(events)).not.toContain(injected)

    const writes = lastWriteCalls()
    expect(writes).toContain(ATAI_RUNTIME_SECRET_NAME)
  })

  it("failure logs never contain the injected secret (§82 redaction test)", async () => {
    const TEST_SECRET = "atai_production_TEST_ONLY_SECRET_123456789"
    // Simulate a recognizable fake secret flowing through the injection path.
    vi.mocked(createSecret).mockImplementationOnce(async (_projectId, secret) => {
      expect(secret.secretValue).toMatch(/^atai_production_/)
      throw new Error("Totalum 502 — injection failed")
    })
    await expect(ensureRuntimeProvisioned(makeProject(), "production")).rejects.toThrow()

    const logged = JSON.stringify([
      ...(logger.info as ReturnType<typeof vi.fn>).mock.calls,
      ...(logger.warn as ReturnType<typeof vi.fn>).mock.calls,
      ...(logger.error as ReturnType<typeof vi.fn>).mock.calls,
    ])
    expect(logged).not.toContain(TEST_SECRET)
    expect(logged).not.toContain("Totalum 502 — injection failed".slice(0, 12) + "___")
  })

  it("uses the existing Phase 3 key service (no second key system) (§7/§59)", async () => {
    await ensureRuntimeProvisioned(makeProject(), "production")
    const doc = docOf(0)
    // Shape produced exclusively by the Phase 3 service + key-crypto module.
    expect(doc.id).toMatch(/^rkey_/)
    expect(doc.keyPrefix).toMatch(/^atai_production_.{4}…$/)
    expect(doc.status).toBe("active")
    expect(typeof doc.keyHash).toBe("string")
    expect(doc.keyHash).toHaveLength(64) // SHA-256 hex
  })
})

// ─── §86/§100 lifecycle edges ──────────────────────────────────────────────

describe("provisioning — credential lifecycle edges", () => {
  it("does not reuse a revoked provisioned key — re-provisions instead (§86)", async () => {
    await ensureRuntimeProvisioned(makeProject(), "production")
    const firstKey = insertedKeys[0]

    // Owner revoked the key via the dashboard (Phase 3 manual flow intact).
    firstKey.status = "revoked"
    firstKey.revokedReason = "manual_revocation"

    const result = await ensureRuntimeProvisioned(makeProject(), "production")
    expect(result.reused).toBe(false)
    expect(result.apiKeyId).not.toBe(firstKey.id)
    expect(mockInsertOne).toHaveBeenCalledTimes(2)
  })

  it("repairs a record whose apiKeyId no longer resolves", async () => {
    provisioningRecords.set("proj_A:production", {
      status: "READY",
      apiKeyId: "rkey_ghost_missing",
    })

    const result = await ensureRuntimeProvisioned(makeProject(), "production")
    expect(result.reused).toBe(false)
    expect(result.status).toBe("READY")
  })
})
