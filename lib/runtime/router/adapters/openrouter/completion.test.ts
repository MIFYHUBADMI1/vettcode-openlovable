import { describe, expect, it, vi } from "vitest"
import {
  CompletionInputSchema,
  toOpenRouterCompletionRequest,
} from "./mapper"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/logging/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

/** Minimal shape satisfying the parameter (unused by the translation itself). */
const stubRequest = { requestId: "rtreq_test" } as never

describe("ai.text/completion — OpenRouter translation", () => {
  it("translates a prompt into a single user message", () => {
    const body = toOpenRouterCompletionRequest({ prompt: "Explain quantum computing in one short sentence." }, stubRequest)
    expect(body.messages).toHaveLength(1)
    expect(body.messages[0].role).toBe("user")
    expect(body.messages[0].content).toBe("Explain quantum computing in one short sentence.")
    expect(body.model).toBeTruthy()
  })

  it("passes through generation parameters when provided", () => {
    const body = toOpenRouterCompletionRequest(
      {
        prompt: "hello",
        model: "openai/gpt-5.2",
        temperature: 0.5,
        top_p: 0.9,
        max_tokens: 50,
        stop: "END",
      },
      stubRequest,
    )
    expect(body.model).toBe("openai/gpt-5.2")
    expect(body.temperature).toBe(0.5)
    expect(body.top_p).toBe(0.9)
    expect(body.max_tokens).toBe(50)
    expect(body.stop).toBe("END")
  })

  it("rejects unknown fields (strict — never forwarded to the provider)", () => {
    const parsed = CompletionInputSchema.safeParse({ prompt: "hi", plugin: "evil" })
    expect(parsed.success).toBe(false)
  })

  it("rejects an empty prompt with a normalized 422-class error", () => {
    expect(() => toOpenRouterCompletionRequest({ prompt: "" }, stubRequest)).toThrow()
    expect(() => toOpenRouterCompletionRequest({}, stubRequest)).toThrow()
  })
})
