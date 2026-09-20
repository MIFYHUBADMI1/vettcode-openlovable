/**
 * @atai/sdk — network failure, timeout, cancellation, and concurrency tests
 * (Phase 7 §47.32–33, §54–55, §84–85).
 */

import { afterEach, describe, expect, it, vi } from "vitest"
import { Atai } from "../src/client"
import { AtaiError } from "../src/errors"
import { chatData, jsonResponse, successEnvelope } from "./config.test"

const KEY = "atai_production_transportTestKey1"

function client(): Atai {
  return new Atai({ apiKey: KEY, baseUrl: "https://runtime.test" })
}

function okResponse(): Response {
  return jsonResponse(200, successEnvelope(chatData()))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("Network & fetch failures (§54)", () => {
  it("network failure → atai_network_error with cause preserved", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed: DNS lookup error")))
    const err = await client().ai.chat({ messages: [{ role: "user", content: "q" }] }).catch((e: unknown) => e) as AtaiError
    expect(err).toBeInstanceOf(AtaiError)
    expect(err.code).toBe("atai_network_error")
    expect(err.message).not.toContain("DNS") // safe message
    expect((err.cause as Error | undefined)?.message).toContain("DNS") // cause preserved
  })

  it("connection refused → controlled transport error, not a crash", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")))
    await expect(client().ai.chat({ messages: [{ role: "user", content: "q" }] })).rejects.toMatchObject({
      code: "atai_network_error",
    })
  })
})

describe("Cancellation & timeout (§34–35, §47.32–33)", () => {
  it("32. AbortSignal cancels an in-flight request → atai_aborted", async () => {
    const controller = new AbortController()
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      // Simulate the runtime hanging until the caller aborts.
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const e = new Error("The operation was aborted")
          e.name = "AbortError"
          reject(e)
        })
      })
    }))

    const promise = client().ai.chat({ messages: [{ role: "user", content: "q" }] }, { signal: controller.signal })
    controller.abort()
    const err = await promise.catch((e: unknown) => e) as AtaiError

    expect(err).toBeInstanceOf(AtaiError)
    expect(err.code).toBe("atai_aborted")
    // §35: cancellation is never masked as a provider/network error.
    expect(err.code).not.toBe("atai_network_error")
  })

  it("32b. pre-aborted signal fails fast without contacting the runtime", async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    await expect(client().ai.chat({ messages: [{ role: "user", content: "q" }] }, { signal: controller.signal }))
      .rejects.toMatchObject({ code: "atai_aborted" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("33. timeout produces a controlled timeout error (not a provider error)", async () => {
    vi.useFakeTimers()
    try {
      vi.stubGlobal("fetch", vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            const e = new Error("aborted")
            e.name = "AbortError"
            reject(e)
          })
        })
      }))
      const promise = client().ai.chat({ messages: [{ role: "user", content: "q" }] })
      const assertion = expect(promise).rejects.toMatchObject({ code: "atai_timeout" })
      await vi.advanceTimersByTimeAsync(61_000)
      await assertion
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("Concurrency & isolation (§84–85)", () => {
  it("85. concurrent calls keep bodies, credentials, and responses isolated", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { input: { messages: Array<{ content: string }> } }
      const content = body.input.messages[0]?.content ?? ""
      return jsonResponse(200, successEnvelope(chatData({ content: `reply:${content}` })))
    })
    vi.stubGlobal("fetch", fetchMock)

    const atai = client()
    const [a, b, c] = await Promise.all([
      atai.ai.chat({ messages: [{ role: "user", content: "A" }] }),
      atai.ai.chat({ messages: [{ role: "user", content: "B" }] }),
      atai.ai.chat({ messages: [{ role: "assistant", content: "C" }] }),
    ])

    expect(a.content).toBe("reply:A")
    expect(b.content).toBe("reply:B")
    expect(c.content).toBe("reply:C")

    // Each call carried its own body; no cross-contamination.
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)))
    expect(bodies[0].input.messages[0].content).toBe("A")
    expect(bodies[1].input.messages[0].content).toBe("B")
    expect(bodies[2].input.messages[0].content).toBe("C")
    const auths = fetchMock.mock.calls.map(([, init]) => (init as RequestInit).headers as Record<string, string>)
    for (const h of auths) expect(h.authorization).toBe(`Bearer ${KEY}`)
  })

  it("84. two clients with different credentials never cross credentials", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => okResponse())
    vi.stubGlobal("fetch", fetchMock)

    const keyB = "atai_development_otherKeyValue_456"
    const a = client()
    const b = new Atai({ apiKey: keyB, baseUrl: "https://runtime.test" })

    await Promise.all([
      a.ai.chat({ messages: [{ role: "user", content: "x" }] }),
      b.ai.chat({ messages: [{ role: "user", content: "y" }] }),
    ])

    const auths = fetchMock.mock.calls.map(([, init]) => ((init as RequestInit).headers as Record<string, string>).authorization)
    expect(auths).toEqual([`Bearer ${KEY}`, `Bearer ${keyB}`])
  })
})
