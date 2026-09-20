/**
 * GET /api/runtime/v1/health — authenticated project health check.
 *
 * Exercises the Phase 4 authentication path at the route boundary: valid,
 * invalid, revoked, and expired credentials; safe-metadata response shape;
 * and isolation (the response carries only the authenticated key's identity).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

const { mockFindOne, mockUpdateOne } = vi.hoisted(() => ({
  mockFindOne: vi.fn().mockResolvedValue(null),
  mockUpdateOne: vi.fn().mockResolvedValue({ modifiedCount: 0 }),
}))

vi.mock("@/lib/db/runtime-collections", () => ({
  apiKeysCol: vi.fn().mockResolvedValue({
    findOne: mockFindOne,
    updateOne: mockUpdateOne,
  }),
  ensureRuntimeIndexes: vi.fn().mockResolvedValue(undefined),
  runtimeUsageCol: vi.fn().mockResolvedValue({
    insertOne: vi.fn(),
  }),
}))

vi.mock("@/lib/auth/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/billing/credit-service", () => ({
  consumeCredits: vi.fn(),
  getAvailableCredits: vi.fn().mockResolvedValue(0),
  getBalance: vi.fn().mockResolvedValue({ total: 0, subscription: 0, permanent: 0 }),
}))

vi.mock("@/lib/store/id", () => ({
  cryptoId: vi.fn().mockReturnValue("rkey-test-id"),
}))

vi.mock("@/lib/logging/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock("@/lib/runtime/control/config-store", () => ({
  getCachedProjectRuntimeConfig: vi.fn().mockResolvedValue({
    projectId: "proj_bound",
    allowedModels: [],
    fallbackModels: [],
    allowEndUserModelSelection: true,
    limits: {},
    createdAt: 1,
    updatedAt: 1,
  }),
}))

import { GET } from "./route"
import { generateApiKey, hashApiKey } from "@/lib/runtime/key-crypto"
import type { ApiKeyDoc } from "@/lib/runtime/types"

function makeDoc(secret: string, overrides: Partial<ApiKeyDoc> = {}): ApiKeyDoc {
  return {
    _id: {} as ApiKeyDoc["_id"],
    id: "rkey_health",
    userId: "user_owner",
    projectId: "proj_bound",
    environment: "production",
    keyHash: hashApiKey(secret),
    keyPrefix: "atai_production_h",
    scopes: ["ai.text"],
    status: "active",
    createdAt: Date.now(),
    ...overrides,
  }
}

function healthRequest(key?: string): Request {
  return new Request("https://atai.example/api/runtime/v1/health", {
    method: "GET",
    headers: key ? { authorization: `Bearer ${key}` } : {},
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFindOne.mockResolvedValue(null)
})

describe("GET /api/runtime/v1/health", () => {
  it("missing Authorization → 401 runtime_authentication_error", async () => {
    const res = await GET(healthRequest())
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe("runtime_authentication_error")
  })

  it("unknown key → 401", async () => {
    const res = await GET(healthRequest("atai_production_unknownkey123456"))
    expect(res.status).toBe(401)
  })

  it("revoked key → 401 runtime_key_revoked (fail closed)", async () => {
    const secret = "atai_production_revokedhealthkey123"
    mockFindOne.mockResolvedValueOnce(makeDoc(secret, { status: "revoked" }))
    const res = await GET(healthRequest(secret))
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe("runtime_key_revoked")
  })

  it("expired key → 401 runtime_key_expired (stored status never overrides real expiry)", async () => {
    const secret = "atai_production_expiredhealthkey12"
    mockFindOne.mockResolvedValueOnce(makeDoc(secret, { status: "active", expiresAt: Date.now() - 1000 }))
    const res = await GET(healthRequest(secret))
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe("runtime_key_expired")
  })

  it("valid key → operational status with SAFE metadata only", async () => {
    const secret = `atai_production_${generateApiKey("production").secret.slice("atai_production_".length)}`
    mockFindOne.mockResolvedValueOnce(makeDoc(secret))
    const res = await GET(healthRequest(secret))
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.ok).toBe(true)
    const data = json.data
    expect(data.status).toBe("operational")
    expect(data.requestId).toMatch(/^rtreq_[a-f0-9]{32}$/)
    expect(data.identity).toEqual({
      projectId: "proj_bound",
      environment: "production",
      apiKeyId: "rkey_health",
      scopes: ["ai.text"],
    })
    expect(data.key.status).toBe("active")
    expect(Array.isArray(data.lifecycle)).toBe(true)
    expect(data.lifecycle).toContain("authenticated")
    expect(data.lifecycle).toContain("charge_recorded")
  })

  it("response never contains the presented secret, a key hash, or userId", async () => {
    const secret = "atai_production_secrethealthkey1234567"
    mockFindOne.mockResolvedValueOnce(makeDoc(secret))
    const res = await GET(healthRequest(secret))
    const serialized = JSON.stringify(await res.json())
    expect(serialized).not.toContain(secret)
    expect(serialized).not.toContain("keyHash")
    expect(serialized).not.toContain("user_owner")
  })

  it("identity comes from the key record — a spoofed header cannot change the project", async () => {
    const secret = "atai_production_identityhealthkey123"
    // The key belongs to proj_bound; there is no way to request another
    // project's identity — but prove a spoof attempt changes nothing.
    mockFindOne.mockResolvedValueOnce(makeDoc(secret))
    const req = new Request("https://atai.example/api/runtime/v1/health?projectId=proj_victim", {
      method: "GET",
      headers: { authorization: `Bearer ${secret}`, "x-project-id": "proj_victim" },
    })
    const res = await GET(req)
    const data = (await res.json()).data
    expect(data.identity.projectId).toBe("proj_bound")
    expect(JSON.stringify(data)).not.toContain("proj_victim")
  })
})
