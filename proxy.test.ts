/**
 * Proxy edge-gate regression tests (Phase 7 audit — CRITICAL finding).
 *
 * Proves the exact SDK request shape (`POST /api/runtime/v1`, no trailing
 * slash, Bearer credential, no session cookie) reaches the runtime route
 * handler instead of being rejected by the session gate, while unrelated
 * /api/* routes stay session-gated.
 */

import { describe, expect, it } from "vitest"
import { NextRequest, NextResponse } from "next/server"
import { proxy, PUBLIC_API_PREFIXES } from "./proxy"

function runtimeRequest(pathname: string, opts: { apiKey?: string; sessionId?: string } = {}): NextRequest {
  const headers = new Headers()
  if (opts.apiKey) headers.set("authorization", `Bearer ${opts.apiKey}`)
  const req = new NextRequest(new URL(`https://atai.test${pathname}`), { headers })
  if (opts.sessionId) req.cookies.set("Atai_session", opts.sessionId)
  return req
}

describe("proxy — Atai Runtime invocation domain (Bearer authentication)", () => {
  it("admits the SDK's exact request: POST /api/runtime/v1 (no trailing slash), no session cookie", () => {
    // This is precisely what @atai/sdk sends — it must NOT be gated by the
    // session-cookie check (Phase 7 audit CRITICAL regression).
    const result = proxy(runtimeRequest("/api/runtime/v1", { apiKey: "atai_production_regtestkey12345" }))
    expect(result.headers.get("x-middleware-Next")).toBe("1")
  })

  it("admits the trailing-slash variant too", () => {
    const result = proxy(runtimeRequest("/api/runtime/v1/", { apiKey: "atai_production_regtestkey12345" }))
    expect(result.headers.get("x-middleware-Next")).toBe("1")
  })

  it("admits deeper runtime paths via the prefix list", () => {
    const result = proxy(runtimeRequest("/api/runtime/v1/anything", { apiKey: "atai_production_regtestkey12345" }))
    expect(result.headers.get("x-middleware-Next")).toBe("1")
  })

  it("does NOT admit runtime KEY-MANAGEMENT routes (session-gated by design)", () => {
    const result = proxy(runtimeRequest("/api/runtime/keys"))
    expect(result.headers.get("x-middleware-Next")).toBeNull()
    expect(result.status).toBe(401)
  })
})

describe("proxy — session gate still applies elsewhere", () => {
  it("rejects a cookieless request to a regular API route", () => {
    const result = proxy(runtimeRequest("/api/projects"))
    expect(result.status).toBe(401)
    expect(result.headers.get("x-middleware-Next")).toBeNull()
  })

  it("admits a request WITH a session cookie", () => {
    const result = proxy(runtimeRequest("/api/projects", { sessionId: "cookie-present" }))
    expect(result.headers.get("x-middleware-Next")).toBe("1")
  })

  it("ignores non-API paths", () => {
    const result = proxy(runtimeRequest("/some/page"))
    expect(result.headers.get("x-middleware-Next")).toBe("1")
  })

  it("public API prefixes still bypass the gate", () => {
    expect(PUBLIC_API_PREFIXES.length).toBeGreaterThan(0)
    const result = proxy(runtimeRequest("/api/auth/login"))
    expect(result.headers.get("x-middleware-Next")).toBe("1")
  })
})
