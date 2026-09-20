/**
 * Atai Runtime — multi-project / multi-key model tests (Phase 3 addendum).
 *
 * Proves:
 *  - a user may hold MANY keys, and a project MANY keys, including multiple
 *    for the same (userId, projectId, environment) — no artificial uniqueness
 *  - keys remain bound to exactly one (userId, projectId, environment)
 *  - programmatic provisioning derives ownership from the project record
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

const { mockInsertOne, mockFindOne } = vi.hoisted(() => ({
  mockInsertOne: vi.fn().mockResolvedValue({ insertedId: "mock-id" }),
  mockFindOne: vi.fn().mockResolvedValue(null),
}))

vi.mock("@/lib/store/store", () => ({
  store: { getProject: vi.fn() },
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
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  }),
  ensureRuntimeIndexes: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/store/id", () => ({
  cryptoId: vi.fn(() => `id-${Math.random().toString(36).slice(2)}`),
}))

vi.mock("@/lib/logging/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { createApiKey, findActiveApiKeyBySecret } from "./service"
import { provisionApiKeyForProject } from "./provisioning"
import { generateApiKey } from "../key-crypto"
import { store } from "@/lib/store/store"
import type { ApiKeyDoc } from "../types"

// Simulate the unique index: track hashes the "collection" has seen.
const seenHashes = new Set<string>()
// In-memory docs so hash lookups can resolve, like the real unique index would.
const insertedDocs: ApiKeyDoc[] = []

function insertHarness() {
  mockInsertOne.mockImplementation(async (doc: ApiKeyDoc) => {
    if (seenHashes.has(doc.keyHash)) {
      throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 })
    }
    seenHashes.add(doc.keyHash)
    insertedDocs.push(doc)
    return { insertedId: "mock-id" }
  })
  // findOne behaves like the real hash-index lookup.
  mockFindOne.mockImplementation(async (query: { keyHash?: string }) => {
    if (!query.keyHash) return null
    return insertedDocs.find((d) => d.keyHash === query.keyHash) ?? null
  })
}

function docOf(call: number): ApiKeyDoc {
  return mockInsertOne.mock.calls[call][0] as ApiKeyDoc
}

describe("multi-project / multi-key model (addendum)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seenHashes.clear()
    insertHarness()
  })

  it("allows MANY keys for the same userId + projectId + environment", async () => {
    for (let i = 0; i < 5; i++) {
      await createApiKey("user_A", {
        projectId: "proj_A",
        environment: "production",
        scopes: ["ai.text"],
        name: `key-${i}`,
      })
    }

    expect(mockInsertOne).toHaveBeenCalledTimes(5)
    const docs = [0, 1, 2, 3, 4].map(docOf)
    for (const d of docs) {
      expect(d.userId).toBe("user_A")
      expect(d.projectId).toBe("proj_A")
      expect(d.environment).toBe("production")
    }
    // All distinct secrets/hashes — five independent valid credentials.
    const hashes = new Set(docs.map((d) => d.keyHash))
    expect(hashes.size).toBe(5)
  })

  it("supports the full addendum shape: multiple projects × both environments", async () => {
    for (const projectId of ["proj_A", "proj_B", "proj_C"]) {
      await createApiKey("user_A", { projectId, environment: "development", scopes: [] })
      await createApiKey("user_A", { projectId, environment: "production", scopes: [] })
    }

    expect(mockInsertOne).toHaveBeenCalledTimes(6)
    const docs = Array.from({ length: 6 }, (_, i) => docOf(i))
    expect(new Set(docs.map((d) => d.projectId)).size).toBe(3)
    // Every key keeps its exact binding.
    for (const d of docs) {
      expect(["development", "production"]).toContain(d.environment)
      expect(d.userId).toBe("user_A")
    }
  })

  it("keys for different projects are different credentials", async () => {
    const a = await createApiKey("user_A", { projectId: "proj_A", environment: "production", scopes: ["ai.text"] })
    const b = await createApiKey("user_A", { projectId: "proj_B", environment: "production", scopes: ["ai.text"] })
    expect(a.secret).not.toBe(b.secret)
    expect(a.projectId).toBe("proj_A")
    expect(b.projectId).toBe("proj_B")
  })

  it("hash lookup resolves the exact key for its binding (project A ≠ project B)", async () => {
    const keyA = await createApiKey("user_A", { projectId: "proj_A", environment: "production", scopes: [] })
    await createApiKey("user_A", { projectId: "proj_B", environment: "production", scopes: [] })

    const docA = docOf(0)
    const found = await findActiveApiKeyBySecret(keyA.secret)
    // The lookup is by hash; the resolved binding must be Project A's.
    expect(found).not.toBeNull()
    expect(found!.projectId).toBe(docA.projectId)
    expect(found!.projectId).toBe("proj_A")
    expect(generateApiKey("production").keyHash).not.toBe(docA.keyHash)
  })
})

describe("programmatic provisioning (addendum: not auto-wired)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seenHashes.clear()
    insertedDocs.length = 0
    insertHarness()
  })

  it("derives userId from the project record — never from a caller-supplied field", async () => {
    vi.mocked(store.getProject).mockResolvedValueOnce({
      id: "proj_B",
      userId: "user_real_owner",
    } as never)

    const created = await provisionApiKeyForProject({
      projectId: "proj_B",
      environment: "production",
      scopes: ["ai.text"],
      name: "provisioned",
    })

    const doc = docOf(0)
    expect(doc.userId).toBe("user_real_owner")
    expect(doc.projectId).toBe("proj_B")
    expect(created.secret).toMatch(/^atai_production_/)
  })

  it("refuses to provision for a project that does not exist", async () => {
    vi.mocked(store.getProject).mockResolvedValueOnce(null)

    await expect(
      provisionApiKeyForProject({ projectId: "proj_ghost", environment: "production", scopes: [] }),
    ).rejects.toThrow("RUNTIME_PROJECT_NOT_FOUND")
    expect(mockInsertOne).not.toHaveBeenCalled()
  })

  it("requires explicit scopes (never silently grants all capabilities)", async () => {
    vi.mocked(store.getProject).mockResolvedValueOnce({
      id: "proj_A",
      userId: "user_A",
    } as never)

    // TypeScript enforces scopes at compile time; assert runtime behavior too
    // by passing an explicit empty array and confirming it persists as-is.
    await provisionApiKeyForProject({ projectId: "proj_A", environment: "development", scopes: [] })
    const doc = docOf(0)
    expect(doc.scopes).toEqual([])
  })
})
