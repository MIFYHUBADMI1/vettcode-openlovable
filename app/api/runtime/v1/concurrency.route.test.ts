import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

vi.mock("@/lib/runtime/auth/authenticate", () => ({
  authenticateRuntimeRequest: vi.fn(async () => ({
    requestId: "rtreq_load",
    apiKeyId: "rkey_load",
    userId: "user_load",
    projectId: "proj_load",
    environment: "development",
    scopes: [],
  })),
}))

vi.mock("@/lib/runtime/router/router", () => ({
  routeRuntimeRequest: vi.fn(
    () =>
      new Promise((resolve) => {
        setTimeout(() => resolve({ ok: true, capability: "test", operation: "echo" }), 40)
      }),
  ),
  routingFailureToAppError: vi.fn(),
  RoutingError: class RoutingError extends Error {},
}))

vi.mock("@/lib/runtime/router/adapters/register-all", () => ({
  registerAllRuntimeAdapters: vi.fn(),
}))

vi.mock("@/lib/runtime/router/capability-registry", () => ({
  listCapabilities: vi.fn(() => []),
}))

vi.mock("@/lib/logging/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { POST } from "./route"
import { resetRuntimeConcurrencyForTests } from "@/lib/runtime/concurrency"

function request() {
  return new Request("https://atai.example/api/runtime/v1", {
    method: "POST",
    headers: { authorization: "Bearer atai_development_loadtestkey1234567", "content-type": "application/json" },
    body: JSON.stringify({ capability: "test", operation: "echo" }),
  })
}

describe("POST /api/runtime/v1 process concurrency cap", () => {
  beforeEach(() => {
    resetRuntimeConcurrencyForTests(2)
  })

  it("returns 429 when the process is already at capacity", async () => {
    const started = Promise.all([POST(request()), POST(request()), POST(request()), POST(request())])
    const results = await started
    const statuses = results.map((r) => r.status).sort((a, b) => a - b)
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(2)
    expect(statuses.filter((s) => s === 200).length).toBe(2)
  })
})
