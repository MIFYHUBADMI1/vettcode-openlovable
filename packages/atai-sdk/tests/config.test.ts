/**
 * @atai/sdk — configuration tests (Phase 7 §47.1–4).
 */

import { describe, expect, it, vi } from "vitest"
import { Atai } from "../src/client"
import { AtaiError } from "../src/errors"
import { DEFAULT_ATAI_BASE_URL, RUNTIME_API_VERSION_PATH } from "../src/config"

const VALID_KEY = "atai_production_abc123XYZ_-"

describe("Atai configuration", () => {
  it("1. missing API key is rejected locally", () => {
    expect(() => new Atai({ apiKey: "" })).toThrow(AtaiError)
    try {
      new Atai({ apiKey: "" })
    } catch (e) {
      expect((e as AtaiError).code).toBe("atai_missing_api_key")
    }
    // @ts-expect-error — undefined apiKey must also be rejected at runtime
    expect(() => new Atai({})).toThrow(AtaiError)
  })

  it("2. base URL defaults to the canonical Atai runtime origin", () => {
    expect(DEFAULT_ATAI_BASE_URL).toBe("https://atai.ink")
    expect(RUNTIME_API_VERSION_PATH).toBe("/api/runtime/v1")
  })

  it("2b. invalid configuration is rejected: malformed baseUrl", () => {
    expect(() => new Atai({ apiKey: VALID_KEY, baseUrl: "not-a-url" })).toThrow(AtaiError)
    expect(() => new Atai({ apiKey: VALID_KEY, baseUrl: "ftp://atai.ink" })).toThrow(AtaiError)
    expect(() => new Atai({ apiKey: VALID_KEY, baseUrl: "" })).toThrow(AtaiError)
  })

  it("2c. key shape is validated locally (DX only)", () => {
    expect(() => new Atai({ apiKey: "sk-or-v1-not-an-atai-key" })).toThrow(AtaiError)
    expect(() => new Atai({ apiKey: "atai_production_ok" })).not.toThrow()
  })

  it("3. custom base URL (with trailing slash and path) is normalized", async () => {
    const atai = new Atai({ apiKey: VALID_KEY, baseUrl: "http://localhost:3000/" })
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true, data: { requestId: "rtreq_x", capability: "ai.text", operation: "chat", data: chatData() } }))
    vi.stubGlobal("fetch", fetchMock)

    await atai.ai.chat({ messages: [{ role: "user", content: "hi" }] })
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toBe("http://localhost:3000/api/runtime/v1")
    vi.unstubAllGlobals()
  })
})

// ─── shared test helpers ─────────────────────────────────────────────────────

/** A valid normalized chat result as the runtime would return inside `data.data`. */
export function chatData(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "gen-1",
    model: "openai/gpt-test",
    content: "Hello from Atai",
    finishReason: "stop",
    usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
    ...overrides,
  }
}

/** Build a Response with JSON body and optional headers. */
export function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  })
}

/** A full successful runtime envelope string for `data`. */
export function successEnvelope(data: unknown): unknown {
  return { ok: true, data: { requestId: "rtreq_test0123456789abcdef", capability: "ai.text", operation: "chat", data } }
}

/** A runtime error envelope string. */
export function errorEnvelope(code: string, message: string): unknown {
  return { ok: false, error: { code, message } }
}
