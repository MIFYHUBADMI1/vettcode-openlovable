import { describe, expect, it, vi } from "vitest"
import {
  EmbedInputSchema,
  toCloudflareEmbedRequest,
  toEmbedResult,
  MAX_EMBED_TOTAL_CHARS,
} from "./mapper"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/logging/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const MODEL = "@cf/baai/bge-base-en-v1.5"

describe("embeddings — Cloudflare Workers AI translation", () => {
  it("accepts a single string and wraps it as one text", () => {
    const translated = toCloudflareEmbedRequest({ input: "hello world" })
    expect(translated.body.text).toEqual(["hello world"])
    expect(translated.totalChars).toBe(11)
  })

  it("accepts a batch of strings", () => {
    const translated = toCloudflareEmbedRequest({ input: ["a", "bb", "ccc"] })
    expect(translated.body.text).toEqual(["a", "bb", "ccc"])
    expect(translated.totalChars).toBe(6)
  })

  it("rejects unknown fields and over-cap batches", () => {
    expect(EmbedInputSchema.safeParse({ input: "hi", model: "evil" }).success).toBe(false)
    const long = "x".repeat(50_001)
    expect(() => toCloudflareEmbedRequest({ input: long })).toThrow()
    expect(EmbedInputSchema.safeParse({ input: long }).success).toBe(false)
  })

  it("normalizes a valid provider response into embeddings + usage", () => {
    const result = toEmbedResult(
      {
        success: true,
        result: {
          data: [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]],
          usage: { prompt_tokens: 7 },
        },
      },
      MODEL,
      11,
    )
    expect(result.provider).toBe("cloudflare")
    expect(result.data.model).toBe(MODEL)
    expect(result.data.dimensions).toBe(3)
    expect(result.data.embeddings).toEqual([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]])
    expect(result.usage?.inputTokens).toBe(7)
  })

  it("falls back to a conservative token estimate when usage is missing", () => {
    const result = toEmbedResult(
      { success: true, result: { data: [[1, 2, 3]] } },
      MODEL,
      300,
    )
    expect(result.usage?.inputTokens).toBe(100) // 300 chars / 3
  })

  it("fails normalized on ragged or empty provider rows", () => {
    expect(() =>
      toEmbedResult({ success: true, result: { data: [[1, 2], [1, 2, 3]] } }, MODEL, 10),
    ).toThrow("invalid response")
    expect(() =>
      toEmbedResult({ success: true, result: { data: [] } }, MODEL, 10),
    ).toThrow()
    expect(() =>
      toEmbedResult(
        { success: false, errors: [{ code: 7003, message: "no route" }] },
        MODEL,
        10,
      ),
    ).toThrow()
  })

  it("enforces the total character cap", () => {
    expect(MAX_EMBED_TOTAL_CHARS).toBeGreaterThan(0)
  })
})
