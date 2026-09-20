import { describe, it, expect } from "vitest"
import { publicCost, toPublicUsageEvent, summarizeCosts } from "./usage-public"
import type { RuntimeUsageEvent } from "@/runtime/contracts/capabilities"

describe("publicCost", () => {
  it("never treats missing provider cost as $0", () => {
    expect(publicCost(undefined)).toEqual({ status: "unavailable" })
    expect(publicCost({ providerCost: "unavailable", providerCostSource: "unavailable" })).toEqual({
      status: "unavailable",
      source: "unavailable",
    })
  })

  it("passes through a numeric provider cost", () => {
    expect(publicCost({ providerCost: 0.012, providerCostCurrency: "USD", providerCostSource: "provider_reported" })).toEqual({
      status: "available",
      amount: 0.012,
      currency: "USD",
      source: "provider_reported",
    })
  })
})

describe("toPublicUsageEvent", () => {
  it("does not include userId or request bodies", () => {
    const event = {
      id: "u1",
      requestId: "rtreq_1",
      userId: "user_secret",
      projectId: "proj_1",
      apiKeyId: "rkey_1",
      environment: "production",
      capability: "ai.text",
      operation: "chat",
      provider: "openrouter",
      model: "openai/gpt-4o-mini",
      status: "succeeded",
      latencyMs: 12,
      creditsCharged: 40,
      createdAt: 1,
      usage: { inputTokens: 10, prompt: "should not appear if non-numeric" },
    } as unknown as RuntimeUsageEvent
    const pub = toPublicUsageEvent(event)
    expect(pub).not.toHaveProperty("userId")
    expect(JSON.stringify(pub)).not.toContain("user_secret")
    expect(pub.usage).toEqual({ inputTokens: 10 })
  })
})

describe("summarizeCosts", () => {
  it("reports null provider total when every cost is unavailable", () => {
    const s = summarizeCosts([
      { cost: { status: "unavailable" }, creditsCharged: 10, status: "succeeded" },
      { cost: { status: "unavailable" }, creditsCharged: 5, status: "failed" },
    ])
    expect(s.providerCostUsd).toBeNull()
    expect(s.creditsCharged).toBe(15)
    expect(s.providerCostUnavailableCount).toBe(2)
  })
})
