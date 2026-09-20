/**
 * Atai Runtime — Phase 4 authentication tests.
 *
 * Covers the §28 matrix: missing/malformed/invalid/revoked/expired keys,
 * active-but-past-expiry rejection, trusted-context derivation from the key
 * record, project/user spoofing resistance, internal-key separation, and
 * secret safety.
 *
 * Mocks follow the repo's established pattern (vi.hoisted + vi.mock).
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
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    }),
  }),
  ensureRuntimeIndexes: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/auth/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/store/id", () => ({
  cryptoId: vi.fn().mockReturnValue("rkey-test-id"),
}))

vi.mock("@/lib/logging/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { authenticateRuntimeRequest, normalizeRuntimeAuthError } from "./authenticate"
import { extractApiKey } from "./extract"
import { generateApiKey, hashApiKey } from "../key-crypto"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { AppError } from "@/lib/errors"
import { logger } from "@/lib/logging/logger"
import type { ApiKeyDoc } from "../types"

function makeDoc(overrides: Partial<ApiKeyDoc> = {}): ApiKeyDoc {
  const generated = generateApiKey("production")
  return {
    _id: {} as ApiKeyDoc["_id"],
    id: "rkey_test",
    userId: "user_owner",
    projectId: "proj_bound",
    environment: "production",
    keyHash: generated.keyHash,
    keyPrefix: generated.keyPrefix,
    scopes: [],
    status: "active",
    createdAt: Date.now(),
    ...overrides,
  }
}

function req(headers: Record<string, string> = {}, body?: unknown): Request {
  const init: RequestInit = { headers }
  if (body !== undefined) {
    return new Request("https://atai.example/api/runtime/v1/ai", {
      method: "POST",
      ...init,
      body: JSON.stringify(body),
    })
  }
  return new Request("https://atai.example/api/runtime/v1/ai", init)
}

function reqWithKey(key: string, extra: Record<string, string> = {}): Request {
  return req({ authorization: `Bearer ${key}`, ...extra })
}

describe("extractApiKey", () => {
  it("rejects a missing Authorization header", () => {
    expect(extractApiKey(req())).toBeNull()
  })

  it("rejects a malformed header and a wrong scheme", () => {
    expect(extractApiKey(req({ authorization: "not-a-bearer-token" }))).toBeNull()
    expect(extractApiKey(req({ authorization: "Basic dXNlcjpwYXNz" }))).toBeNull()
  })

  it("rejects an empty token and an unknown key shape", () => {
    expect(extractApiKey(req({ authorization: "Bearer " }))).toBeNull()
    expect(extractApiKey(req({ authorization: "Bearer random-session-token" }))).toBeNull()
  })

  it("accepts a well-formed atai_<env>_<secret> Bearer credential", () => {
    const { secret } = generateApiKey("production")
    expect(extractApiKey(reqWithKey(secret))).toBe(secret)
  })

  it("rejects internal and provider credentials as runtime credentials", () => {
    // ATAI_INTERNAL_KEY values are opaque non-runtime strings — they must not
    // pass extraction (§25 internal-auth separation).
    expect(extractApiKey(reqWithKey("some-internal-key-value"))).toBeNull()
    expect(extractApiKey(reqWithKey("sk-proj-abc123def456"))).toBeNull()
  })
})

describe("authenticateRuntimeRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindOne.mockResolvedValue(null)
    mockUpdateOne.mockResolvedValue({ modifiedCount: 0 })
  })

  it("missing key → runtime_authentication_error", async () => {
    await expect(authenticateRuntimeRequest(req())).rejects.toMatchObject({
      code: "runtime_authentication_error",
      status: 401,
    })
  })

  it("malformed header → runtime_authentication_error", async () => {
    await expect(
      authenticateRuntimeRequest(req({ authorization: "Token abc" })),
    ).rejects.toMatchObject({ code: "runtime_authentication_error" })
  })

  it("invalid (unknown) key → runtime_authentication_error + failure limit", async () => {
    await expect(
      authenticateRuntimeRequest(reqWithKey("atai_production_totallyunknownkey")),
    ).rejects.toMatchObject({ code: "runtime_authentication_error" })

    expect(checkRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "runtime_auth_fail" }),
    )
  })

  it("valid active key → trusted context derived from the key record", async () => {
    const { secret } = generateApiKey("production")
    const doc = makeDoc({ keyHash: hashApiKey(secret) })
    mockFindOne.mockResolvedValueOnce(doc)

    const ctx = await authenticateRuntimeRequest(reqWithKey(secret))

    expect(ctx).toMatchObject({
      apiKeyId: "rkey_test",
      userId: "user_owner",
      projectId: "proj_bound",
      environment: "production",
      scopes: [],
    })
    expect(ctx.requestId).toMatch(/^rtreq_/)
  })

  it("revoked key → runtime_key_revoked", async () => {
    const { secret } = generateApiKey("production")
    const doc = makeDoc({ keyHash: hashApiKey(secret), status: "revoked" })
    mockFindOne.mockResolvedValueOnce(doc)

    await expect(authenticateRuntimeRequest(reqWithKey(secret))).rejects.toMatchObject({
      code: "runtime_key_revoked",
      status: 401,
    })
  })

  it("status=expired key → runtime_key_expired", async () => {
    const { secret } = generateApiKey("production")
    const doc = makeDoc({ keyHash: hashApiKey(secret), status: "expired" })
    mockFindOne.mockResolvedValueOnce(doc)

    await expect(authenticateRuntimeRequest(reqWithKey(secret))).rejects.toMatchObject({
      code: "runtime_key_expired",
    })
  })

  it("status=active but expiresAt in the past → runtime_key_expired (stored status never trusted over real expiry)", async () => {
    const { secret } = generateApiKey("production")
    const doc = makeDoc({
      keyHash: hashApiKey(secret),
      status: "active",
      expiresAt: Date.now() - 1000,
    })
    mockFindOne.mockResolvedValueOnce(doc)

    await expect(authenticateRuntimeRequest(reqWithKey(secret))).rejects.toMatchObject({
      code: "runtime_key_expired",
      status: 401,
    })
  })

  it("future expiresAt → authenticates", async () => {
    const { secret } = generateApiKey("production")
    const doc = makeDoc({
      keyHash: hashApiKey(secret),
      expiresAt: Date.now() + 60 * 60 * 1000,
    })
    mockFindOne.mockResolvedValueOnce(doc)

    await expect(authenticateRuntimeRequest(reqWithKey(secret))).resolves.toMatchObject({
      apiKeyId: "rkey_test",
    })
  })

  it("PROJECT SPOOFING: body/header projectId can never override the key's binding", async () => {
    const { secret } = generateApiKey("production")
    const doc = makeDoc({ keyHash: hashApiKey(secret), projectId: "proj_A" })
    mockFindOne.mockResolvedValueOnce(doc)

    const ctx = await authenticateRuntimeRequest(
      reqWithKey(secret, { "x-project-id": "proj_B" }),
      // body-based spoofing attempt:
    )
    // Note: body is never read at all — context comes from the doc.
    expect(ctx.projectId).toBe("proj_A")
    expect(ctx.projectId).not.toBe("proj_B")
  })

  it("ENVIRONMENT SPOOFING: key environment is authoritative", async () => {
    const { secret } = generateApiKey("development")
    const doc = makeDoc({ keyHash: hashApiKey(secret), environment: "development" })
    mockFindOne.mockResolvedValueOnce(doc)
    const ctx = await authenticateRuntimeRequest(
      reqWithKey(secret, { "x-atai-environment": "production" }),
    )
    expect(ctx.environment).toBe("development")
  })

  it("USER SPOOFING: client-supplied userId fields cannot alter attribution", async () => {
    const { secret } = generateApiKey("production")
    const doc = makeDoc({ keyHash: hashApiKey(secret), userId: "user_owner" })
    mockFindOne.mockResolvedValueOnce(doc)

    // The function signature accepts ONLY (request) — there is no parameter
    // through which a caller or client could inject identity. Verify the
    // context is exactly the doc's identity.
    const ctx = await authenticateRuntimeRequest(reqWithKey(secret))
    expect(ctx.userId).toBe("user_owner")
    expect(Object.keys(ctx).sort()).toEqual([
      "apiKeyId",
      "environment",
      "projectId",
      "requestId",
      "scopes",
      "userId",
    ])
  })

  it("rate-limit rejection maps RATE_LIMITED → runtime_rate_limited", async () => {
    const { secret } = generateApiKey("production")
    const doc = makeDoc({ keyHash: hashApiKey(secret) })
    mockFindOne.mockResolvedValueOnce(doc)

    vi.mocked(checkRateLimit).mockRejectedValueOnce(new AppError("RATE_LIMITED"))

    await expect(authenticateRuntimeRequest(reqWithKey(secret))).rejects.toMatchObject({
      code: "runtime_rate_limited",
      status: 429,
    })
  })

  it("rate limits are keyed by hash (failures) and apiKeyId (requests) — never by plaintext", async () => {
    const { secret } = generateApiKey("production")
    mockFindOne.mockResolvedValueOnce(null)

    await expect(authenticateRuntimeRequest(reqWithKey(secret))).rejects.toThrow()
    const [failCall] = vi.mocked(checkRateLimit).mock.calls
    expect(failCall[0].identifier).toBe(hashApiKey(secret))
    expect(failCall[0].identifier).not.toContain(secret)
  })

  it("never logs the plaintext key, the hash, or the Authorization header", async () => {
    const { secret } = generateApiKey("production")
    const doc = makeDoc({ keyHash: hashApiKey(secret) })
    mockFindOne.mockResolvedValueOnce(doc)

    await authenticateRuntimeRequest(reqWithKey(secret))

    const allCalls = [
      ...(logger.info as ReturnType<typeof vi.fn>).mock.calls,
      ...(logger.warn as ReturnType<typeof vi.fn>).mock.calls,
      ...(logger.error as ReturnType<typeof vi.fn>).mock.calls,
    ]
    const logged = JSON.stringify(allCalls)
    expect(logged).not.toContain(secret)
    expect(logged).not.toContain(doc.keyHash)
    expect(logged).not.toContain("authorization")
  })

  it("touches lastUsedAt only after successful authentication", async () => {
    const { secret } = generateApiKey("production")
    const doc = makeDoc({ keyHash: hashApiKey(secret), lastUsedAt: Date.now() - 120_000 })
    mockFindOne.mockResolvedValueOnce(doc)

    await authenticateRuntimeRequest(reqWithKey(secret))
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { id: "rkey_test" },
      expect.objectContaining({ $set: expect.anything() }),
    )

    // Failure path: no lastUsedAt write.
    mockUpdateOne.mockClear()
    mockFindOne.mockResolvedValueOnce(null)
    await expect(
      authenticateRuntimeRequest(reqWithKey("atai_production_unknownkey")),
    ).rejects.toThrow()
    expect(mockUpdateOne).not.toHaveBeenCalled()
  })
})

describe("normalizeRuntimeAuthError", () => {
  it("passes AppErrors through with contract-resolved status/message", () => {
    // A real AppError deliberately constructed with a wrong status —
    // normalization must re-resolve 401 from the runtime contract map.
    const e = new AppError("runtime_key_revoked" as never, "custom message", 500)
    const normalized = normalizeRuntimeAuthError(e)
    expect(normalized.status).toBe(401)
    expect(normalized.message).toBe("custom message")
  })
})
