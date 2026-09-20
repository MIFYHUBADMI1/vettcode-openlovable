/**
 * @atai/sdk — HTTP error mapping tests (Phase 7 §47.16–25, §28).
 */

import { afterEach, describe, expect, it, vi } from "vitest"
import { Atai } from "../src/client"
import { AtaiError, isAuthenticationError, isAuthorizationError, isRateLimitError } from "../src/errors"
import { chatData, errorEnvelope, jsonResponse, successEnvelope } from "./config.test"

const KEY = "atai_production_errorTestKey123"

function client(): Atai {
  return new Atai({ apiKey: KEY, baseUrl: "https://runtime.test" })
}

function runtimeError(status: number, code: string, message: string): Response {
  return jsonResponse(status, errorEnvelope(code, message))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("HTTP error mapping (§47.16–25)", () => {
  const cases: Array<{ status: number; code: string; expectStatus?: number }> = [
    { status: 400, code: "runtime_invalid_request" },
    { status: 401, code: "runtime_authentication_error" },
    { status: 401, code: "runtime_key_revoked" },
    { status: 403, code: "runtime_capability_not_allowed" },
    { status: 404, code: "runtime_invalid_request" },
    { status: 409, code: "runtime_invalid_request" },
    { status: 429, code: "runtime_rate_limited" },
    { status: 429, code: "runtime_provider_rate_limited" },
    { status: 500, code: "UNKNOWN" },
    { status: 502, code: "runtime_provider_error" },
    { status: 503, code: "runtime_capability_unavailable" },
    { status: 504, code: "runtime_provider_timeout" },
  ]

  for (const c of cases) {
    it(`HTTP ${c.status} (${c.code}) → AtaiError with code + status preserved`, async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(runtimeError(c.status, c.code, "normalized failure")))
      const err = await client().ai.chat({ messages: [{ role: "user", content: "q" }] }).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(AtaiError)
      const ataiErr = err as AtaiError
      expect(ataiErr.code).toBe(c.code)
      expect(ataiErr.status).toBe(c.status)
      expect(ataiErr.message).toBe("normalized failure")
    })
  }

  it("non-JSON error body still produces a controlled AtaiError with status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>gateway</html>", { status: 502 })))
    const err = await client().ai.chat({ messages: [{ role: "user", content: "q" }] }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AtaiError)
    expect((err as AtaiError).status).toBe(502)
    expect((err as AtaiError).code).toBe("atai_invalid_response")
  })

  it("429 with Retry-After header exposes safe retry metadata (§31)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse(429, errorEnvelope("runtime_rate_limited", "Too many requests."), { "retry-after": "7" }),
    ))
    const err = await client().ai.chat({ messages: [{ role: "user", content: "q" }] }).catch((e: unknown) => e)
    expect((err as AtaiError).retry?.afterMs).toBe(7000)
  })

  it("x-request-id header is preserved on errors (§33)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse(500, errorEnvelope("UNKNOWN", "internal"), { "x-request-id": "rtreq_hdrid" }),
    ))
    const err = await client().ai.chat({ messages: [{ role: "user", content: "q" }] }).catch((e: unknown) => e)
    expect((err as AtaiError).requestId).toBe("rtreq_hdrid")
  })

  it("classification helpers: auth, authorization, rate limit (§29/§30/§31)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(runtimeError(401, "runtime_authentication_error", "Invalid or missing API key.")))
    const authErr = await client().ai.chat({ messages: [{ role: "user", content: "q" }] }).catch((e: unknown) => e)
    expect(isAuthenticationError(authErr)).toBe(true)

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(runtimeError(403, "runtime_capability_not_allowed", "not allowed")))
    const authzErr = await client().ai.chat({ messages: [{ role: "user", content: "q" }] }).catch((e: unknown) => e)
    expect(isAuthorizationError(authzErr)).toBe(true)

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(runtimeError(429, "runtime_rate_limited", "slow down")))
    const rateErr = await client().ai.chat({ messages: [{ role: "user", content: "q" }] }).catch((e: unknown) => e)
    expect(isRateLimitError(rateErr)).toBe(true)
  })
})
