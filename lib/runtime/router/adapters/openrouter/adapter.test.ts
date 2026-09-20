/**
 * Atai Runtime — Phase 6 OpenRouter adapter unit tests.
 *
 * Covers: request translation (§53), response normalization (§54), error
 * normalization across documented HTTP statuses (§55), secret safety (§56),
 * credential injection rejection, endpoint override rejection and SSRF
 * boundaries (§95/§96/§97), and the 200-with-error-body contract (§103).
 * No test requires real OpenRouter connectivity (§52).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("server-only", () => ({}))

const originalEnv = { ...process.env }

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = "sk-or-test-server-key"
  process.env.OPENROUTER_DEFAULT_MODEL = "openai/gpt-test"
  delete process.env.OPENROUTER_BASE_URL
  delete process.env.OPENROUTER_TIMEOUT_MS
  delete process.env.NEXT_PUBLIC_APP_URL
})

afterEach(() => {
  process.env = { ...originalEnv }
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

vi.mock("@/lib/logging/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { toOpenRouterRequest, toChatResult, ChatInputSchema } from "./mapper"
import { executeChatCompletion, getOpenRouterTimeoutMs } from "./client"
import { categoryForStatus, openRouterFailure, categoryForNetworkError } from "./errors"
import { getOpenRouterBaseUrl, openRouterHeaders } from "./config"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import type { ProviderExecutionRequest } from "@/runtime/contracts/router"
import type { OpenRouterChatResponse } from "./types"

function executionRequest(input: unknown): ProviderExecutionRequest {
  return {
    auth: {
      apiKeyId: "rkey_test",
      userId: "user_owner",
      projectId: "proj_bound",
      environment: "production",
      scopes: [],
    },
    requestId: "rtreq_test123",
    request: { capability: "ai.text", operation: "chat", input },
  }
}

function openRouterResponse(overrides: Partial<OpenRouterChatResponse> = {}): OpenRouterChatResponse {
  return {
    id: "gen-abc123",
    model: "openai/gpt-test",
    choices: [{ finish_reason: "stop", message: { role: "assistant", content: "Hello there!" } }],
    usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14, cost: 0.00014 },
    created: 1_700_000_000,
    ...overrides,
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

// ─── Request translation ───────────────────────────────────────────────────

describe("toOpenRouterRequest", () => {
  it("translates messages and applies the configured default model", () => {
    const body = toOpenRouterRequest(
      { messages: [{ role: "user", content: "What is the meaning of life?" }] },
      executionRequest({ messages: [] }),
    )
    expect(body.model).toBe("openai/gpt-test")
    expect(body.messages).toEqual([{ role: "user", content: "What is the meaning of life?" }])
  })

  it("uses the caller-selected model when provided", () => {
    const body = toOpenRouterRequest(
      { model: "anthropic/claude-sonnet-4.6", messages: [{ role: "user", content: "hi" }] },
      executionRequest({}),
    )
    expect(body.model).toBe("anthropic/claude-sonnet-4.6")
  })

  it("translates only the supported generation parameters", () => {
    const body = toOpenRouterRequest(
      {
        messages: [{ role: "user", content: "hi" }],
        temperature: 0.5,
        top_p: 0.9,
        max_tokens: 100,
        stop: ["END"],
        frequency_penalty: 0.1,
        presence_penalty: -0.2,
        seed: 42,
      },
      executionRequest({}),
    )
    expect(body).toMatchObject({ temperature: 0.5, top_p: 0.9, max_tokens: 100, stop: ["END"], frequency_penalty: 0.1, presence_penalty: -0.2, seed: 42 })
  })

  it("preserves system prompts verbatim without injecting Atai prompts", () => {
    const body = toOpenRouterRequest(
      {
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "hi" },
        ],
      },
      executionRequest({}),
    )
    expect(body.messages[0]).toEqual({ role: "system", content: "You are a helpful assistant." })
  })

  it("rejects arbitrary unknown fields — never forwarded to OpenRouter", () => {
    expect(() =>
      toOpenRouterRequest(
        { messages: [{ role: "user", content: "hi" }], plugins: [{ id: "web" }], route: "fallback" },
        executionRequest({}),
      ),
    ).toThrow(ProviderExecutionError)
  })

  it("rejects empty messages", () => {
    expect(() => toOpenRouterRequest({ messages: [] }, executionRequest({}))).toThrow(
      ProviderExecutionError,
    )
  })

  it("rejects invalid roles and non-string content", () => {
    expect(() =>
      toOpenRouterRequest({ messages: [{ role: "tool", content: "x" }] }, executionRequest({})),
    ).toThrow(ProviderExecutionError)
    expect(() =>
      toOpenRouterRequest({ messages: [{ role: "user", content: 42 }] }, executionRequest({})),
    ).toThrow(ProviderExecutionError)
  })

  it("rejects malformed model identifiers", () => {
    expect(() =>
      toOpenRouterRequest(
        { model: "bad model with spaces", messages: [{ role: "user", content: "hi" }] },
        executionRequest({}),
      ),
    ).toThrow(ProviderExecutionError)
  })

  it("when no default model is configured, missing model fails validation (normalized 422-class), not a provider call", () => {
    delete process.env.OPENROUTER_DEFAULT_MODEL
    try {
      expect(() =>
        toOpenRouterRequest({ messages: [{ role: "user", content: "hi" }] }, executionRequest({})),
      ).toThrow(ProviderExecutionError)
    } finally {
      process.env.OPENROUTER_DEFAULT_MODEL = "openai/gpt-test"
    }
  })
})

// ─── Response normalization ────────────────────────────────────────────────

describe("toChatResult", () => {
  it("normalizes a valid response into provider-neutral data", () => {
    const result = toChatResult(openRouterResponse(), executionRequest({}))
    expect(result.provider).toBe("openrouter")
    expect(result.data).toEqual({
      id: "gen-abc123",
      model: "openai/gpt-test",
      content: "Hello there!",
      finishReason: "stop",
      usage: { promptTokens: 10, completionTokens: 4, totalTokens: 14, cost: 0.00014 },
    })
  })

  it("preserves the model OpenRouter actually used (fallback/routing truth)", () => {
    const result = toChatResult(
      openRouterResponse({ model: "meta-llama/llama-3.1-8b-instruct" }),
      executionRequest({}),
    )
    expect(result.data.model).toBe("meta-llama/llama-3.1-8b-instruct")
  })

  it("empty choices → normalized provider error, never fake success", () => {
    expect(() => toChatResult(openRouterResponse({ choices: [] }), executionRequest({}))).toThrow(
      ProviderExecutionError,
    )
  })

  it("null content → normalized provider error (length-budget no-content case)", () => {
    expect(() =>
      toChatResult(
        openRouterResponse({ choices: [{ finish_reason: "length", message: { role: "assistant", content: null } }] }),
        executionRequest({}),
      ),
    ).toThrow(ProviderExecutionError)
  })

  it("missing usage → result without usage (optional field)", () => {
    const noUsage = openRouterResponse()
    delete (noUsage as { usage?: unknown }).usage
    const result = toChatResult(noUsage, executionRequest({}))
    expect(result.data.usage).toBeUndefined()
  })

  it("malformed usage structure → dropped safely, not trusted", () => {
    const badUsage = openRouterResponse({ usage: { prompt_tokens: "many" } as unknown as OpenRouterChatResponse["usage"] })
    const result = toChatResult(badUsage, executionRequest({}))
    expect(result.data.usage).toBeUndefined()
  })
})

// ─── Error mapping ─────────────────────────────────────────────────────────

describe("categoryForStatus", () => {
  it("maps documented OpenRouter statuses to normalized categories", () => {
    expect(categoryForStatus(408)).toBe("provider_timeout")
    expect(categoryForStatus(429)).toBe("provider_rate_limited")
    expect(categoryForStatus(401)).toBe("provider_error") // server credential problem
    expect(categoryForStatus(400)).toBe("provider_error")
    expect(categoryForStatus(402)).toBe("provider_error")
    expect(categoryForStatus(403)).toBe("provider_error")
    expect(categoryForStatus(502)).toBe("provider_unavailable")
    expect(categoryForStatus(503)).toBe("provider_unavailable")
    expect(categoryForStatus(500)).toBe("provider_error")
  })

  it("normalizes network aborts as timeout and other faults as unavailable", () => {
    const abort = new DOMException("The operation was aborted.", "AbortError")
    expect(categoryForNetworkError(abort)).toBe("provider_timeout")
    expect(categoryForNetworkError(new Error("connect ECONNREFUSED"))).toBe("provider_unavailable")
  })

  it("normalized failures carry safe messages, not raw provider text", () => {
    const e = openRouterFailure("provider_error", "OpenRouter request failed", "raw: upstream exploded at internal-host")
    expect(e.message).not.toContain("internal-host")
    expect(e.detail).toContain("internal-host") // server-side only
    expect(e.category).toBe("provider_error")
  })
})

// ─── HTTP client ───────────────────────────────────────────────────────────

describe("executeChatCompletion", () => {
  it("sends the documented endpoint, Bearer provider auth, and attribution headers", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://atai.example"
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, openRouterResponse()))
    vi.stubGlobal("fetch", fetchMock)

    await executeChatCompletion({ model: "openai/gpt-test", messages: [{ role: "user", content: "hi" }] })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions")
    const headers = init.headers as Record<string, string>
    expect(headers.authorization).toBe("Bearer sk-or-test-server-key")
    expect(headers["content-type"]).toBe("application/json")
    expect(headers["HTTP-Referer"]).toBe("https://atai.example")
    expect(headers["X-OpenRouter-Title"]).toBe("Atai")
    const body = JSON.parse(String(init.body))
    expect(body).toEqual({ model: "openai/gpt-test", messages: [{ role: "user", content: "hi" }] })
  })

  it("error statuses map to normalized ProviderExecutionError with safe messages", async () => {
    const cases: Array<[number, string]> = [
      [400, "provider_error"],
      [401, "provider_error"],
      [402, "provider_error"],
      [403, "provider_error"],
      [408, "provider_timeout"],
      [429, "provider_rate_limited"],
      [500, "provider_error"],
      [502, "provider_unavailable"],
      [503, "provider_unavailable"],
      [504, "provider_error"],
    ]
    for (const [status, category] of cases) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(status, { error: { code: status, message: "raw upstream detail" } })))
      try {
        await executeChatCompletion({ model: "m", messages: [{ role: "user", content: "hi" }] })
        expect.unreachable(`status ${status} should have thrown`)
      } catch (e) {
        expect(e).toBeInstanceOf(ProviderExecutionError)
        expect((e as ProviderExecutionError).category).toBe(category)
        expect((e as ProviderExecutionError).message).not.toContain("raw upstream detail")
      }
    }
  })

  it("200 with an error-only body (mid-generation failure) → normalized error, not success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { error: { code: 429, message: "Rate limit exceeded", metadata: { error_type: "rate_limit_exceeded" } } })))
    await expect(
      executeChatCompletion({ model: "m", messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toMatchObject({ category: "provider_rate_limited" })
  })

  it("200 with malformed JSON → normalized provider error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{not-json", { status: 200, headers: { "content-type": "application/json" } })),
    )
    await expect(
      executeChatCompletion({ model: "m", messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toMatchObject({ category: "provider_error" })
  })

  it("200 with a malformed success shape → normalized provider error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { id: "x", unexpected: true })))
    await expect(
      executeChatCompletion({ model: "m", messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toMatchObject({ category: "provider_error" })
  })

  it("network failure → normalized provider_unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fetch failed")))
    await expect(
      executeChatCompletion({ model: "m", messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toMatchObject({ category: "provider_unavailable" })
  })

  it("timeout abort → normalized provider_timeout", async () => {
    process.env.OPENROUTER_TIMEOUT_MS = "20"
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))
      })),
    )
    await expect(
      executeChatCompletion({ model: "m", messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toMatchObject({ category: "provider_timeout" })
  })

  it("missing server credential → ProviderNotConfiguredError (provider config problem, not customer auth)", async () => {
    delete process.env.OPENROUTER_API_KEY
    const { ProviderNotConfiguredError } = await import("./errors")
    await expect(
      executeChatCompletion({ model: "m", messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toBeInstanceOf(ProviderNotConfiguredError)
  })
})

// ─── Configuration boundaries (SSRF / injection) ───────────────────────────

describe("configuration boundaries", () => {
  it("base URL comes from trusted server configuration only", () => {
    expect(getOpenRouterBaseUrl()).toBe("https://openrouter.ai/api/v1")
    process.env.OPENROUTER_BASE_URL = "http://127.0.0.1:9999"
    expect(getOpenRouterBaseUrl()).toBe("http://127.0.0.1:9999") // server env can, callers cannot
  })

  it("timeout is bounded against nonsense configuration", () => {
    process.env.OPENROUTER_TIMEOUT_MS = "0"
    expect(getOpenRouterTimeoutMs()).toBe(60_000)
    process.env.OPENROUTER_TIMEOUT_MS = "999999999"
    expect(getOpenRouterTimeoutMs()).toBe(60_000)
    process.env.OPENROUTER_TIMEOUT_MS = "30000"
    expect(getOpenRouterTimeoutMs()).toBe(30_000)
  })

  it("headers carry only the provider credential and Atai attribution", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://atai.example"
    const headers = openRouterHeaders()
    expect(Object.keys(headers).sort()).toEqual([
      "HTTP-Referer",
      "X-OpenRouter-Title",
      "authorization",
      "content-type",
    ])
  })
})

// ─── Secret safety (§56) ───────────────────────────────────────────────────

describe("secret safety", () => {
  it("normalized errors never contain the provider key, Authorization header, or env var name", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, { error: { code: 500, message: "boom" } })))
    try {
      await executeChatCompletion({ model: "m", messages: [{ role: "user", content: "hi" }] })
      expect.unreachable("should have thrown")
    } catch (e) {
      const serialized = `${(e as Error).message} ${(e as ProviderExecutionError).detail ?? ""} ${(e as Error).name}`
      expect(serialized).not.toContain("sk-or-test-server-key")
      expect(serialized).not.toContain("OPENROUTER_API_KEY")
      expect(serialized.toLowerCase()).not.toContain("authorization")
    }
  })

  it("logs never contain the provider key", async () => {
    const { logger } = await import("@/lib/logging/logger")
    process.env.NEXT_PUBLIC_APP_URL = "https://atai.example"
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, openRouterResponse())))
    await executeChatCompletion({ model: "openai/gpt-test", messages: [{ role: "user", content: "hi" }] })
    const logged = JSON.stringify((logger.info as ReturnType<typeof vi.fn>).mock.calls)
    expect(logged).not.toContain("sk-or-test-server-key")
    expect(logged).not.toContain("authorization")
  })

  it("input schema forbids credential injection fields outright", () => {
    const result = ChatInputSchema.safeParse({
      messages: [{ role: "user", content: "hi" }],
      openrouterApiKey: "attacker-key",
      providerApiKey: "attacker-key",
      baseUrl: "https://attacker.example",
      headers: { authorization: "attacker" },
    })
    expect(result.success).toBe(false)
  })
})
