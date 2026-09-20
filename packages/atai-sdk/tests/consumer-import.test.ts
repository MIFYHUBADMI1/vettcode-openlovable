/**
 * @atai/sdk — package consumer test (Phase 7 §50).
 *
 * Imports EXCLUSIVELY from the built `dist` output, exactly as an external
 * consumer would (`import { Atai } from "@atai/sdk"` → dist). Verifies:
 *   - imports resolve,
 *   - declarations resolve (checked by tsc over this file's imports),
 *   - runtime JavaScript executes,
 *   - no server-only module is required (pure fetch + standard JS),
 *   - no source-path dependency exists.
 */

import { describe, expect, it, vi } from "vitest"
// Consumer-style deep import into the package entry point (dist output).
import { Atai, AtaiError, AiCapability } from "../dist/index.js"
import type { AiChatInput, AiChatResult, AtaiConfig } from "../dist/index.js"

const KEY = "atai_production_consumerTestKey1"

describe("consumer import from dist (§50)", () => {
  it("public exports resolve and execute", () => {
    expect(typeof Atai).toBe("function")
    expect(typeof AtaiError).toBe("function")
    expect(typeof AiCapability).toBe("function")
    const client = new Atai({ apiKey: KEY, baseUrl: "https://runtime.test" })
    expect(client.ai).toBeInstanceOf(AiCapability)
  })

  it("dist JavaScript executes a real request path with mocked fetch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ ok: true, data: { requestId: "rtreq_c1", capability: "ai.text", operation: "chat", data: { id: "g1", model: "m", content: "ok", finishReason: "stop" } } }),
      { status: 200, headers: { "content-type": "application/json" } },
    )))
    const client = new Atai({ apiKey: KEY, baseUrl: "https://runtime.test" })
    const result: AiChatResult = await client.ai.chat({ messages: [{ role: "user", content: "hi" }] } satisfies AiChatInput)
    expect(result.content).toBe("ok")
    vi.unstubAllGlobals()
  })

  it("public types are usable (compile-time surface)", () => {
    const config: AtaiConfig = { apiKey: KEY }
    expect(config.baseUrl).toBeUndefined()
    const input: AiChatInput = { messages: [{ role: "assistant", content: "hey" }], stop: ["END", "STOP"] }
    expect(input.messages).toHaveLength(1)
  })

  it("51. type-level contract: invalid requests are rejected by the declarations", async () => {
    // The negative compile-time contract is enforced by the dedicated tsc
    // type test (npm run typecheck → tests/type-test/type-consumer.ts).
    // Here we verify the runtime side of the same guarantee: a request
    // attempt carrying hostile fields still only ever reaches the
    // configured origin.
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ ok: true, data: { requestId: "rtreq_t1", capability: "ai.text", operation: "chat", data: { id: "g", model: "m", content: "ok", finishReason: "stop" } } }),
      { status: 200, headers: { "content-type": "application/json" } },
    ))
    vi.stubGlobal("fetch", fetchMock)

    const hostile = { messages: [{ role: "user", content: "hi" }], baseUrl: "https://attacker.example" } as never
    // baseUrl is set explicitly so the assertion below checks the configured
    // origin (the default would target the production runtime, not the mock).
    await new Atai({ apiKey: KEY, baseUrl: "https://runtime.test" }).ai.chat(hostile)
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toBe("https://runtime.test/api/runtime/v1")
    vi.unstubAllGlobals()
  })

  it("no server-only module is pulled in (dist is environment-free)", async () => {
    const { readFileSync } = await import("node:fs")
    const { join } = await import("node:path")
    const distDir = join(__dirname, "..", "dist")
    const files = ["index.js", "client.js", "transport.js", "config.js", "errors.js", "types.js", "capabilities/ai.js"]
    for (const f of files) {
      const text = readFileSync(join(distDir, f), "utf8")
      expect(text, `${f} must not import server-only machinery`).not.toMatch(/require\(|server-only|next\/|mongodb|react/)
      expect(text, `${f} must not contain provider endpoints/credentials`).not.toMatch(/openrouter\.ai|OPENROUTER_API_KEY/)
    }
  })
})
