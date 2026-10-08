import { describe, expect, it } from "vitest"
import {
  aiTimeoutUserMessage,
  isAbortTimeoutError,
  isDatabaseConnectivityError,
  isTlsClockError,
  tlsClockUserMessage,
} from "@/lib/api/upstream-error"

describe("upstream error classification", () => {
  it("detects TLS not-yet-valid as a clock/certificate problem", () => {
    expect(isTlsClockError(new Error("Cannot connect to API: certificate is not yet valid"))).toBe(true)
    expect(isTlsClockError(new Error("Failed after 3 attempts. Last error: AI_APICallError: certificate is not yet valid"))).toBe(
      true,
    )
    expect(isTlsClockError(new Error("rate limited"))).toBe(false)
  })

  it("detects Mongo timeouts as database connectivity", () => {
    expect(
      isDatabaseConnectivityError(new Error("connection <monitor> to 159.41.207.169:27017 timed out")),
    ).toBe(true)
    expect(isTlsClockError(new Error("connection <monitor> to 159.41.207.169:27017 timed out"))).toBe(false)
  })

  it("explains the clock fix without leaking internals", () => {
    expect(tlsClockUserMessage()).toMatch(/clock/i)
    expect(tlsClockUserMessage()).not.toMatch(/openrouter/i)
  })

  it("detects the plan-chat abort timeout without treating Mongo timeouts as AI", () => {
    expect(isAbortTimeoutError(new Error("The operation was aborted due to timeout"))).toBe(true)
    expect(isAbortTimeoutError(new Error("connection <monitor> to 159.41.207.169:27017 timed out"))).toBe(false)
    expect(aiTimeoutUserMessage()).toMatch(/co-founder/i)
  })
})
