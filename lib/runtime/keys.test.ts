/**
 * Atai Runtime — key service tests (Phase 2 §34: secret handling, ownership,
 * status lifecycle, scopes, security invariants).
 *
 * Mocks the collections layer following the repo's established pattern
 * (vi.hoisted + vi.mock, cf. lib/planning/tracking/planning-run.tracker.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// Repo runs Vitest outside the Next server bundle — mock the marker package.
vi.mock("server-only", () => ({}))

const { mockInsertOne, mockFindOne, mockFind, mockUpdateOne, mockUpdateMany } = vi.hoisted(() => ({
  mockInsertOne: vi.fn().mockResolvedValue({ insertedId: "mock-id" }),
  mockFindOne: vi.fn().mockResolvedValue(null),
  mockFind: vi.fn().mockReturnValue({
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue([]),
  }),
  mockUpdateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  mockUpdateMany: vi.fn().mockResolvedValue({ modifiedCount: 0 }),
}))

vi.mock("@/lib/db/runtime-collections", () => ({
  apiKeysCol: vi.fn().mockResolvedValue({
    insertOne: mockInsertOne,
    findOne: mockFindOne,
    find: mockFind,
    updateOne: mockUpdateOne,
    updateMany: mockUpdateMany,
  }),
  ensureRuntimeIndexes: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/store/id", () => ({
  cryptoId: vi.fn().mockReturnValue("rkey-test-id"),
}))

vi.mock("@/lib/logging/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  findActiveApiKeyBySecret,
  touchLastUsed,
} from "./keys/service"
import { generateApiKey } from "./key-crypto"
import { rejectsOwnershipInjection } from "@/runtime/contracts/validation"
import type { ApiKeyDoc } from "./types"

function makeDoc(overrides: Partial<ApiKeyDoc> = {}): ApiKeyDoc {
  const generated = generateApiKey("production")
  return {
    _id: {} as ApiKeyDoc["_id"],
    id: "rkey_test",
    userId: "user_owner",
    projectId: "proj_owned",
    environment: "production",
    keyHash: generated.keyHash,
    keyPrefix: generated.keyPrefix,
    scopes: [],
    status: "active",
    createdAt: Date.now(),
    ...overrides,
  }
}

describe("runtime key service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsertOne.mockResolvedValue({ insertedId: "mock-id" })
    mockFindOne.mockResolvedValue(null)
    mockFind.mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    })
    mockUpdateOne.mockResolvedValue({ modifiedCount: 1 })
    mockUpdateMany.mockResolvedValue({ modifiedCount: 0 })
  })

  describe("createApiKey", () => {
    it("persists a doc with NO plaintext secret field", async () => {
      await createApiKey("user_1", {
        projectId: "proj_1",
        environment: "production",
        scopes: ["ai.text"],
      })

      const doc = mockInsertOne.mock.calls[0][0] as ApiKeyDoc
      const serialized = JSON.stringify(doc)
      expect(serialized).not.toContain("secret")
      expect(doc.keyHash).toMatch(/^[a-f0-9]{64}$/)
      expect(doc.status).toBe("active")
    })

    it("returns the plaintext exactly once alongside public metadata", async () => {
      const created = await createApiKey("user_1", {
        projectId: "proj_1",
        environment: "development",
        scopes: [],
      })
      expect(created.secret).toMatch(/^atai_development_/)
      expect(created.keyPrefix).toBeDefined()
      // The returned object is the ONLY place the plaintext exists.
      expect(JSON.parse(JSON.stringify(created)).secret).toBe(created.secret)
    })

    it("persists scopes and optional fields", async () => {
      const expiresAt = Date.now() + 86_400_000
      await createApiKey("user_1", {
        projectId: "proj_1",
        environment: "production",
        scopes: ["search.web", "payments"],
        expiresAt,
        name: "My key",
      })
      const doc = mockInsertOne.mock.calls[0][0] as ApiKeyDoc
      expect(doc.scopes).toEqual(["search.web", "payments"])
      expect(doc.expiresAt).toBe(expiresAt)
      expect(doc.name).toBe("My key")
    })
  })

  describe("listApiKeys", () => {
    it("queries with BOTH userId and projectId (ownership in the filter)", async () => {
      await listApiKeys("user_1", "proj_1")
      const [filter] = mockFind.mock.calls[0]
      expect(filter).toEqual({ userId: "user_1", projectId: "proj_1" })
    })

    it("projects the hash away so metadata can never leak it", async () => {
      await listApiKeys("user_1", "proj_1")
      const [, options] = mockFind.mock.calls[0]
      expect(options.projection).toMatchObject({ keyHash: 0 })
    })
  })

  describe("revokeApiKey", () => {
    it("enforces ownership inside the query filter", async () => {
      await revokeApiKey("user_attacker", "rkey_victim", "attempt")
      const [filter] = mockUpdateOne.mock.calls[0]
      expect(filter).toMatchObject({ id: "rkey_victim", userId: "user_attacker" })
    })

    it("returns false and modifies nothing when not the owner", async () => {
      mockUpdateOne.mockResolvedValueOnce({ modifiedCount: 0 })
      const result = await revokeApiKey("user_attacker", "rkey_victim", "attempt")
      expect(result).toBe(false)
      // The update targeted the attacker's userId — the real doc (different
      // userId) could never match, so nothing was revoked.
      expect(mockUpdateOne).toHaveBeenCalledOnce()
    })

    it("sets status/revokedAt/revokedReason on success", async () => {
      const result = await revokeApiKey("user_owner", "rkey_test", "compromised")
      expect(result).toBe(true)
      const [filter, update] = mockUpdateOne.mock.calls[0]
      expect(filter).toMatchObject({ id: "rkey_test", userId: "user_owner", status: "active" })
      expect(update.$set.status).toBe("revoked")
      expect(update.$set.revokedReason).toBe("compromised")
      expect(typeof update.$set.revokedAt).toBe("number")
    })

    it("supports project-scoped revocation", async () => {
      await revokeApiKey("user_owner", "rkey_test", "cleanup", "proj_owned")
      const [filter] = mockUpdateOne.mock.calls[0]
      expect(filter.projectId).toBe("proj_owned")
    })
  })

  describe("findActiveApiKeyBySecret", () => {
    it("resolves an active, unexpired key by its secret", async () => {
      const doc = makeDoc()
      mockFindOne.mockResolvedValueOnce(doc)
      const found = await findActiveApiKeyBySecret("atai_production_x")
      expect(found).not.toBeNull()
      const [query] = mockFindOne.mock.calls[0]
      expect(query.status).toBe("active")
      // expiry exclusions baked into the lookup
      expect(query.$or).toEqual([
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: expect.any(Number) } },
      ])
    })

    it("returns null for unknown/revoked/expired secrets (generic failure)", async () => {
      mockFindOne.mockResolvedValue(null)
      expect(await findActiveApiKeyBySecret("atai_production_wrong")).toBeNull()
      // The lookup is by hash — a wrong secret simply misses the unique index.
      const [query] = mockFindOne.mock.calls[0]
      expect(Object.keys(query)).not.toContain("id")
    })
  })

  describe("touchLastUsed", () => {
    it("throttles writes to once per 60s per key", async () => {
      const now = Date.now()
      await touchLastUsed("rkey_1", now - 10_000) // recent → skip
      expect(mockUpdateOne).not.toHaveBeenCalled()

      await touchLastUsed("rkey_1", now - 120_000) // stale → write
      expect(mockUpdateOne).toHaveBeenCalledOnce()
      expect(mockUpdateOne.mock.calls[0][0]).toEqual({ id: "rkey_1" })
    })

    it("never throws when the write fails", async () => {
      mockUpdateOne.mockRejectedValueOnce(new Error("db down"))
      await expect(touchLastUsed("rkey_1", undefined)).resolves.toBeUndefined()
    })
  })

  describe("security invariant: client ownership injection", () => {
    it("rejects payloads trying to set userId/projectId via the body", () => {
      expect(
        rejectsOwnershipInjection({
          environment: "production",
          scopes: [],
          userId: "user_victim",
          projectId: "proj_victim",
        }),
      ).toBe(true)
    })

    it("accepts legitimate creation payloads", () => {
      expect(
        rejectsOwnershipInjection({ environment: "production", scopes: [] }),
      ).toBe(false)
    })
  })
})
