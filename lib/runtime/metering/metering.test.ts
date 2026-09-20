/**
 * Atai Runtime — Phase 9 + 9.5 metering tests.
 *
 * Covers: pricing calculation (valid/zero/large/invalid usage, rounding),
 * 9.5 rule resolution (rules → legacy fallback → deny), charging (sufficient/
 * insufficient/zero-charge, idempotency, ledger correlation, failure
 * semantics), fixed-price pre-charge + refund, and the meter pipeline
 * (usage persistence, attribution, fail-closed billing).
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

const { mockConsumeCredits, mockGetAvailableCredits, mockGrantCredits } = vi.hoisted(() => ({
  mockConsumeCredits: vi.fn().mockResolvedValue({ success: true, subscriptionConsumed: 0, permanentConsumed: 0 }),
  mockGetAvailableCredits: vi.fn().mockResolvedValue(1_000_000),
  mockGrantCredits: vi.fn().mockResolvedValue({ success: true, ledgerEntry: {} }),
}))

vi.mock("@/lib/billing/credit-service", () => ({
  consumeCredits: mockConsumeCredits,
  getAvailableCredits: mockGetAvailableCredits,
  getBalance: vi.fn().mockResolvedValue({ total: 1_000_000, subscription: 600_000, permanent: 400_000 }),
  grantCredits: mockGrantCredits,
}))

// Phase 9.5 config: legacy flat pricing + admin-managed rules (mutable per test).
let runtimePricingOverride: Record<string, number> | null = null
let runtimeRulesOverride: unknown[] | null = null
vi.mock("@/lib/billing/runtime-config", () => ({
  RUNTIME_PRICING_VERSION: "RUNTIME_PRICING_V1",
  getRuntimePricing: async () => ({
    aiTextInputPer1k: 2,
    aiTextOutputPer1k: 8,
    aiEmbedPer1k: 1,
    webRequest: 5,
    ...(runtimePricingOverride ?? {}),
  }),
  getRuntimePricingRules: async () => runtimeRulesOverride ?? [],
}))

const { mockInsertOne } = vi.hoisted(() => ({
  mockInsertOne: vi.fn().mockResolvedValue({ insertedId: "mock-id" }),
}))

vi.mock("@/lib/db/runtime-collections", () => ({
  runtimeUsageCol: vi.fn().mockResolvedValue({ insertOne: mockInsertOne }),
  ensureRuntimeIndexes: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/store/id", () => ({
  cryptoId: vi.fn().mockReturnValue("rusage-test-id"),
}))

vi.mock("@/lib/logging/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { calculateRuntimeCredits, validateUsage, estimateRequestUsage, estimateMinimumCredits } from "./pricing"
import { chargeRuntimeUsage, refundRuntimeCharge } from "./charge"
import { meterRuntimeResult, recordFailedRuntimeUsage, preflightMeteredRequest } from "./meter"
import { resolveRuntimePrice, RuntimePricingUnconfiguredError, findActiveRule } from "./resolver"
import type { RuntimeAuthContext } from "@/runtime/contracts/auth"
import type { RuntimeChargeCalculation } from "./pricing"

function auth(overrides: Partial<RuntimeAuthContext> = {}): RuntimeAuthContext & { requestId: string } {
  return {
    apiKeyId: "rkey_test",
    userId: "user_owner",
    projectId: "proj_bound",
    environment: "production",
    scopes: [],
    requestId: "rtreq_fixed",
    ...overrides,
  }
}

function chatUsage(input: number, output: number) {
  return { inputTokens: input, outputTokens: output }
}

beforeEach(() => {
  vi.clearAllMocks()
  runtimePricingOverride = null
  runtimeRulesOverride = null
  mockConsumeCredits.mockResolvedValue({ success: true, subscriptionConsumed: 0, permanentConsumed: 0 })
  mockGetAvailableCredits.mockResolvedValue(1_000_000)
  mockGrantCredits.mockResolvedValue({ success: true, ledgerEntry: {} })
})

// ─── Usage validation (provider usage is untrusted external input) ──────────

describe("validateUsage", () => {
  it("accepts valid non-negative integer usage", () => {
    expect(validateUsage(chatUsage(10, 20))).toEqual({ valid: true, usage: { inputTokens: 10, outputTokens: 20 } })
    expect(validateUsage(chatUsage(0, 0)).valid).toBe(true)
  })

  it("rejects missing/malformed usage", () => {
    expect(validateUsage(undefined).valid).toBe(false)
    // @ts-expect-error — runtime robustness probe
    expect(validateUsage(null).valid).toBe(false)
    expect(validateUsage(chatUsage(-1, 0)).valid).toBe(false)
    expect(validateUsage(chatUsage(1.5, 0)).valid).toBe(false)
    expect(validateUsage(chatUsage(Number.NaN, 0)).valid).toBe(false)
    expect(validateUsage(chatUsage(Number.MAX_SAFE_INTEGER, 0)).valid).toBe(false)
    expect(validateUsage(chatUsage(10_000_001, 0)).valid).toBe(false)
  })
})

// ─── Phase 9.5 pricing RESOLUTION (rules → legacy → deny) ───────────────────

describe("resolveRuntimePrice (Phase 9.5)", () => {
  it("uses an active admin rule with exact provider+capability+operation match", async () => {
    runtimeRulesOverride = [
      { id: "rpr_a", provider: "openrouter", capability: "ai.text", operation: "chat", mode: "fixed_per_request", credits: 1000, active: true, createdAt: 1, updatedAt: 1 },
    ]
    const decision = await resolveRuntimePrice({ provider: "openrouter", capability: "ai.text", operation: "chat" })
    expect(decision.chargeable).toBe(true)
    expect(decision.source).toBe("rule")
    expect(decision.pricingRuleId).toBe("rpr_a")
    expect(decision.fixedCredits).toBe(1000)
    expect(decision.snapshot.mode).toBe("fixed_per_request")
  })

  it("does NOT apply a rule across operations (chat rule ≠ other operations)", async () => {
    runtimeRulesOverride = [
      { id: "rpr_a", provider: "openrouter", capability: "ai.text", operation: "chat", mode: "fixed_per_request", credits: 1000, active: true, createdAt: 1, updatedAt: 1 },
    ]
    // ai.text has a legacy fallback, so an unmatched operation resolves via
    // legacy — the RULE must not apply. Assert the rule was not used.
    const decision = await resolveRuntimePrice({ provider: "openrouter", capability: "ai.text", operation: "embed" })
    expect(decision.source).toBe("legacy")
  })

  it("does NOT apply a rule across providers (rule provider ≠ request provider)", async () => {
    runtimeRulesOverride = [
      { id: "rpr_a", provider: "openrouter", capability: "ai.text", operation: "chat", mode: "fixed_per_request", credits: 1000, active: true, createdAt: 1, updatedAt: 1 },
    ]
    // Legacy fallback applies for ai.text; the RULE for a different provider
    // must not. Assert the rule was not used.
    const decision = await resolveRuntimePrice({ provider: "other-provider", capability: "ai.text", operation: "chat" })
    expect(decision.source).toBe("legacy")
  })

  it("ignores inactive (disabled) rules", async () => {
    runtimeRulesOverride = [
      { id: "rpr_a", provider: "openrouter", capability: "ai.text", operation: "chat", mode: "fixed_per_request", credits: 1000, active: false, createdAt: 1, updatedAt: 1 },
    ]
    // Disabled rule → legacy fallback still applies (documented behavior).
    const decision = await resolveRuntimePrice({ provider: "openrouter", capability: "ai.text", operation: "chat" })
    expect(decision.source).toBe("legacy")
  })

  it("falls back to legacy flat pricing when no rule matches", async () => {
    const decision = await resolveRuntimePrice({ provider: "openrouter", capability: "ai.text", operation: "chat" })
    expect(decision.chargeable).toBe(true)
    expect(decision.source).toBe("legacy")
    expect(decision.inputPer1k).toBe(2)
    expect(decision.outputPer1k).toBe(8)
  })

  it("DENIES unpriced operations (missing pricing never silently becomes free)", async () => {
    await expect(resolveRuntimePrice({ provider: "openrouter", capability: "email", operation: "send" })).rejects.toBeInstanceOf(RuntimePricingUnconfiguredError)
  })

  it("treats an explicit 0-credit rule as configured-free (≠ unconfigured)", async () => {
    runtimeRulesOverride = [
      { id: "rpr_free", provider: "openrouter", capability: "ai.text", operation: "chat", mode: "fixed_per_request", credits: 0, active: true, createdAt: 1, updatedAt: 1 },
    ]
    const decision = await resolveRuntimePrice({ provider: "openrouter", capability: "ai.text", operation: "chat" })
    expect(decision.chargeable).toBe(true)
    expect(decision.fixedCredits).toBe(0)
  })

  it("rejects duplicate active rules deterministically", async () => {
    runtimeRulesOverride = [
      { id: "rpr_a", provider: "openrouter", capability: "ai.text", operation: "chat", mode: "fixed_per_request", credits: 1000, active: true, createdAt: 1, updatedAt: 1 },
      { id: "rpr_b", provider: "openrouter", capability: "ai.text", operation: "chat", mode: "fixed_per_request", credits: 5, active: true, createdAt: 2, updatedAt: 2 },
    ]
    expect(() =>
      findActiveRule(runtimeRulesOverride as never[], { provider: "openrouter", capability: "ai.text", operation: "chat" }),
    ).toThrow(/Duplicate active runtime pricing rule/)
  })

  it("non-billable test capability is never chargeable", async () => {
    const decision = await resolveRuntimePrice({ provider: "openrouter", capability: "test", operation: "echo" })
    expect(decision.chargeable).toBe(false)
  })
})

// ─── Pre-provider usage estimation (Phase 9.5 audit — insufficient-credit gate) ──

describe("estimateRequestUsage / estimateMinimumCredits", () => {
  it("estimates input tokens from neutral chat messages (conservative 3 chars/token)", () => {
    const estimate = estimateRequestUsage({ messages: [{ role: "user", content: "a".repeat(300) }] })
    expect(estimate).toEqual({ inputTokens: 100 })
  })

  it("carries the caller's max_tokens as the output bound", () => {
    const estimate = estimateRequestUsage({
      messages: [{ role: "user", content: "hello" }],
      max_tokens: 5_000,
    })
    expect(estimate).toEqual({ inputTokens: 2, maxOutputTokens: 5_000 })
  })

  it("returns undefined for non-chat shapes (gate falls back to the output floor)", () => {
    expect(estimateRequestUsage(undefined)).toBeUndefined()
    expect(estimateRequestUsage("junk")).toBeUndefined()
    expect(estimateRequestUsage({ messages: [] })).toBeUndefined()
    expect(estimateRequestUsage({ other: 1 })).toBeUndefined()
  })

  it("minimum charge = input estimate + output floor at the resolved rates", () => {
    // 300-char message → 100 input tokens; no max_tokens → 1k output floor.
    const estimate = estimateRequestUsage({ messages: [{ role: "user", content: "a".repeat(300) }] })
    // 100/1000*2 + 1000/1000*8 = 0.2 + 8 → ceil = 9.
    expect(estimateMinimumCredits({ inputPer1k: 2, outputPer1k: 8 }, estimate)).toBe(9)
  })

  it("uses max_tokens instead of the floor when the caller bounds output", () => {
    const estimate = estimateRequestUsage({ messages: [{ role: "user", content: "hi" }], max_tokens: 100 })
    // 1/1000*2 + 100/1000*8 = 0.002 + 0.8 → ceil = 1.
    expect(estimateMinimumCredits({ inputPer1k: 2, outputPer1k: 8 }, estimate)).toBe(1)
  })

  it("zero rates → zero minimum (free operations are never balance-gated)", () => {
    expect(estimateMinimumCredits({ inputPer1k: 0, outputPer1k: 0 }, undefined)).toBe(0)
  })
})

// ─── Pricing calculation (pure, deterministic) ──────────────────────────────

describe("calculateRuntimeCredits", () => {
  it("prices ai.text per 1k tokens via the legacy decision, input and output split", async () => {
    const decision = await resolveRuntimePrice({ provider: "openrouter", capability: "ai.text", operation: "chat" })
    const calc = calculateRuntimeCredits({
      decision,
      provider: "openrouter",
      capability: "ai.text",
      operation: "chat",
      model: "openai/gpt-test",
      usage: chatUsage(10_000, 5_000),
    })
    // 10k input × 2/1k = 20; 5k output × 8/1k = 40 → 60 credits.
    expect(calc.credits).toBe(60)
    expect(calc.snapshot.pricingVersion).toBe("RUNTIME_PRICING_V1")
    expect(calc.pricingRule.inputTokens).toBe(10_000)
    expect(calc.pricingRule.outputTokens).toBe(5_000)
  })

  it("rounds fractional totals deterministically", async () => {
    const decision = await resolveRuntimePrice({ provider: "openrouter", capability: "ai.text", operation: "chat" })
    // 1,500 input tokens × 2/1k = 3.0 → 3
    const calc = calculateRuntimeCredits({
      decision, provider: "p", capability: "ai.text", operation: "chat", usage: chatUsage(1_500, 0),
    })
    expect(calc.credits).toBe(3)
  })

  it("rounds the TOTAL once (0.2 input + 0.8 output = 1 credit, not 0)", async () => {
    const decision = await resolveRuntimePrice({ provider: "openrouter", capability: "ai.text", operation: "chat" })
    const calc = calculateRuntimeCredits({
      decision, provider: "p", capability: "ai.text", operation: "chat", usage: chatUsage(100, 100),
    })
    expect(calc.credits).toBe(1)
  })

  it("sub-half-credit usage rounds to 0 (no fractional charges, no hidden debt)", async () => {
    const decision = await resolveRuntimePrice({ provider: "openrouter", capability: "ai.text", operation: "chat" })
    // 40 × 2/1k = 0.08 input + 40 × 8/1k = 0.32 output → 0.4 → 0.
    const calc = calculateRuntimeCredits({
      decision, provider: "p", capability: "ai.text", operation: "chat", usage: chatUsage(40, 40),
    })
    expect(calc.credits).toBe(0)
  })

  it("zero usage → 0 credits", async () => {
    const decision = await resolveRuntimePrice({ provider: "openrouter", capability: "ai.text", operation: "chat" })
    const calc = calculateRuntimeCredits({
      decision, provider: "p", capability: "ai.text", operation: "chat", usage: chatUsage(0, 0),
    })
    expect(calc.credits).toBe(0)
  })

  it("invalid/missing usage → 0 credits (never a corrupt charge)", async () => {
    const decision = await resolveRuntimePrice({ provider: "openrouter", capability: "ai.text", operation: "chat" })
    const calc = calculateRuntimeCredits({
      decision, provider: "p", capability: "ai.text", operation: "chat", usage: undefined,
    })
    expect(calc.credits).toBe(0)
  })

  it("search.web is flat request-priced regardless of usage", async () => {
    const decision = await resolveRuntimePrice({ provider: "openrouter", capability: "search.web", operation: "web" })
    const calc = calculateRuntimeCredits({
      decision, provider: "openrouter", capability: "search.web", operation: "web", usage: undefined,
    })
    expect(calc.credits).toBe(5)
    expect(calc.fixed).toBe(true)
  })

  it("explicit zero-credit fixed rule charges 0 but stays configured", async () => {
    runtimeRulesOverride = [
      { id: "rpr_free", provider: "openrouter", capability: "ai.text", operation: "chat", mode: "fixed_per_request", credits: 0, active: true, createdAt: 1, updatedAt: 1 },
    ]
    const decision = await resolveRuntimePrice({ provider: "openrouter", capability: "ai.text", operation: "chat" })
    const calc = calculateRuntimeCredits({
      decision, provider: "openrouter", capability: "ai.text", operation: "chat", usage: undefined,
    })
    expect(calc.credits).toBe(0)
    expect(calc.configured).toBe(true)
    expect(calc.snapshot.pricingRuleId).toBe("rpr_free")
  })

  it("responds to admin legacy pricing changes (config-driven, not hardcoded)", async () => {
    runtimePricingOverride = { aiTextInputPer1k: 4, aiTextOutputPer1k: 10 }
    const decision = await resolveRuntimePrice({ provider: "p", capability: "ai.text", operation: "chat" })
    const calc = calculateRuntimeCredits({
      decision, provider: "p", capability: "ai.text", operation: "chat", usage: chatUsage(1_000, 1_000),
    })
    expect(calc.credits).toBe(14)
  })
})

// ─── Charging (existing credit system, idempotent, fail-closed) ─────────────

describe("chargeRuntimeUsage", () => {
  it("charges through consumeCredits with the runtime_usage ledger type", async () => {
    const decision = await resolveRuntimePrice({ provider: "openrouter", capability: "ai.text", operation: "chat" })
    const calculation = calculateRuntimeCredits({
      decision, provider: "openrouter", capability: "ai.text", operation: "chat", model: "m", usage: chatUsage(10_000, 5_000),
    })
    const result = await chargeRuntimeUsage({ auth: auth(), calculation })

    expect(result.charged).toBe(true)
    expect(result.creditsCharged).toBe(60)
    expect(mockConsumeCredits).toHaveBeenCalledTimes(1)
    const call = mockConsumeCredits.mock.calls[0][0]
    expect(call.userId).toBe("user_owner")
    expect(call.amount).toBe(60)
    expect(call.transactionType).toBe("runtime_usage")
    expect(call.idempotencyKey).toBe("runtime_rtreq_fixed")
    expect(call.referenceType).toBe("runtime_request")
    expect(call.referenceId).toBe("rtreq_fixed")
    expect(call.metadata.projectId).toBe("proj_bound")
    expect(call.metadata.apiKeyId).toBe("rkey_test")
    expect(call.metadata.pricingVersion).toBe("RUNTIME_PRICING_V1")
    expect(call.metadata.pricingRuleId).toBeUndefined() // legacy source — no rule id
  })

  it("snapshots the pricingRuleId onto ledger metadata for admin rules", async () => {
    runtimeRulesOverride = [
      { id: "rpr_snap", provider: "openrouter", capability: "ai.text", operation: "chat", mode: "fixed_per_request", credits: 1000, active: true, createdAt: 1, updatedAt: 1 },
    ]
    const decision = await resolveRuntimePrice({ provider: "openrouter", capability: "ai.text", operation: "chat" })
    const calculation = calculateRuntimeCredits({
      decision, provider: "openrouter", capability: "ai.text", operation: "chat", usage: undefined,
    })
    await chargeRuntimeUsage({ auth: auth(), calculation })
    const call = mockConsumeCredits.mock.calls[0][0]
    expect(call.metadata.pricingRuleId).toBe("rpr_snap")
    expect(call.metadata.pricingSource).toBe("rule")
    expect(call.metadata.pricingMode).toBe("fixed_per_request")
  })

  it("zero-credit charge never touches the ledger (no zero-amount debit entries)", async () => {
    const decision = await resolveRuntimePrice({ provider: "openrouter", capability: "ai.text", operation: "chat" })
    const calculation = calculateRuntimeCredits({
      decision, provider: "p", capability: "ai.text", operation: "chat", usage: chatUsage(10, 10),
    })
    const result = await chargeRuntimeUsage({ auth: auth(), calculation })
    expect(result.charged).toBe(false)
    expect(result.creditsCharged).toBe(0)
    expect(mockConsumeCredits).not.toHaveBeenCalled()
  })

  it("insufficient credits → throws 402 runtime_insufficient_entitlement", async () => {
    mockConsumeCredits.mockResolvedValue({ success: false, subscriptionConsumed: 0, permanentConsumed: 0 })
    const decision = await resolveRuntimePrice({ provider: "p", capability: "ai.text", operation: "chat" })
    const calculation = calculateRuntimeCredits({
      decision, provider: "p", capability: "ai.text", operation: "chat", usage: chatUsage(10_000, 5_000),
    })
    await expect(chargeRuntimeUsage({ auth: auth(), calculation })).rejects.toMatchObject({
      code: "runtime_insufficient_entitlement",
      status: 402,
    })
  })

  it("ledger failure → throws 503 runtime_billing_unavailable (fail closed)", async () => {
    mockConsumeCredits.mockRejectedValue(new Error("ledger unavailable"))
    const decision = await resolveRuntimePrice({ provider: "p", capability: "ai.text", operation: "chat" })
    const calculation = calculateRuntimeCredits({
      decision, provider: "p", capability: "ai.text", operation: "chat", usage: chatUsage(10_000, 5_000),
    })
    await expect(chargeRuntimeUsage({ auth: auth(), calculation })).rejects.toMatchObject({
      code: "runtime_billing_unavailable",
      status: 503,
    })
  })

  it("rejects invalid calculated charges defensively (negative/non-integer)", async () => {
    const decision = await resolveRuntimePrice({ provider: "p", capability: "ai.text", operation: "chat" })
    const calculation = calculateRuntimeCredits({
      decision, provider: "p", capability: "ai.text", operation: "chat", usage: chatUsage(0, 0),
    })
    calculation.credits = -5
    await expect(chargeRuntimeUsage({ auth: auth(), calculation })).rejects.toMatchObject({
      code: "runtime_billing_unavailable",
    })
  })
})

// ─── Refunds (Phase 9.5 §20/§58 — provider failure after fixed pre-charge) ──

describe("refundRuntimeCharge", () => {
  it("refunds a prepaid charge through grantCredits with runtime_refund type", async () => {
    runtimeRulesOverride = [
      { id: "rpr_r", provider: "openrouter", capability: "ai.text", operation: "chat", mode: "fixed_per_request", credits: 1000, active: true, createdAt: 1, updatedAt: 1 },
    ]
    const decision = await resolveRuntimePrice({ provider: "openrouter", capability: "ai.text", operation: "chat" })
    const calculation = calculateRuntimeCredits({
      decision, provider: "openrouter", capability: "ai.text", operation: "chat", usage: undefined,
    })
    const result = await refundRuntimeCharge({ auth: auth(), calculation, reason: "provider_failed" })

    expect(result.refunded).toBe(true)
    expect(mockGrantCredits).toHaveBeenCalledTimes(1)
    const call = mockGrantCredits.mock.calls[0][0]
    expect(call.amount).toBe(1000)
    expect(call.creditType).toBe("permanent")
    expect(call.transactionType).toBe("runtime_refund")
    expect(call.idempotencyKey).toBe("runtime_rtreq_fixed_refund")
    expect(call.metadata.reason).toBe("provider_failed")
    expect(call.metadata.originalChargeKey).toBe("runtime_rtreq_fixed")
  })

  it("never refunds a zero-credit calculation", async () => {
    const decision = await resolveRuntimePrice({ provider: "p", capability: "ai.text", operation: "chat" })
    const calculation = calculateRuntimeCredits({
      decision, provider: "p", capability: "ai.text", operation: "chat", usage: undefined,
    })
    const result = await refundRuntimeCharge({ auth: auth(), calculation, reason: "provider_failed" })
    expect(result.refunded).toBe(false)
    expect(mockGrantCredits).not.toHaveBeenCalled()
  })

  it("refund ledger failure → throws 503 (fail closed, never silently wrong)", async () => {
    mockGrantCredits.mockRejectedValue(new Error("ledger down"))
    runtimeRulesOverride = [
      { id: "rpr_r", provider: "openrouter", capability: "ai.text", operation: "chat", mode: "fixed_per_request", credits: 1000, active: true, createdAt: 1, updatedAt: 1 },
    ]
    const decision = await resolveRuntimePrice({ provider: "openrouter", capability: "ai.text", operation: "chat" })
    const calculation = calculateRuntimeCredits({
      decision, provider: "openrouter", capability: "ai.text", operation: "chat", usage: undefined,
    })
    await expect(refundRuntimeCharge({ auth: auth(), calculation, reason: "provider_failed" })).rejects.toMatchObject({
      code: "runtime_billing_unavailable",
      status: 503,
    })
  })
})

// ─── Meter pipeline ─────────────────────────────────────────────────────────

describe("meterRuntimeResult", () => {
  it("records a complete succeeded usage event with ledger correlation", async () => {
    const decision = await resolveRuntimePrice({ provider: "openrouter", capability: "ai.text", operation: "chat" })
    const result = await meterRuntimeResult({
      auth: auth(),
      provider: "openrouter",
      capability: "ai.text",
      operation: "chat",
      model: "openai/gpt-test",
      usage: chatUsage(10_000, 5_000),
      providerCost: { amount: 0.0123, currency: "USD", source: "provider_reported" },
      latencyMs: 123.6,
      startedAt: 1_700_000_000_000,
    })

    expect(result.creditsCharged).toBe(60)
    expect(mockInsertOne).toHaveBeenCalledTimes(1)
    const doc = mockInsertOne.mock.calls[0][0]
    expect(doc.requestId).toBe("rtreq_fixed")
    expect(doc.userId).toBe("user_owner")
    expect(doc.projectId).toBe("proj_bound")
    expect(doc.apiKeyId).toBe("rkey_test")
    expect(doc.environment).toBe("production")
    expect(doc.capability).toBe("ai.text")
    expect(doc.operation).toBe("chat")
    expect(doc.provider).toBe("openrouter")
    expect(doc.model).toBe("openai/gpt-test")
    expect(doc.status).toBe("succeeded")
    expect(doc.latencyMs).toBe(124) // rounded, monotonic source in prod
    expect(doc.usage).toEqual({ inputTokens: 10_000, outputTokens: 5_000 })
    expect(doc.creditsCharged).toBe(60)
    expect(doc.costMetadata.pricingVersion).toBe("RUNTIME_PRICING_V1")
    expect(doc.costMetadata.ledgerIdempotencyKey).toBe("runtime_rtreq_fixed")
    // Phase 9.5 provider cost: verbatim, distinct from the credit charge,
    // unavailable ≠ 0.
    expect(doc.costMetadata.providerCost).toBe(0.0123)
    expect(doc.costMetadata.providerCostCurrency).toBe("USD")
    expect(doc.costMetadata.providerCostSource).toBe("provider_reported")
    expect(doc.createdAt).toBe(1_700_000_000_000)
    // No secrets / no content in the usage record.
    const serialized = JSON.stringify(doc)
    expect(serialized).not.toContain("sk-")
    expect(serialized.toLowerCase()).not.toContain("authorization")
  })

  it("unavailable provider cost is recorded as unavailable — never as 0", async () => {
    const result = await meterRuntimeResult({
      auth: auth(),
      provider: "openrouter",
      capability: "ai.text",
      operation: "chat",
      usage: chatUsage(5, 5),
      providerCost: { source: "unavailable" },
      latencyMs: 10,
      startedAt: 1_700_000_000_000,
    })
    const doc = mockInsertOne.mock.calls[0][0]
    expect(doc.costMetadata.providerCost).toBeNull()
    expect(doc.costMetadata.providerCostSource).toBe("unavailable")
    expect(result.creditsCharged).toBe(0)
  })

  it("zero-charge usage is still recorded for auditability", async () => {
    await meterRuntimeResult({
      auth: auth(),
      provider: "p",
      capability: "ai.text",
      operation: "chat",
      usage: chatUsage(5, 5),
      latencyMs: 10,
      startedAt: 1_700_000_000_000,
    })
    const doc = mockInsertOne.mock.calls[0][0]
    expect(doc.creditsCharged).toBe(0)
    expect(doc.status).toBe("succeeded")
  })

  it("fixed-price op with a prepaid calculation is NOT charged twice", async () => {
    runtimeRulesOverride = [
      { id: "rpr_pre", provider: "openrouter", capability: "ai.text", operation: "chat", mode: "fixed_per_request", credits: 1000, active: true, createdAt: 1, updatedAt: 1 },
    ]
    const decision = await resolveRuntimePrice({ provider: "openrouter", capability: "ai.text", operation: "chat" })
    const prepaid: RuntimeChargeCalculation = calculateRuntimeCredits({
      decision, provider: "openrouter", capability: "ai.text", operation: "chat", usage: undefined,
    })

    const result = await meterRuntimeResult({
      auth: auth(),
      provider: "openrouter",
      capability: "ai.text",
      operation: "chat",
      usage: chatUsage(10_000, 5_000),
      latencyMs: 10,
      startedAt: 1_700_000_000_000,
      prepaid,
    })

    // Pre-charge already happened in preflight — no second consumeCredits.
    expect(mockConsumeCredits).not.toHaveBeenCalled()
    expect(result.creditsCharged).toBe(1000)
    const doc = mockInsertOne.mock.calls[0][0]
    expect(doc.creditsCharged).toBe(1000)
    expect(doc.costMetadata.chargedBeforeProvider).toBe(true)
  })

  it("prepaid event is finalized even if the admin DEACTIVATES the rule mid-flight (no stranded charge)", async () => {
    runtimeRulesOverride = [
      { id: "rpr_pre", provider: "openrouter", capability: "ai.text", operation: "chat", mode: "fixed_per_request", credits: 1000, active: true, createdAt: 1, updatedAt: 1 },
    ]
    const decision = await resolveRuntimePrice({ provider: "openrouter", capability: "ai.text", operation: "chat" })
    const prepaid: RuntimeChargeCalculation = calculateRuntimeCredits({
      decision, provider: "openrouter", capability: "ai.text", operation: "chat", usage: undefined,
    })

    // Admin edits pricing AFTER the pre-charge but BEFORE metering completes.
    // The already-paid charge must still be finalized under its snapshot —
    // never stranded behind a post-provider unconfigured/503 error.
    runtimeRulesOverride = []

    const result = await meterRuntimeResult({
      auth: auth(),
      provider: "openrouter",
      capability: "ai.text",
      operation: "chat",
      usage: chatUsage(10_000, 5_000),
      latencyMs: 10,
      startedAt: 1_700_000_000_000,
      prepaid,
    })

    expect(result.creditsCharged).toBe(1000)
    expect(result.pricingSnapshot.pricingRuleId).toBe("rpr_pre")
    expect(mockConsumeCredits).not.toHaveBeenCalled() // never re-charged
    expect(mockInsertOne).toHaveBeenCalledTimes(1) // usage record persisted
  })

  it("insufficient credits propagate as 402 after provider success", async () => {
    mockConsumeCredits.mockResolvedValue({ success: false, subscriptionConsumed: 0, permanentConsumed: 0 })
    await expect(
      meterRuntimeResult({
        auth: auth(),
        provider: "p",
        capability: "ai.text",
        operation: "chat",
        usage: chatUsage(10_000, 5_000),
        latencyMs: 10,
        startedAt: 1_700_000_000_000,
      }),
    ).rejects.toMatchObject({ code: "runtime_insufficient_entitlement", status: 402 })
  })
})

describe("recordFailedRuntimeUsage", () => {
  it("records a failed usage event with 0 credits and no ledger entry marker", async () => {
    await recordFailedRuntimeUsage({
      auth: auth(),
      provider: "openrouter",
      capability: "ai.text",
      operation: "chat",
      errorCategory: "provider_timeout",
      latencyMs: 5_000,
      startedAt: 1_700_000_000_000,
    })
    const doc = mockInsertOne.mock.calls[0][0]
    expect(doc.status).toBe("failed")
    expect(doc.creditsCharged).toBe(0)
    expect(doc.errorCategory).toBe("provider_timeout")
    expect(doc.costMetadata.ledgerIdempotencyKey).toBeNull()
    expect(doc.costMetadata.failedBeforeBillableUsage).toBe(true)
    expect(mockConsumeCredits).not.toHaveBeenCalled()
  })

  it("provider failure after a fixed pre-charge → idempotent refund + refund metadata", async () => {
    runtimeRulesOverride = [
      { id: "rpr_pre", provider: "openrouter", capability: "ai.text", operation: "chat", mode: "fixed_per_request", credits: 1000, active: true, createdAt: 1, updatedAt: 1 },
    ]
    const decision = await resolveRuntimePrice({ provider: "openrouter", capability: "ai.text", operation: "chat" })
    const prepaid: RuntimeChargeCalculation = calculateRuntimeCredits({
      decision, provider: "openrouter", capability: "ai.text", operation: "chat", usage: undefined,
    })

    await recordFailedRuntimeUsage({
      auth: auth(),
      provider: "openrouter",
      capability: "ai.text",
      operation: "chat",
      errorCategory: "provider_error",
      latencyMs: 100,
      startedAt: 1_700_000_000_000,
      prepaid,
    })

    expect(mockGrantCredits).toHaveBeenCalledTimes(1)
    const refund = mockGrantCredits.mock.calls[0][0]
    expect(refund.transactionType).toBe("runtime_refund")
    expect(refund.amount).toBe(1000)
    const doc = mockInsertOne.mock.calls[0][0]
    expect(doc.status).toBe("failed")
    expect(doc.costMetadata.refundedAfterPrecharge).toBe(true)
    expect(doc.costMetadata.refundIdempotencyKey).toBe("runtime_rtreq_fixed_refund")
    expect(doc.costMetadata.refundReason).toBe("provider_failed")
  })

  it("never throws even when persistence fails (must not mask provider errors)", async () => {
    mockInsertOne.mockRejectedValueOnce(new Error("db down"))
    await expect(
      recordFailedRuntimeUsage({
        auth: auth(),
        provider: "p",
        capability: "ai.text",
        operation: "chat",
        errorCategory: "provider_error",
        latencyMs: 1,
        startedAt: 1_700_000_000_000,
      }),
    ).resolves.toBeUndefined()
  })
})

// ─── Preflight gate (Phase 9.5 — fixed pre-charge, zero-balance denial) ─────

describe("preflightMeteredRequest", () => {
  it("allows requests with available credits", async () => {
    const gate = await preflightMeteredRequest({
      auth: auth(), provider: "openrouter", capability: "ai.text", operation: "chat",
    })
    expect(gate.denial).toBeNull()
  })

  it("rejects zero balance with 402 before provider execution", async () => {
    mockGetAvailableCredits.mockResolvedValue(0)
    const gate = await preflightMeteredRequest({
      auth: auth(), provider: "openrouter", capability: "ai.text", operation: "chat",
    })
    expect(gate.denial).toMatchObject({ code: "runtime_insufficient_entitlement", status: 402 })
  })

  it("fails closed (503) when the balance cannot be verified", async () => {
    mockGetAvailableCredits.mockRejectedValue(new Error("db down"))
    const gate = await preflightMeteredRequest({
      auth: auth(), provider: "openrouter", capability: "ai.text", operation: "chat",
    })
    expect(gate.denial).toMatchObject({ code: "runtime_billing_unavailable", status: 503 })
  })

  it("denies unpriced operations BEFORE any provider spend (503)", async () => {
    const gate = await preflightMeteredRequest({
      auth: auth(), provider: "openrouter", capability: "email", operation: "send",
    })
    expect(gate.denial).toMatchObject({ code: "runtime_pricing_unconfigured", status: 503 })
  })

  it("fixed-price op pre-charges BEFORE the provider and returns the prepaid calculation", async () => {
    runtimeRulesOverride = [
      { id: "rpr_pre", provider: "openrouter", capability: "ai.text", operation: "chat", mode: "fixed_per_request", credits: 1000, active: true, createdAt: 1, updatedAt: 1 },
    ]
    const gate = await preflightMeteredRequest({
      auth: auth(), provider: "openrouter", capability: "ai.text", operation: "chat",
    })
    expect(gate.denial).toBeNull()
    expect(gate.prepaid).toBeDefined()
    expect(gate.prepaid?.credits).toBe(1000)
    // The pre-charge went through the EXISTING credit service, once.
    expect(mockConsumeCredits).toHaveBeenCalledTimes(1)
    expect(mockConsumeCredits.mock.calls[0][0].idempotencyKey).toBe("runtime_rtreq_fixed")
  })

  it("usage-based op rejects a balance below the CONSERVATIVE estimated charge (402 before provider)", async () => {
    // Legacy rates: 2 in / 8 out per 1k → minimum estimate = 1k output floor × 8 = 8.
    mockGetAvailableCredits.mockResolvedValue(7)
    const gate = await preflightMeteredRequest({
      auth: auth(), provider: "openrouter", capability: "ai.text", operation: "chat",
      input: { messages: [{ role: "user", content: "hello world" }] },
    })
    expect(gate.denial).toMatchObject({ code: "runtime_insufficient_entitlement", status: 402 })
  })

  it("usage-based op admits a balance covering the estimated charge", async () => {
    // 4 estimated input tokens → 4/1000*2 + 1000/1000*8 = 8.008 → ceil 9.
    mockGetAvailableCredits.mockResolvedValue(9)
    const gate = await preflightMeteredRequest({
      auth: auth(), provider: "openrouter", capability: "ai.text", operation: "chat",
      input: { messages: [{ role: "user", content: "hello world" }] },
    })
    expect(gate.denial).toBeNull()
  })

  it("usage-based op with a 0/0 free rule is never balance-gated (usable at balance 0)", async () => {
    runtimeRulesOverride = [
      { id: "rpr_free_tokens", provider: "openrouter", capability: "ai.text", operation: "chat", mode: "per_1k_tokens", inputPer1k: 0, outputPer1k: 0, active: true, createdAt: 1, updatedAt: 1 },
    ]
    mockGetAvailableCredits.mockResolvedValue(0)
    const gate = await preflightMeteredRequest({
      auth: auth(), provider: "openrouter", capability: "ai.text", operation: "chat",
      input: { messages: [{ role: "user", content: "hello world" }] },
    })
    expect(gate.denial).toBeNull()
  })

  it("fixed-price op with insufficient balance → 402 and NO charge, NO provider", async () => {
    runtimeRulesOverride = [
      { id: "rpr_pre", provider: "openrouter", capability: "ai.text", operation: "chat", mode: "fixed_per_request", credits: 1000, active: true, createdAt: 1, updatedAt: 1 },
    ]
    mockGetAvailableCredits.mockResolvedValue(500)
    const gate = await preflightMeteredRequest({
      auth: auth(), provider: "openrouter", capability: "ai.text", operation: "chat",
    })
    expect(gate.denial).toMatchObject({ code: "runtime_insufficient_entitlement", status: 402 })
    expect(mockConsumeCredits).not.toHaveBeenCalled()
    expect(gate.prepaid).toBeUndefined()
  })

  it("explicitly free fixed-price rule (0 credits) skips the charge entirely", async () => {
    runtimeRulesOverride = [
      { id: "rpr_free", provider: "openrouter", capability: "ai.text", operation: "chat", mode: "fixed_per_request", credits: 0, active: true, createdAt: 1, updatedAt: 1 },
    ]
    const gate = await preflightMeteredRequest({
      auth: auth(), provider: "openrouter", capability: "ai.text", operation: "chat",
    })
    expect(gate.denial).toBeNull()
    expect(gate.prepaid?.credits).toBe(0)
    expect(mockConsumeCredits).not.toHaveBeenCalled()
  })
})
