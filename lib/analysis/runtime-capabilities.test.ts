import { describe, expect, it } from "vitest"
import { isRuntimeIntegrationsGrounded, RUNTIME_AWARENESS_BLOCK } from "@/lib/analysis/runtime-capabilities"

describe("RUNTIME_AWARENESS_BLOCK", () => {
  it("tells the co-founder the real SDK, key, and runtime origin", () => {
    expect(RUNTIME_AWARENESS_BLOCK).toContain("@atai-group/sdk")
    expect(RUNTIME_AWARENESS_BLOCK).toContain("ATAI_API_KEY")
    expect(RUNTIME_AWARENESS_BLOCK).toContain("https://atai.ink")
    expect(RUNTIME_AWARENESS_BLOCK).toContain("/api/runtime/v1")
    expect(RUNTIME_AWARENESS_BLOCK).toContain("HOW TO CALL ATAI")
    expect(RUNTIME_AWARENESS_BLOCK).toContain("Do not hardcode api.openai.com")
  })
})

describe("isRuntimeIntegrationsGrounded", () => {
  it("rejects generic infrastructure lists", () => {
    expect(
      isRuntimeIntegrationsGrounded(
        "Data Storage: persists user accounts.\nFile Storage: upload attachments.\nThird-party API Integration: stock quotes.\nAI Model Inference: answers queries.",
      ),
    ).toBe(false)
  })

  it("accepts the Atai SDK contract plus a catalog capability", () => {
    expect(
      isRuntimeIntegrationsGrounded(
        "The app uses @atai-group/sdk with ATAI_API_KEY against /api/runtime/v1. ai.text (atai.ai.chat) answers founder questions in the workspace.",
      ),
    ).toBe(true)
  })
})
