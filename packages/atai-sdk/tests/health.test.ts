/**
 * @atai/sdk — health capability tests.
 *
 * The runtime API boundary is mocked at `fetch` level: the SDK under test
 * issues real Requests through its transport, and the mock verifies exactly
 * what would go over the wire. No real runtime is contacted.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Atai } from "../src/client"
import { AtaiError } from "../src/errors"
import { errorEnvelope, jsonResponse } from "./config.test"

const KEY = "atai_production_healthTestKey1234"

function client(): Atai {
  return new Atai({ apiKey: KEY, baseUrl: "https://runtime.test" })
}

function healthPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: "operational",
    requestId: "rtreq_health0123456789abcdef",
    identity: {
      projectId: "proj_generated",
      environment: "production",
      apiKeyId: "rkey_generated",
      scopes: ["ai.text"],
    },
    key: { status: "active" },
    lifecycle: ["authenticated", "scope_validated", "capability_resolved"],
    ...overrides,
  }
}

function okResponse(data: unknown = healthPayload()): Response {
  return jsonResponse(200, {
    ok: true,
    data: { requestId: "rtreq_health0123456789abcdef", capability: "health", operation: "check", data },
  })
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("Health capability", () => {
  it("issues a GET to /api/runtime/v1/health with the Bearer key and no body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal("fetch", fetchMock)

    const result = await client().health.check()

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://runtime.test/api/runtime/v1/health")
    expect(init.method).toBe("GET")
    expect(init.body).toBeUndefined()
    const headers = init.headers as Record<string, string>
    expect(headers.authorization).toBe(`Bearer ${KEY}`)
    expect(headers.accept).toBe("application/json")

    // Normalized result surfaces the runtime's safe metadata.
    expect(result.status).toBe("operational")
    expect(result.requestId).toBe("rtreq_health0123456789abcdef")
    expect(result.identity.projectId).toBe("proj_generated")
    expect(result.identity.environment).toBe("production")
    expect(result.identity.scopes).toEqual(["ai.text"])
  })

  it("rejects a malformed payload with a controlled error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          ok: true,
          data: { requestId: "rtreq_x", capability: "health", operation: "check", data: { hello: true } },
        }),
      ),
    )
    await expect(client().health.check()).rejects.toMatchObject({ code: "atai_invalid_response" })
  })

  it("propagates authentication failure as a normalized AtaiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(401, errorEnvelope("runtime_authentication_error", "Invalid or missing API key."))),
    )
    try {
      await client().health.check()
      expect.unreachable("health.check() should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(AtaiError)
      expect((e as AtaiError).code).toBe("runtime_authentication_error")
      expect((e as AtaiError).status).toBe(401)
    }
  })

  it("never sends the API key anywhere but the Authorization header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal("fetch", fetchMock)

    await client().health.check()

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(init.body ?? "")).not.toContain(KEY)
    expect(JSON.stringify(init.headers)).not.toContain("openrouter")
  })
})
