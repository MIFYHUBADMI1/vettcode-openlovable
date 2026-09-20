/**
 * Atai Runtime — Phase 8 end-to-end provisioning → runtime test.
 *
 * Proves the §125 architecture WITHOUT external systems (§70/§71):
 *
 *   ensureRuntimeProvisioned (real service, mocked store/Totalum)
 *        ↓ captured plaintext (the ONLY place it exists in the test)
 *   @atai/sdk (real dist build — imported exactly as a generated app would)
 *        ↓ HTTP
 *   POST /api/runtime/v1 (real route: Phase 4 auth → Phase 5 router → adapter)
 *        ↓
 *   OpenRouter adapter → MOCKED provider HTTP (no real credentials, §71)
 *
 * What this proves:
 *   - automatic provisioning produces credentials the SDK + runtime
 *     authentication system ACTUALLY accept (hash lookup → trusted context),
 *   - the generated app's credential is project/environment/scoped and its
 *     identity comes from the key record, never from request content,
 *   - no provider (OPENROUTER_API_KEY) or internal (ATAI_INTERNAL_KEY)
 *     credential is involved anywhere on the generated-app side.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

const { mockFindOne, mockUpdateOne, mockInsertOne } = vi.hoisted(() => ({
  mockFindOne: vi.fn().mockResolvedValue(null),
  mockUpdateOne: vi.fn().mockResolvedValue({ modifiedCount: 0 }),
  mockInsertOne: vi.fn().mockResolvedValue({ insertedId: "mock-id" }),
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

// Phase 9: the runtime path now meters and charges usage through the
// EXISTING credit service — mocked here so the e2e flow runs without Mongo.
vi.mock("@/lib/billing/credit-service", () => ({
  consumeCredits: vi.fn().mockResolvedValue({ success: true, subscriptionConsumed: 0, permanentConsumed: 0 }),
  getAvailableCredits: vi.fn().mockResolvedValue(1_000_000),
  getBalance: vi.fn().mockResolvedValue({ total: 1_000_000, subscription: 500_000, permanent: 500_000 }),
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

// Mock the metering chain to prevent MongoDB connection attempts during
// module-level imports.
vi.mock("@/lib/runtime/metering", () => ({
  preflightMeteredRequest: vi.fn().mockResolvedValue({ denial: null }),
  meterRuntimeResult: vi.fn().mockResolvedValue({ creditsCharged: 0, ledgerIdempotencyKey: '', pricingSnapshot: {} }),
  recordFailedRuntimeUsage: vi.fn().mockResolvedValue(undefined),
  resolveRuntimePrice: vi.fn().mockResolvedValue({ chargeable: false, source: 'non_billable', snapshot: {} }),
}))
vi.mock("@/lib/runtime/usage", () => ({
  recordUsage: vi.fn().mockResolvedValue(undefined),
  listUsageByProject: vi.fn().mockResolvedValue([]),
  listUsageByUser: vi.fn().mockResolvedValue([]),
  makeUsageEvent: vi.fn().mockImplementation((params: Record<string, unknown>) => ({
    id: 'test_usage_id',
    ...params,
  })),
}))

import { ensureRuntimeProvisioned } from "@/lib/runtime/provisioning"
import { store } from "@/lib/store/store"
import { createSecret } from "@/lib/integrations/totalum/service"
import { POST } from "@/app/api/runtime/v1/route"
import { registerOpenRouterAdapter } from "@/lib/runtime/router/adapters/openrouter"
import { Atai } from "../../../packages/atai-sdk/dist/index.js"
import type { MirrorProject } from "@/lib/types/project"
import type { ApiKeyDoc } from "@/lib/runtime/types"

// In-memory api_keys collection (hash-only, mirroring Mongo semantics).
const insertedKeys: ApiKeyDoc[] = []

function makeProject(overrides: Partial<MirrorProject> = {}): MirrorProject {
  return {
    id: "proj_e2e",
    userId: "user_e2e",
    mode: "scratch",
    name: "E2E App",
    state: "ready",
    totalumProjectId: "totalum_e2e",
    events: [],
    conversation: [],
    deployment: { id: "d1", status: "idle", updatedAt: Date.now() },
    deploymentHistory: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  } as MirrorProject
}

beforeEach(() => {
  vi.clearAllMocks()
  insertedKeys.length = 0
  registerOpenRouterAdapter()
  process.env.OPENROUTER_API_KEY = "sk-or-e2e-server-only-key"
  process.env.OPENROUTER_DEFAULT_MODEL = "openai/gpt-e2e"

  // Capture inserted key documents so hash lookups resolve like the real
  // unique-index lookup would.
  mockInsertOne.mockImplementation(async (doc: ApiKeyDoc) => {
    insertedKeys.push(doc)
    return { insertedId: "mock-id" }
  })

  vi.mocked(store.getProject).mockResolvedValue(makeProject())
  vi.mocked(store.getRuntimeProvisioning).mockResolvedValue(null)
  vi.mocked(store.claimRuntimeProvisioning).mockResolvedValue({ status: "PROVISIONING" })
  vi.mocked(store.findApiKeyMeta).mockImplementation(async (apiKeyId: string) => {
    const doc = insertedKeys.find((d) => d.id === apiKeyId)
    if (!doc) return null
    return { id: doc.id, projectId: doc.projectId, environment: doc.environment, status: doc.status, keyPrefix: doc.keyPrefix }
  })
})

// ─── §110 end-to-end ───────────────────────────────────────────────────────

describe("Phase 8 END-TO-END: provisioning → SDK → runtime API → adapter (§70/§110)", () => {
  it("a generated app authenticates with its provisioned credential through the real runtime path", async () => {
    // 1. Automatic provisioning (the Phase 8 service under test).
    const provisioned = await ensureRuntimeProvisioned(makeProject(), "production")
    expect(provisioned.status).toBe("READY")

    // The plaintext existed exactly once — at the Totalum injection boundary.
    const injected = (createSecret as ReturnType<typeof vi.fn>).mock.calls[0][1].secretValue as string
    expect(injected).toMatch(/^atai_production_/)

    // The provisioned key is resolvable by the runtime auth layer.
    const doc = insertedKeys[0]
    mockFindOne.mockImplementation(async (query: Record<string, unknown>) => {
      if (typeof query.keyHash === "string") {
        return insertedKeys.find((d) => d.keyHash === query.keyHash) ?? null
      }
      if (typeof query.id === "string") {
        return insertedKeys.find((d) => d.id === query.id) ?? null
      }
      return null
    })

    // 2. The generated application uses @atai/sdk exactly as documented.
    //    A single URL-aware fetch shim connects the two halves of the chain:
    //      - SDK → https://atai.ink/api/runtime/v1  → the REAL route handler
    //        (Phase 4 auth → Phase 5 router → adapter),
    //      - OpenRouter adapter → https://openrouter.ai → MOCKED provider.
    const providerCalls: Array<{ url: string; auth: string | undefined; body: string }> = []
    let runtimeCalls = 0

    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url

      if (url.includes("/api/runtime/v1")) {
        runtimeCalls++
        const headers = new Headers(init?.headers)
        const runtimeRequest = new Request(url, {
          method: "POST",
          headers,
          body: typeof init?.body === "string" ? init.body : undefined,
        })
        const response = await POST(runtimeRequest)
        const text = await response.text()
        return new Response(text, {
          status: response.status,
          headers: { "content-type": "application/json", "x-request-id": response.headers.get("x-request-id") ?? "" },
        })
      }

      // Provider path (OpenRouter adapter) — mocked, never a real call (§71).
      const headers = new Headers(init?.headers)
      providerCalls.push({
        url,
        auth: headers.get("authorization") ?? undefined,
        body: typeof init?.body === "string" ? init.body : "",
      })
      return new Response(
        JSON.stringify({
          id: "gen-e2e",
          model: "openai/gpt-e2e",
          choices: [{ finish_reason: "stop", message: { role: "assistant", content: "Hello from Atai Runtime" } }],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        }),
        { status: 200 },
      )
    })

    const client = new Atai({ apiKey: injected })
    const result = await client.ai.chat({
      messages: [{ role: "user", content: "Say hi to the founder's app" }],
    })

    // 3. The full §125 chain produced a normalized, provider-neutral answer.
    expect(result.content).toBe("Hello from Atai Runtime")
    expect(result.model).toBe("openai/gpt-e2e")
    expect(runtimeCalls).toBe(1)

    // The provider received the SERVER-side credential (never the generated
    // app's runtime key) at the documented endpoint.
    expect(providerCalls).toHaveLength(1)
    expect(providerCalls[0].url).toBe("https://openrouter.ai/api/v1/chat/completions")
    expect(providerCalls[0].auth).toBe("Bearer sk-or-e2e-server-only-key")
    expect(providerCalls[0].auth).not.toBe(`Bearer ${injected}`)
    expect(providerCalls[0].body).not.toContain(injected)
  })

  it("provisioned credential is project+environment bound and scoping is enforced end-to-end", async () => {
    const provisioned = await ensureRuntimeProvisioned(makeProject(), "development")
    const injected = (createSecret as ReturnType<typeof vi.fn>).mock.calls[0][1].secretValue as string

    mockFindOne.mockImplementation(async (query: Record<string, unknown>) => {
      if (typeof query.keyHash === "string") {
        return insertedKeys.find((d) => d.keyHash === query.keyHash) ?? null
      }
      return null
    })

    // The generated app attempts a capability its key does NOT cover
    // (search.web is not in PROVISIONED_KEY_SCOPES).
    const response = await POST(
      new Request("https://atai.ink/api/runtime/v1", {
        method: "POST",
        headers: { authorization: `Bearer ${injected}`, "content-type": "application/json" },
        body: JSON.stringify({ capability: "search.web", operation: "web", input: { query: "x" } }),
      }),
    )
    expect(response.status).toBe(403)
    const json = await response.json()
    expect(json.error.code).toBe("runtime_capability_not_allowed")
    expect(provisioned.apiKeyId).toMatch(/^rkey_/)
  })

  it("SECURITY: no provider or internal credential exists anywhere on the generated-app side", async () => {
    await ensureRuntimeProvisioned(makeProject(), "production")
    const injected = (createSecret as ReturnType<typeof vi.fn>).mock.calls[0][1].secretValue as string

    // The ONLY secret injected into the generated app is its own runtime key.
    const injectionCalls = (createSecret as ReturnType<typeof vi.fn>).mock.calls
    expect(injectionCalls).toHaveLength(1)
    expect(injectionCalls[0][1].secretName).toBe("ATAI_API_KEY")
    expect(injectionCalls[0][1].secretValue).toBe(injected)

    // The injected value is NOT the OpenRouter server key and NOT the
    // internal Atai key — different secrets, different domains (§22/§46).
    expect(injected).not.toBe("sk-or-e2e-server-only-key")
    expect(injected).toMatch(/^atai_production_/)
    expect(injected).not.toContain("sk-or-")

    // The stored doc contains no provider material either.
    const doc = insertedKeys[0]
    expect(JSON.stringify(doc)).not.toContain("sk-or-e2e-server-only-key")
    expect(JSON.stringify(doc)).not.toContain("ATAI_INTERNAL_KEY")
  })
})
