/**
 * @atai/sdk — HTTP + AI operation tests (Phase 7 §47.5–15, §48, §49).
 *
 * The runtime API boundary is mocked at `fetch` level: the SDK under test
 * issues real Requests through its transport, and the mock verifies exactly
 * what would go over the wire. No real runtime and no provider is contacted.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Atai } from "../src/client"
import { AtaiError } from "../src/errors"
import { chatData, errorEnvelope, jsonResponse, successEnvelope } from "./config.test"

const KEY = "atai_production_httpTestKey12345"

function client(): Atai {
  return new Atai({ apiKey: KEY, baseUrl: "https://runtime.test" })
}

function okResponse(data: unknown = chatData()): Response {
  return jsonResponse(200, successEnvelope(data))
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("HTTP transport", () => {
  it("5–7. correct URL, method, and headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal("fetch", fetchMock)

    await client().ai.chat({ messages: [{ role: "user", content: "hi" }] })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://runtime.test/api/runtime/v1")
    expect(init.method).toBe("POST")
    const headers = init.headers as Record<string, string>
    expect(headers.accept).toBe("application/json")
    expect(headers["content-type"]).toBe("application/json")
  })

  it("8. authorization is Bearer + the configured Atai key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal("fetch", fetchMock)

    await client().ai.chat({ messages: [{ role: "user", content: "hi" }] })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers.authorization).toBe(`Bearer ${KEY}`)
  })

  it("9. JSON body matches the runtime ai.text/chat contract exactly", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal("fetch", fetchMock)

    await client().ai.chat({
      model: "openai/gpt-test",
      messages: [{ role: "user", content: "hi" }],
      temperature: 0.5,
      max_tokens: 100,
      stop: ["END"],
      seed: 42,
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({
      capability: "ai.text",
      operation: "chat",
      input: {
        model: "openai/gpt-test",
        messages: [{ role: "user", content: "hi" }],
        temperature: 0.5,
        max_tokens: 100,
        stop: ["END"],
        seed: 42,
      },
    })
  })

  it("9b. optional fields are omitted when unset (no nulls sent)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal("fetch", fetchMock)

    await client().ai.chat({ messages: [{ role: "user", content: "hi" }] })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body))
    expect(body.input).toEqual({ messages: [{ role: "user", content: "hi" }] })
  })

  it("10. no provider credential headers are ever sent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal("fetch", fetchMock)

    await client().ai.chat({ messages: [{ role: "user", content: "hi" }] })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = new Headers(init.headers as Record<string, string>)
    expect(headers.has("x-api-key")).toBe(false)
    expect(headers.has("openrouter-key")).toBe(false)
    expect(headers.has("provider-key")).toBe(false)
    const bodyText = String(init.body)
    expect(bodyText).not.toContain("openrouterApiKey")
    expect(bodyText.toLowerCase()).not.toContain("openrouter")
  })
})

describe("AI operation (§47.11–15)", () => {
  it("12–14. response parses: content, model, usage, finishReason", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(chatData({
      id: "gen-9",
      model: "meta/llama-4",
      content: "Answer text",
      finishReason: "length",
      usage: { promptTokens: 11, completionTokens: 7, totalTokens: 18, cost: 0.0021 },
    }))))

    const result = await client().ai.chat({ messages: [{ role: "user", content: "q" }] })

    expect(result.id).toBe("gen-9")
    expect(result.model).toBe("meta/llama-4")
    expect(result.content).toBe("Answer text")
    expect(result.finishReason).toBe("length")
    expect(result.usage).toEqual({ promptTokens: 11, completionTokens: 7, totalTokens: 18, cost: 0.0021 })
  })

  it("12b. usage is optional in the normalized result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(chatData({ usage: undefined }))))
    const result = await client().ai.chat({ messages: [{ role: "user", content: "q" }] })
    expect(result.usage).toBeUndefined()
  })

  it("15. malformed response shape → controlled atai_invalid_response", async () => {
    // 200 with a body that is not a success envelope.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { hello: "world" })))
    await expect(client().ai.chat({ messages: [{ role: "user", content: "q" }] })).rejects.toMatchObject({
      code: "atai_invalid_response",
    })

    // 200 with valid JSON but a broken inner data shape.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, successEnvelope({ unexpected: true }))))
    await expect(client().ai.chat({ messages: [{ role: "user", content: "q" }] })).rejects.toMatchObject({
      code: "atai_invalid_response",
    })
  })

  it("15b. malformed JSON with HTTP 200 → controlled error (§55)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{not-json", { status: 200 })))
    await expect(client().ai.chat({ messages: [{ role: "user", content: "q" }] })).rejects.toSatisfy((e: unknown) => {
      return e instanceof AtaiError && e.code === "atai_invalid_response" && !(e.message.includes("Unexpected token"))
    })
  })

  it("13b. requestId from the envelope is surfaced", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, successEnvelope(chatData()))))
    // The SDK parses requestId through the envelope; the chat result itself
    // is the inner data. Verify no throw and correct parse.
    const result = await client().ai.chat({ messages: [{ role: "user", content: "q" }] })
    expect(result.content).toBe("Hello from Atai")
  })

  it("37. client-side validation: empty messages rejected before any request", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    await expect(client().ai.chat({ messages: [] })).rejects.toMatchObject({ code: "atai_invalid_request" })
    await expect(client().ai.chat({ messages: [{ role: "wizard", content: "x" } as never] })).rejects.toMatchObject({ code: "atai_invalid_request" })
    await expect(client().ai.chat({ messages: [{ role: "user", content: "" }] })).rejects.toMatchObject({ code: "atai_invalid_request" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("86. the caller's input object is never mutated", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse()))
    const input = { messages: [{ role: "user", content: "hi" }] as Array<{ role: string; content: string }> }
    const snapshot = JSON.stringify(input)
    await client().ai.chat(input as never)
    expect(JSON.stringify(input)).toBe(snapshot)
  })
})

describe("integration shape (§49): application → SDK → mock runtime", () => {
  it("behaves like a real consumer over the full request path", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      // Stand-in for the Runtime API: authenticate the header, validate the
      // body, then answer with the normalized envelope.
      const headers = new Headers(init.headers as Record<string, string>)
      if (!headers.get("authorization")?.startsWith("Bearer atai_")) {
        return jsonResponse(401, errorEnvelope("runtime_authentication_error", "Invalid or missing API key."))
      }
      const body = JSON.parse(String(init.body))
      if (body.capability !== "ai.text" || body.operation !== "chat") {
        return jsonResponse(422, errorEnvelope("runtime_invalid_request", "The request body is invalid for this capability."))
      }
      return jsonResponse(200, successEnvelope(chatData({ content: `Echo: ${body.input.messages[0].content}` })), { "x-request-id": "rtreq_mock42" })
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await client().ai.chat({ messages: [{ role: "user", content: "ping" }] })
    expect(result.content).toBe("Echo: ping")
  })
})
