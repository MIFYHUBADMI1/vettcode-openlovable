import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

let rulesOverride: unknown[] = []
vi.mock("@/lib/billing/runtime-config", () => ({
  RUNTIME_PRICING_VERSION: "RUNTIME_PRICING_V1",
  getRuntimePricing: async () => ({
    aiTextInputPer1k: 2,
    aiTextOutputPer1k: 8,
    aiEmbedPer1k: 1,
    webRequest: 5,
    paymentsRequest: 2,
    aiImageRequest: 20,
    aiSpeechRequest: 10,
    aiVideoRequest: 50,
  }),
  getRuntimePricingRules: async () => rulesOverride,
}))

import { resolveRuntimePrice, RuntimePricingUnconfiguredError } from "./resolver"

beforeEach(() => {
  rulesOverride = []
})

describe("resolveRuntimePrice — multimodal legacy fallbacks", () => {
  it("prices ai.image per request", async () => {
    const decision = await resolveRuntimePrice({
      provider: "openrouter",
      capability: "ai.image",
      operation: "generateImage",
    })
    expect(decision).toMatchObject({ chargeable: true, source: "legacy", fixedCredits: 20 })
    expect(decision.snapshot).toMatchObject({ mode: "fixed_per_request", credits: 20 })
  })

  it("prices ai.speech per request", async () => {
    const decision = await resolveRuntimePrice({
      provider: "openrouter",
      capability: "ai.speech",
      operation: "speak",
    })
    expect(decision).toMatchObject({ chargeable: true, source: "legacy", fixedCredits: 10 })
  })

  it("prices ai.video per request", async () => {
    const decision = await resolveRuntimePrice({
      provider: "openrouter",
      capability: "ai.video",
      operation: "generateVideo",
    })
    expect(decision).toMatchObject({ chargeable: true, source: "legacy", fixedCredits: 50 })
  })

  it("lets an explicit admin rule override the multimodal fallback", async () => {
    rulesOverride = [
      {
        id: "rpr_image_free",
        provider: "openrouter",
        capability: "ai.image",
        operation: "generateImage",
        mode: "fixed_per_request",
        credits: 0,
        active: true,
      },
    ]
    const decision = await resolveRuntimePrice({
      provider: "openrouter",
      capability: "ai.image",
      operation: "generateImage",
    })
    expect(decision).toMatchObject({ source: "rule", pricingRuleId: "rpr_image_free", fixedCredits: 0 })
  })

  it("still denies a capability with no price anywhere (fail closed)", async () => {
    await expect(
      resolveRuntimePrice({ provider: "resend", capability: "email", operation: "send" }),
    ).rejects.toBeInstanceOf(RuntimePricingUnconfiguredError)
  })
})
