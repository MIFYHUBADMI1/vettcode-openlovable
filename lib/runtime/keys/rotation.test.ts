/**
 * Atai Runtime — Phase 3 lifecycle tests: rotation, metadata retrieval,
 * expiration semantics, and security invariants.
 *
 * Mocks the collections layer with the repo's established pattern
 * (vi.hoisted + vi.mock, cf. lib/planning/tracking/planning-run.tracker.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

const { mockFindOne, mockInsertOne, mockUpdateOne } = vi.hoisted(() => ({
  mockFindOne: vi.fn().mockResolvedValue(null),
  mockInsertOne: vi.fn().mockResolvedValue({ insertedId: "mock-id" }),
  mockUpdateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
}))

const mockSession = {
  withTransaction: vi.fn(async (fn: (s: unknown) => Promise<unknown>) => fn({})),
  endSession: vi.fn(async () => undefined),
}

vi.mock("@/lib/db/mongodb", () => ({
  getMongoClient: vi.fn(async () => ({
    startSession: () => mockSession,
    db: () => ({
      collection: () => ({
        findOne: mockFindOne,
        insertOne: mockInsertOne,
        updateOne: mockUpdateOne,
      }),
    }),
  })),
}))

vi.mock("@/lib/db/runtime-collections", () => ({
  apiKeysCol: vi.fn().mockResolvedValue({
    findOne: mockFindOne,
    insertOne: mockInsertOne,
    updateOne: mockUpdateOne,
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    }),
  }),
  ensureRuntimeIndexes: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/store/id", () => ({
  cryptoId: vi.fn(() => `id-${Math.floor(Math.random() * 1e9)}`),
}))

vi.mock("@/lib/logging/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { rotateApiKey } from "./rotate"
import { getApiKeyMetadata } from "./metadata"
import { isApiKeyExpired, effectiveKeyStatus } from "./expiration"
import { generateApiKey, hashApiKey } from "../key-crypto"
import type { ApiKeyDoc } from "../types"

function makeActiveKey(overrides: Partial<ApiKeyDoc> = {}): ApiKeyDoc {
  const generated = generateApiKey("production")
  return {
    _id: {} as ApiKeyDoc["_id"],
    id: "rkey_old",
    userId: "user_owner",
    projectId: "proj_owned",
    environment: "production",
    keyHash: generated.keyHash,
    keyPrefix: generated.keyPrefix,
    scopes: ["ai.text"],
    status: "active",
    createdAt: Date.now() - 1000,
    ...overrides,
  }
}

describe("rotateApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindOne.mockResolvedValue(null)
    mockInsertOne.mockResolvedValue({ insertedId: "mock-id" })
    mockUpdateOne.mockResolvedValue({ modifiedCount: 1 })
    mockSession.withTransaction.mockImplementation(
      async (fn: (s: unknown) => Promise<unknown>) => fn({}),
    )
  })

  it("creates a new key with a fresh secret and different hash", async () => {
    const old = makeActiveKey()
    mockFindOne.mockResolvedValueOnce(old)

    const result = await rotateApiKey({ userId: "user_owner", keyId: "rkey_old" })

    const inserted = mockInsertOne.mock.calls[0][0] as ApiKeyDoc
    expect(inserted.id).not.toBe(old.id)
    expect(inserted.keyHash).not.toBe(old.keyHash)
    expect(result.secret).toMatch(/^atai_production_/)
    expect(result.rotatedFromId).toBe("rkey_old")
  })

  it("copies environment, scopes, and optional expiry to the new key", async () => {
    const expiresAt = Date.now() + 86_400_000
    const old = makeActiveKey({ environment: "development", scopes: ["search.web"], expiresAt })
    mockFindOne.mockResolvedValueOnce(old)

    const result = await rotateApiKey({ userId: "user_owner", keyId: "rkey_old" })

    expect(result.environment).toBe("development")
    expect(result.scopes).toEqual(["search.web"])
    expect(result.expiresAt).toBe(expiresAt)
  })

  it("retires the old key with lineage (rotatedToId) and sanitized reason", async () => {
    const old = makeActiveKey()
    mockFindOne.mockResolvedValueOnce(old)

    const result = await rotateApiKey({
      userId: "user_owner",
      keyId: "rkey_old",
      reason: "scheduled_rotation",
    })

    const [, update] = mockUpdateOne.mock.calls[0]
    expect(update.$set.status).toBe("revoked")
    expect(update.$set.revokedReason).toBe("scheduled_rotation")
    expect(update.$set.rotatedToId).toBe(result.id)
  })

  it("enforces ownership inside the retire filter", async () => {
    const old = makeActiveKey()
    mockFindOne.mockResolvedValueOnce(old)

    await rotateApiKey({ userId: "user_attacker", keyId: "rkey_old" })

    const [filter] = mockUpdateOne.mock.calls[0]
    expect(filter).toMatchObject({ id: "rkey_old", userId: "user_attacker", status: "active" })
  })

  it("rejects rotation of a non-active key (concurrency guard)", async () => {
    mockFindOne.mockResolvedValueOnce(makeActiveKey({ status: "revoked" }))

    await expect(
      rotateApiKey({ userId: "user_owner", keyId: "rkey_old" }),
    ).rejects.toThrow("RUNTIME_KEY_NOT_ACTIVE")
  })

  it("aborts (and by extension rolls back) when the retire transition loses a race", async () => {
    mockFindOne.mockResolvedValueOnce(makeActiveKey())
    mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 0 })

    await expect(
      rotateApiKey({ userId: "user_owner", keyId: "rkey_old" }),
    ).rejects.toThrow("RUNTIME_KEY_CONCURRENT_MODIFICATION")
  })

  it("does not leak key existence for a key the caller does not own", async () => {
    mockFindOne.mockResolvedValueOnce(null) // ownership filter excluded it
    await expect(
      rotateApiKey({ userId: "user_attacker", keyId: "rkey_victim" }),
    ).rejects.toThrow("RUNTIME_KEY_NOT_ACCESSIBLE")
  })
})

describe("getApiKeyMetadata", () => {
  it("enforces ownership in the query filter and projects the hash away", async () => {
    await getApiKeyMetadata("user_owner", "rkey_1", "proj_owned")
    const [filter, options] = mockFindOne.mock.calls[0]
    expect(filter).toEqual({ id: "rkey_1", userId: "user_owner", projectId: "proj_owned" })
    expect(options.projection).toMatchObject({ keyHash: 0 })
  })

  it("returns null (not an error) for another user's key", async () => {
    mockFindOne.mockResolvedValueOnce(null)
    expect(await getApiKeyMetadata("user_attacker", "rkey_victim")).toBeNull()
  })
})

describe("expiration semantics", () => {
  it("non-expiring keys are never expired", () => {
    expect(isApiKeyExpired({ expiresAt: undefined })).toBe(false)
  })

  it("future expiration is not yet expired; past expiration is", () => {
    const now = 1_000_000
    expect(isApiKeyExpired({ expiresAt: now + 1 }, now)).toBe(false)
    expect(isApiKeyExpired({ expiresAt: now }, now)).toBe(true) // now >= expiresAt
    expect(isApiKeyExpired({ expiresAt: now - 1 }, now)).toBe(true)
  })

  it("records are never deleted by expiry — only reclassified", () => {
    // The helper returns a STATUS; it performs no delete. effectiveKeyStatus
    // demonstrates the authorization-state contract.
    const now = 1_000_000
    expect(effectiveKeyStatus({ status: "active", expiresAt: now }, now)).toBe("expired")
    expect(effectiveKeyStatus({ status: "active", expiresAt: now + 1000 }, now)).toBe("active")
    expect(effectiveKeyStatus({ status: "revoked", expiresAt: now + 1000 }, now)).toBe("revoked")
  })
})

describe("security invariants", () => {
  it("rotation result carries the secret but no hash; old secret is unrecoverable", async () => {
    const old = makeActiveKey()
    const oldSecretHash = old.keyHash
    mockFindOne.mockResolvedValueOnce(old)

    const result = await rotateApiKey({ userId: "user_owner", keyId: "rkey_old" })

    expect(result.secret).toBeDefined()
    expect(JSON.stringify(result)).not.toContain("keyHash")
    expect((result as unknown as Record<string, unknown>).keyHash).toBeUndefined()
    // New secret hashes to the NEW hash, not the old one.
    expect(hashApiKey(result.secret)).not.toBe(oldSecretHash)
  })
})
