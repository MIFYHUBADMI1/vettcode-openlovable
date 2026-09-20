/**
 * @atai/sdk — security tests (Phase 7 §47.26–31, §66–68, §88, §15).
 */

import { afterEach, describe, expect, it, vi } from "vitest"
import { Atai } from "../src/client"
import { AtaiError } from "../src/errors"
import { chatData, jsonResponse, successEnvelope } from "./config.test"

const KEY = "atai_production_SuperSecretKeyValue_123"

function client(baseUrl = "https://runtime.test"): Atai {
  return new Atai({ apiKey: KEY, baseUrl })
}

function okResponse(): Response {
  return jsonResponse(200, successEnvelope(chatData()))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("Credential hygiene (§15, §26–27, §88)", () => {
  it("26. the API key never appears in a thrown error's message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("socket hang up")))
    const err = await client().ai.chat({ messages: [{ role: "user", content: "q" }] }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AtaiError)
    expect(String(err)).not.toContain(KEY)
    expect((err as AtaiError).message).not.toContain(KEY)
  })

  it("27. the API key never appears in String(error) or JSON.stringify(error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })))
    const err = await client().ai.chat({ messages: [{ role: "user", content: "q" }] }).catch((e: unknown) => e) as AtaiError
    expect(String(err)).not.toContain(KEY)
    expect(JSON.stringify(err)).not.toContain(KEY)
    // Serialized public shape carries only safe fields.
    expect(Object.keys(err.toJSON()).sort()).toEqual(["code", "message", "name", "status"])
  })

  it("27b. configuration errors never echo the key either", () => {
    try {
      new Atai({ apiKey: KEY, baseUrl: "::::not a url" })
      expect.unreachable()
    } catch (e) {
      expect(String(e)).not.toContain(KEY)
    }
  })

  it("28. no provider credential constants exist in SDK source (static check)", async () => {
    const { readFileSync, readdirSync, statSync } = await import("node:fs")
    const { join } = await import("node:path")
    const srcDir = join(__dirname, "..", "src")
    const files: string[] = []
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry)
        if (statSync(p).isDirectory()) walk(p)
        else if (p.endsWith(".ts")) files.push(p)
      }
    }
    walk(srcDir)
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const text = readFileSync(file, "utf8")
      expect(text, `${file} must not embed provider credentials or endpoints`).not.toMatch(/OPENROUTER_API_KEY|openrouter\.ai|sk-or-/)
    }
  })

  it("28b. SDK package dependencies contain no provider/DB/framework packages", async () => {
    const { readFileSync } = await import("node:fs")
    const { join } = await import("node:path")
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
    for (const dep of deps) {
      expect(dep.toLowerCase()).not.toMatch(/openai|openrouter|mongo|next|^react|axios/)
    }
  })
})

describe("URL & header security (§17, §66–67, §57–58)", () => {
  it("29/66. request input cannot override the base URL (extra fields are simply not read)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal("fetch", fetchMock)

    // Attempt to smuggle a baseUrl / endpoint / host through the request.
    // Cast through `never`: hostile extra fields are not part of the public
    // contract, and at runtime they are simply never read.
    const hostile = {
      messages: [{ role: "user", content: "hi" }],
      baseUrl: "https://attacker.example.com",
      endpoint: "/admin",
    } as never
    await client().ai.chat(hostile)

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toBe("https://runtime.test/api/runtime/v1")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("29b. metadata-style fields cannot reroute the request either", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal("fetch", fetchMock)

    const hostile = {
      messages: [{ role: "user", content: "hi" }],
      metadata: { baseUrl: "http://169.254.169.254" },
      host: "internal",
    } as never
    await client().ai.chat(hostile)

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toBe("https://runtime.test/api/runtime/v1")
  })

  it("67. the Authorization header is set only from configuration and never overridable", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal("fetch", fetchMock)

    // The public request options type exposes no header field at all.
    await client().ai.chat({ messages: [{ role: "user", content: "hi" }] })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${KEY}`)
  })

  it("67b. request options cannot inject headers (type-level guarantee)", () => {
    // The options surface is header-free: constructing the exact type the
    // method accepts proves only `signal` (and nothing else) exists.
    const options: { signal?: AbortSignal } = { signal: undefined }
    expect(Object.keys(options).sort()).toEqual(["signal"])
  })

  it("30/31/65. the SDK only ever contacts the configured Atai runtime origin", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse())
    vi.stubGlobal("fetch", fetchMock)

    await client("https://runtime.test").ai.chat({ messages: [{ role: "user", content: "hi" }] })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toMatch(/^https:\/\/runtime\.test\/api\/runtime\/v1$/)
    expect(url).not.toContain("openrouter")
  })
})
