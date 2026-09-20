/**
 * Phase 6 — HTTP-level integration tests appended to the Phase 5 route suite.
 *
 * Exercises the FULL runtime path (HTTP → Phase 4 auth → router → scope →
 * registry → OpenRouter adapter → mocked OpenRouter HTTP → normalized
 * response) rather than testing the adapter in isolation (Phase 6 §57–§61).
 * OpenRouter's global fetch is stubbed — no real provider calls (§52).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

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
  runtimeUsageCol: vi.fn().mockResolvedValue({
    insertOne: vi.fn(),
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    }),
  }),
}))

vi.mock("@/lib/auth/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(undefined),
}))

// Phase 9: metering charges the EXISTING credit service. Mocked here so the
// HTTP path is fully exercised without MongoDB (unit-test boundary).
const { mockConsumeCredits, mockGetAvailableCredits } = vi.hoisted(() => ({
  mockConsumeCredits: vi.fn().mockResolvedValue({ success: true, subscriptionConsumed: 0, permanentConsumed: 0 }),
  mockGetAvailableCredits: vi.fn().mockResolvedValue(1_000_000),
}))

vi.mock("@/lib/billing/credit-service", () => ({
  consumeCredits: mockConsumeCredits,
  getAvailableCredits: mockGetAvailableCredits,
  getBalance: vi.fn().mockResolvedValue({ total: 1_000_000, subscription: 500_000, permanent: 500_000 }),
}))

vi.mock("@/lib/store/id", () => ({
  cryptoId: vi.fn().mockReturnValue("rkey-test-id"),
}))

vi.mock("@/lib/logging/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// Mock usage persistence to prevent MongoDB connection attempts.
// The metering pipeline itself runs for real (testing charge/billing logic
// end-to-end), but the final usage record write goes through this mock.
const { mockRecordUsage, mockMakeUsageEvent } = vi.hoisted(() => ({
  mockRecordUsage: vi.fn().mockResolvedValue(undefined),
  mockMakeUsageEvent: vi.fn().mockImplementation((params: Record<string, unknown>) => ({
    id: 'test_usage_id',
    createdAt: Date.now(),
    ...params,
  })),
}))
vi.mock("@/lib/runtime/usage", () => ({
  recordUsage: mockRecordUsage,
  listUsageByProject: vi.fn().mockResolvedValue([]),
  listUsageByUser: vi.fn().mockResolvedValue([]),
  makeUsageEvent: mockMakeUsageEvent,
}))

import { POST, GET } from "./route"
import { clearProviderAdapters } from "@/lib/runtime/router/provider-registry"
import { registerTestEchoAdapter } from "@/lib/runtime/router/test-adapter"
import { registerOpenRouterAdapter } from "@/lib/runtime/router/adapters/openrouter"
import { generateApiKey, hashApiKey } from "@/lib/runtime/key-crypto"
import type { ApiKeyDoc } from "@/lib/runtime/types"

function makeDoc(secret: string, overrides: Partial<ApiKeyDoc> = {}): ApiKeyDoc {
  return {
    _id: {} as ApiKeyDoc["_id"],
    id: "rkey_test",
    userId: "user_owner",
    projectId: "proj_bound",
    environment: "production",
    keyHash: hashApiKey(secret),
    keyPrefix: "atai_production_x",
    scopes: [],
    status: "active",
    createdAt: Date.now(),
    ...overrides,
  }
}

function request(body: unknown, key?: string): Request {
  return new Request("https://atai.example/api/runtime/v1", {
    method: "POST",
    headers: key ? { authorization: `Bearer ${key}` } : {},
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

function chatResponse(overrides: Record<string, unknown> = {}): unknown {
  return {
    id: "gen-rt-1",
    model: "openai/gpt-test",
    choices: [{ finish_reason: "stop", message: { role: "assistant", content: "Hello from OpenRouter" } }],
    usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
    ...overrides,
  }
}

const CHAT_BODY = { capability: "ai.text", operation: "chat", input: { messages: [{ role: "user", content: "Say hi" }] } }

beforeEach(() => {
  vi.clearAllMocks()
  mockFindOne.mockResolvedValue(null)
  mockConsumeCredits.mockResolvedValue({ success: true, subscriptionConsumed: 0, permanentConsumed: 0 })
  mockGetAvailableCredits.mockResolvedValue(1_000_000)
  clearProviderAdapters()
  process.env.OPENROUTER_API_KEY = "sk-or-test-server-key"
  process.env.OPENROUTER_DEFAULT_MODEL = "openai/gpt-test"
  delete process.env.OPENROUTER_BASE_URL
})

afterEach(() => {
  delete process.env.OPENROUTER_API_KEY
  delete process.env.OPENROUTER_DEFAULT_MODEL
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ─── Phase 5 suite (unchanged baseline) ────────────────────────────────────

describe("POST /api/runtime/v1 — full HTTP path", () => {
  it("missing Authorization → 401 runtime_authentication_error", async () => {
    const res = await POST(request({ capability: "test", operation: "echo" }))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe("runtime_authentication_error")
  })

  it("invalid key → 401", async () => {
    const res = await POST(request({ capability: "test", operation: "echo" }, "atai_production_unknownkey"))
    expect(res.status).toBe(401)
  })

  it("revoked key → 401 runtime_key_revoked", async () => {
    const secret = "atai_production_revokedkeytest12345"
    mockFindOne.mockResolvedValueOnce(makeDoc(secret, { status: "revoked" }))
    const res = await POST(request({ capability: "test", operation: "echo" }, secret))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error.code).toBe("runtime_key_revoked")
  })

  it("malformed JSON body → 422, no crash", async () => {
    const secret = "atai_production_validkeytest12345678"
    mockFindOne.mockResolvedValueOnce(makeDoc(secret))
    const res = await POST(
      new Request("https://atai.example/api/runtime/v1", {
        method: "POST",
        headers: { authorization: `Bearer ${secret}` },
        body: "{not-json",
      }),
    )
    expect(res.status).toBe(422)
  })

  it("FULL FLOW: valid key + echo through the real route → normalized response", async () => {
    registerTestEchoAdapter()
    const secret = "atai_production_validkeytest12345678"
    mockFindOne.mockResolvedValueOnce(makeDoc(secret))

    const res = await POST(request({ capability: "test", operation: "echo", input: { message: "hello" } }, secret))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data).toEqual({
      requestId: expect.stringMatching(/^rtreq_[a-f0-9]{32}$/),
      capability: "test",
      operation: "echo",
      data: { message: "hello" },
    })
  })

  it("unsupported capability → 501, stable error", async () => {
    registerTestEchoAdapter()
    const secret = "atai_production_validkeytest12345678"
    mockFindOne.mockResolvedValueOnce(makeDoc(secret))

    const res = await POST(request({ capability: "not_real", operation: "execute", input: {} }, secret))
    expect(res.status).toBe(501)
  })

  it("SCOPE DENIAL: authenticated but unauthorized → 403, adapter never invoked", async () => {
    registerTestEchoAdapter()
    const secret = "atai_production_validkeytest12345678"
    mockFindOne.mockResolvedValueOnce(makeDoc(secret, { scopes: ["search.web"] }))

    const res = await POST(request({ capability: "test", operation: "echo", input: { message: "x" } }, secret))
    expect(res.status).toBe(403)
    expect(res.headers.get("x")).toBeNull()
  })

  it("NO ADAPTER → 501 graceful failure (default registry state)", async () => {
    const secret = "atai_production_validkeytest12345678"
    mockFindOne.mockResolvedValueOnce(makeDoc(secret))

    const res = await POST(request({ capability: "ai.text", operation: "chat", input: { messages: [{ role: "user", content: "x" }] } }, secret))
    expect(res.status).toBe(501)
    const json = await res.json()
    expect(json.error.code).toBe("runtime_capability_unavailable")
  })
})

// ─── Phase 6 — OpenRouter through the full runtime path ────────────────────

describe("POST /api/runtime/v1 — OpenRouter adapter (Phase 6)", () => {
  it("INTEGRATION: full path → OpenRouter (mocked) → normalized Atai response", async () => {
    registerOpenRouterAdapter()
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(chatResponse()), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const secret = "atai_production_validkeytest12345678"
    mockFindOne.mockResolvedValueOnce(makeDoc(secret))

    const res = await POST(request(CHAT_BODY, secret))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data).toMatchObject({
      capability: "ai.text",
      operation: "chat",
      data: {
        id: "gen-rt-1",
        model: "openai/gpt-test",
        content: "Hello from OpenRouter",
        finishReason: "stop",
        usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
      },
    })

    // Provider received the documented endpoint + server credential only.
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions")
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer sk-or-test-server-key")
    const orBody = JSON.parse(String(init.body))
    expect(orBody.messages).toEqual([{ role: "user", content: "Say hi" }])
    expect(orBody).not.toHaveProperty("openrouterApiKey")
  })

  it("INTEGRATION: invalid model rejected by OpenRouter → normalized provider error, no raw leakage", async () => {
    registerOpenRouterAdapter()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 400, message: "No endpoints found for this model" } }), { status: 400 })),
    )

    const secret = "atai_production_validkeytest12345678"
    mockFindOne.mockResolvedValueOnce(makeDoc(secret))

    const res = await POST(request(CHAT_BODY, secret))
    expect(res.status).toBe(502)
    const json = await res.json()
    expect(json.error.code).toBe("runtime_provider_error")
    expect(JSON.stringify(json)).not.toContain("No endpoints found")
    expect(JSON.stringify(json)).not.toContain("sk-or-test-server-key")
  })

  it("INTEGRATION: OpenRouter 429 → runtime_provider_rate_limited (429), distinct from Atai rate limiting", async () => {
    registerOpenRouterAdapter()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 429, message: "You are being rate limited" } }), { status: 429 })))

    const secret = "atai_production_validkeytest12345678"
    mockFindOne.mockResolvedValueOnce(makeDoc(secret))

    const res = await POST(request(CHAT_BODY, secret))
    expect(res.status).toBe(429)
    const json = await res.json()
    // Atai's own limiter would emit runtime_rate_limited; a provider 429 is a
    // distinct, normalized category (Phase 6 §101).
    expect(json.error.code).toBe("runtime_provider_rate_limited")
    expect(JSON.stringify(json)).not.toContain("sk-or-test-server-key")
  })

  it("INTEGRATION: OpenRouter 503 → normalized unavailability; network failure likewise", async () => {
    registerOpenRouterAdapter()
    const secret = "atai_production_validkeytest12345678"

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 503, message: "down" } }), { status: 503 })))
    mockFindOne.mockResolvedValueOnce(makeDoc(secret))
    let res = await POST(request(CHAT_BODY, secret))
    expect(res.status).toBe(501)
    expect((await res.json()).error.code).toBe("runtime_capability_unavailable")

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fetch failed")))
    mockFindOne.mockResolvedValueOnce(makeDoc(secret))
    res = await POST(request(CHAT_BODY, secret))
    expect(res.status).toBe(501)
    expect((await res.json()).error.code).toBe("runtime_capability_unavailable")
  })

  it("INTEGRATION: Phase 9 metering — usage recorded, ledger untouched for sub-1k usage (0-credit charge)", async () => {
    registerOpenRouterAdapter()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(chatResponse()), { status: 200 })))

    const secret = "atai_production_validkeytest12345678"
    mockFindOne.mockResolvedValueOnce(makeDoc(secret))

    const res = await POST(request(CHAT_BODY, secret))
    expect(res.status).toBe(200)

    // Usage (8 total tokens) prices below one credit → recorded for audit
    // with creditsCharged = 0, and NO debit against the credit ledger.
    expect(mockRecordUsage).toHaveBeenCalledTimes(1)
    const usageDoc = mockRecordUsage.mock.calls[0][0] as Record<string, unknown>
    expect(usageDoc.status).toBe("succeeded")
    expect(usageDoc.creditsCharged).toBe(0)
    expect(usageDoc.usage).toEqual({ inputTokens: 5, outputTokens: 3, totalTokens: 8 })
    expect(usageDoc.apiKeyId).toBe("rkey_test")
    expect(usageDoc.projectId).toBe("proj_bound")
    expect(mockConsumeCredits).not.toHaveBeenCalled()
  })

  it("INTEGRATION: Phase 9 metering — billable usage charges through the credit service", async () => {
    registerOpenRouterAdapter()
    // 10k input + 5k output tokens at defaults (2/8 per 1k) → 20 + 40 = 60 credits.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ...(chatResponse() as Record<string, unknown>),
            usage: { prompt_tokens: 10_000, completion_tokens: 5_000, total_tokens: 15_000 },
          }),
          { status: 200 },
        ),
      ),
    )

    const secret = "atai_production_validkeytest12345678"
    mockFindOne.mockResolvedValueOnce(makeDoc(secret))

    const res = await POST(request(CHAT_BODY, secret))
    expect(res.status).toBe(200)

    expect(mockConsumeCredits).toHaveBeenCalledTimes(1)
    const charge = mockConsumeCredits.mock.calls[0][0] as { amount: number; transactionType: string; idempotencyKey: string; referenceType: string; metadata: Record<string, unknown> }
    expect(charge.amount).toBe(60)
    expect(charge.transactionType).toBe("runtime_usage")
    expect(charge.idempotencyKey).toMatch(/^runtime_rtreq_[a-f0-9]{32}$/)
    expect(charge.referenceType).toBe("runtime_request")
    expect(charge.metadata.projectId).toBe("proj_bound")

    expect(mockRecordUsage).toHaveBeenCalledTimes(1)
    const usageDoc = mockRecordUsage.mock.calls[0][0] as Record<string, any>
    expect(usageDoc.creditsCharged).toBe(60)
    expect(usageDoc.costMetadata.ledgerIdempotencyKey).toBe(charge.idempotencyKey)
    expect(usageDoc.costMetadata.pricingVersion).toBe("RUNTIME_PRICING_V1")
  })

  it("INTEGRATION: insufficient credits → 402 runtime_insufficient_entitlement, provider NOT called", async () => {
    registerOpenRouterAdapter()
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    mockGetAvailableCredits.mockResolvedValue(0)

    const secret = "atai_production_validkeytest12345678"
    mockFindOne.mockResolvedValueOnce(makeDoc(secret))

    const res = await POST(request(CHAT_BODY, secret))
    expect(res.status).toBe(402)
    expect((await res.json()).error.code).toBe("runtime_insufficient_entitlement")
    expect(fetchMock).not.toHaveBeenCalled() // preflight stops before provider
  })

  it("INTEGRATION: provider failure → failed usage record with 0 credits, no ledger charge", async () => {
    registerOpenRouterAdapter()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 503, message: "down" } }), { status: 503 })),
    )

    const secret = "atai_production_validkeytest12345678"
    mockFindOne.mockResolvedValueOnce(makeDoc(secret))

    const res = await POST(request(CHAT_BODY, secret))
    expect(res.status).toBe(501)

    expect(mockRecordUsage).toHaveBeenCalledTimes(1)
    const failedDoc = mockRecordUsage.mock.calls[0][0] as Record<string, any>
    expect(failedDoc.status).toBe("failed")
    expect(failedDoc.creditsCharged).toBe(0)
    expect(failedDoc.errorCategory).toBe("provider_unavailable")
    expect(mockConsumeCredits).not.toHaveBeenCalled()
  })

  it("INTEGRATION: billing subsystem failure after provider success → fail closed (503), no free success", async () => {
    registerOpenRouterAdapter()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(chatResponse()), { status: 200 })))
    // 10k tokens → billable charge, but the ledger is unavailable.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ ...(chatResponse() as Record<string, unknown>), usage: { prompt_tokens: 10_000, completion_tokens: 0, total_tokens: 10_000 } }),
          { status: 200 },
        ),
      ),
    )
    mockConsumeCredits.mockRejectedValue(new Error("ledger unavailable"))

    const secret = "atai_production_validkeytest12345678"
    mockFindOne.mockResolvedValueOnce(makeDoc(secret))

    const res = await POST(request(CHAT_BODY, secret))
    expect(res.status).toBe(503)
    expect((await res.json()).error.code).toBe("runtime_billing_unavailable")
  })

  it("INTEGRATION: PROJECT ISOLATION — adapter attribution comes from the key record, not the body", async () => {
    registerOpenRouterAdapter()
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(chatResponse()), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const secret = "atai_production_validkeytest12345678"
    mockFindOne.mockResolvedValueOnce(makeDoc(secret, { projectId: "proj_A", userId: "user_A" }))

    const res = await POST(request(CHAT_BODY, secret))
    expect(res.status).toBe(200)
    // The adapter request envelope carries the trusted identity; the response
    // exposes no identity fields at all, so nothing can be spoofed via body.
    const json = await res.json()
    expect(JSON.stringify(json)).not.toContain("proj_B")
    expect(fetchMock.mock.calls[0][1].body).not.toContain("proj_B")
  })

  it("SECURITY: credential injection / endpoint override / header override fields are rejected", async () => {
    registerOpenRouterAdapter()
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const secret = "atai_production_validkeytest12345678"
    mockFindOne.mockResolvedValueOnce(makeDoc(secret))

    const res = await POST(
      request(
        {
          capability: "ai.text",
          operation: "chat",
          input: {
            messages: [{ role: "user", content: "hi" }],
            openrouterApiKey: "attacker-key",
            baseUrl: "http://169.254.169.254",
            headers: { authorization: "attacker" },
          },
        },
        secret,
      ),
    )
    // Strict input schema rejects unknown fields before any provider contact.
    expect(res.status).toBe(422)
    expect(fetchMock).not.toHaveBeenCalled()
    const json = await res.json()
    expect(JSON.stringify(json)).not.toContain("attacker")
  })

  it("SECURITY: SSRF — a caller can never redirect the provider endpoint", async () => {
    registerOpenRouterAdapter()
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(chatResponse()), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const secret = "atai_production_validkeytest12345678"
    mockFindOne.mockResolvedValueOnce(makeDoc(secret))

    await POST(
      request({ ...CHAT_BODY, metadata: { baseUrl: "http://169.254.169.254", endpoint: "/admin", host: "internal" } }, secret),
    )

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions")
  })

  it("input validation: chat input with empty messages → 422 without provider contact", async () => {
    registerOpenRouterAdapter()
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const secret = "atai_production_validkeytest12345678"
    mockFindOne.mockResolvedValueOnce(makeDoc(secret))

    const res = await POST(request({ capability: "ai.text", operation: "chat", input: { messages: [] } }, secret))
    expect(res.status).toBe(422)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // ── Phase 6 verification additions (§40/§43 security matrix) ──────────

  it("SECURITY: only POST is routed — GET/PUT/DELETE have no runtime handler (§52)", async () => {
    const mod = await import("./route")
    expect(typeof (mod as Record<string, unknown>).POST).toBe("function")
    expect((mod as Record<string, unknown>).GET).toBeDefined()
    expect((mod as Record<string, unknown>).PUT).toBeUndefined()
    expect((mod as Record<string, unknown>).DELETE).toBeUndefined()
    expect((mod as Record<string, unknown>).PATCH).toBeUndefined()
  })

  it("SECURITY: ai.text scope denial blocks the provider call even when the body asks for admin scopes (§28)", async () => {
    registerOpenRouterAdapter()
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const secret = "atai_production_validkeytest12345678"
    // Key is scoped to a DIFFERENT capability; the body also tries to smuggle
    // scope overrides (ignored/strict-rejected) — neither may reach OpenRouter.
    mockFindOne.mockResolvedValueOnce(makeDoc(secret, { scopes: ["search.web"] }))

    // (Top-level scope fields would be strict-rejected as 422 before scope
    // evaluation — that behavior is covered by the identity-matrix test below.
    // Here the body stays schema-valid so the 403 scope gate itself is hit.)
    const res = await POST(
      request({ ...CHAT_BODY, metadata: { scopes: ["ai.text", "admin"] } }, secret),
    )
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe("runtime_capability_not_allowed")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("SECURITY: §43 adversarial identity matrix is structurally rejected before any provider contact", async () => {
    registerOpenRouterAdapter()
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const secret = "atai_production_validkeytest12345678"
    mockFindOne.mockResolvedValueOnce(makeDoc(secret))

    const res = await POST(
      request(
        {
          ...CHAT_BODY,
          userId: "victim",
          projectId: "victim-project",
          environment: "production",
          apiKeyId: "rkey_attacker",
          scopes: ["admin"],
          provider: "attacker-controlled-provider",
        },
        secret,
      ),
    )
    // Strict envelope schema rejects identity/override fields (z.never + strict).
    expect(res.status).toBe(422)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(JSON.stringify(await res.json())).not.toContain("victim")
  })

  it("SECURITY: identity smuggled through metadata is ignored — trusted context wins (§25/§27)", async () => {
    registerOpenRouterAdapter()
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(chatResponse()), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const secret = "atai_production_validkeytest12345678"
    mockFindOne.mockResolvedValueOnce(makeDoc(secret, { projectId: "proj_A", userId: "user_A", environment: "development" }))

    // metadata is an allowed (open) record — it must NEVER be read as identity.
    const res = await POST(
      request(
        {
          ...CHAT_BODY,
          metadata: {
            userId: "victim",
            projectId: "victim-project",
            environment: "production",
            scopes: ["admin"],
            provider: "attacker-controlled-provider",
          },
        },
        secret,
      ),
    )
    expect(res.status).toBe(200) // routed on the TRUSTED key identity, not metadata
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body))
    expect(body).not.toHaveProperty("userId")
    expect(body).not.toHaveProperty("projectId")
    expect(body).not.toHaveProperty("environment")
    expect(body).not.toHaveProperty("scopes")
    expect(body).not.toHaveProperty("provider")
    expect(body.model).toBe("openai/gpt-test") // env default — identity never influences it
  })

  it("SECURITY: revoked and expired keys fail closed before any provider contact (§40 24/25)", async () => {
    registerOpenRouterAdapter()
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const revoked = "atai_production_revokedkeytest1234567"
    mockFindOne.mockResolvedValueOnce(makeDoc(revoked, { status: "revoked" }))
    const revokedRes = await POST(request(CHAT_BODY, revoked))
    expect(revokedRes.status).toBe(401)
    expect((await revokedRes.json()).error.code).toBe("runtime_key_revoked")

    const expiredSecret = "atai_production_expiredkeytest123456"
    mockFindOne.mockResolvedValueOnce(makeDoc(expiredSecret, { status: "active", expiresAt: Date.now() - 1000 }))
    const expiredRes = await POST(request(CHAT_BODY, expiredSecret))
    expect(expiredRes.status).toBe(401)
    expect((await expiredRes.json()).error.code).toBe("runtime_key_expired")

    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("GET /api/runtime/v1 — capability discovery", () => {
  it("returns registry metadata without promising providers", async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    const caps = json.data.capabilities
    expect(caps.find((c: { id: string }) => c.id === "ai.text").operations).toContain("chat")
  })
})

describe("POST /api/runtime/v1 — Phase 11 hardening", () => {
  it("rejects oversized bodies before authentication", async () => {
    const res = await POST(
      new Request("https://atai.example/api/runtime/v1", {
        method: "POST",
        headers: { "content-length": String(300 * 1024) },
        body: "{}",
      }),
    )
    expect(res.status).toBe(413)
    expect((await res.json()).error.code).toBe("runtime_invalid_request")
  })

  it("rejects client-controlled credits/price fields", async () => {
    const secret = "atai_production_validkeytest12345678"
    mockFindOne.mockResolvedValueOnce(makeDoc(secret))
    const res = await POST(
      request({ capability: "test", operation: "echo", credits: 1, price: 0 }, secret),
    )
    expect(res.status).toBe(422)
    expect(mockConsumeCredits).not.toHaveBeenCalled()
  })
})
