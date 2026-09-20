import type { NormalizedProviderUsage } from "@/runtime/contracts/router"
import type {
  RuntimeBillingDecision,
  RuntimePricingSnapshot,
} from "./resolver"

/**
 * Atai Runtime — runtime pricing service (server-only).
 *
 * Converts NORMALIZED provider usage + the RESOLVED RuntimeBillingDecision
 * into an Atai customer credit charge. Pure and deterministic: no balance
 * mutation, no provider calls, no client input. The pricing decision comes
 * exclusively from resolveRuntimePrice() (lib/runtime/metering/resolver.ts) —
 * admin rules first, legacy flat config as fallback, deny when unconfigured.
 * Provider adapters never hardcode prices (Phase 9 §10/§107, 9.5 §84).
 *
 * Separation of concerns (Phase 9 §89):
 *   - resolver.ts         → WHAT does this operation cost (rules/config)
 *   - this module         → charge CALCULATION (pure, no balance mutation)
 *   - charge.ts           → authoritative credit mutation via the credit service
 *
 * Provider cost vs customer charge (Phase 9 §11): what Atai pays the
 * provider is a provider-economics concern carried alongside usage; it is
 * NEVER treated as the customer price.
 *
 * @module lib/runtime/metering/pricing
 */

/** Cap on any single token count accepted from provider-reported usage. */
export const MAX_TOKENS_PER_FIELD = 10_000_000

/**
 * Conservative output-token floor assumed for usage-based pricing when the
 * caller does not bound the generation with `max_tokens` (Phase 9.5 audit —
 * insufficient-credit pre-gate). Usage-based charges settle AFTER the
 * provider runs, so the pre-provider gate must assume SOME output spend;
 * without a floor, a near-zero balance could trigger arbitrarily large
 * unbilled provider cost. 1k tokens = the smallest chargeable unit the
 * pricing vocabulary supports. Financially conservative (over-rejects
 * slightly); the exact charge is still settled post-provider.
 */
export const ESTIMATED_OUTPUT_TOKEN_FLOOR = 1_000

/**
 * Chars-per-token used to conservatively estimate input tokens from the
 * provider-neutral chat input. 3 (not the ~4 of ideal English prose) keeps
 * the estimate on the high side for code/JSON-heavy content.
 */
const ESTIMATE_CHARS_PER_TOKEN = 3

/** Pre-provider usage estimate derived from the provider-neutral request. */
export interface UsageEstimate {
  inputTokens: number
  /** Caller-provided output bound (`max_tokens`), when set. */
  maxOutputTokens?: number
}

/**
 * Estimate the billable volume of a provider-neutral request BEFORE the
 * provider runs (Phase 9.5 audit — pre-provider insufficient-credit gate).
 *
 * Understands ONLY the neutral chat shape (`messages[].content` strings +
 * optional `max_tokens`) — no provider-specific parsing, no billing
 * decisions. Unknown shapes return undefined and the caller falls back to
 * the output-token floor alone (fail-safe, never fail-open).
 */
export function estimateRequestUsage(input: unknown): UsageEstimate | undefined {
  if (typeof input !== "object" || input === null) return undefined
  const v = input as Record<string, unknown>
  if (!Array.isArray(v.messages) || v.messages.length === 0) return undefined

  let chars = 0
  for (const m of v.messages) {
    if (typeof m === "object" && m !== null && typeof (m as { content?: unknown }).content === "string") {
      chars += (m as { content: string }).content.length
    }
  }
  const inputTokens = Math.max(1, Math.ceil(chars / ESTIMATE_CHARS_PER_TOKEN))
  const maxOutputTokens =
    typeof v.max_tokens === "number" && Number.isInteger(v.max_tokens) && v.max_tokens > 0
      ? v.max_tokens
      : undefined
  return { inputTokens, ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}) }
}

/**
 * Conservative minimum charge (credits) a usage-based operation will cost:
 * estimated input cost + output cost bounded by `max_tokens` (or the floor
 * when unbounded). Uses ceiling rounding — strictly ≥ the honest charge
 * under the same rates, so the pre-provider gate can never admit a request
 * whose GUARANTEED cost already exceeds the balance (Phase 9.5 audit).
 */
export function estimateMinimumCredits(decision: {
  inputPer1k?: number
  outputPer1k?: number
}, estimate: UsageEstimate | undefined): number {
  const inputTokens = estimate?.inputTokens ?? 0
  const outputTokens = estimate?.maxOutputTokens ?? ESTIMATED_OUTPUT_TOKEN_FLOOR
  const total =
    (inputTokens / 1_000) * (decision.inputPer1k ?? 0) +
    (outputTokens / 1_000) * (decision.outputPer1k ?? 0)
  return Math.ceil(total)
}

/**
 * Validated billable usage. Provider-reported usage is EXTERNAL INPUT and
 * never trusted blindly (Phase 9 §53/§52): values must be finite,
 * non-negative integers within bounds.
 */
export interface ValidatedUsage {
  inputTokens: number
  outputTokens: number
}

export type UsageValidationResult =
  | { valid: true; usage: ValidatedUsage }
  | { valid: false; reason: string }

/**
 * Validate normalized provider usage before it can produce a charge.
 * Malformed / unbounded usage fails validation — it can never corrupt the
 * charge or silently become a zero-cost request.
 */
export function validateUsage(usage: NormalizedProviderUsage | undefined): UsageValidationResult {
  if (!usage || typeof usage !== "object") {
    return { valid: false, reason: "usage missing" }
  }
  const isCount = (v: unknown): v is number =>
    typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_TOKENS_PER_FIELD

  if (!isCount(usage.inputTokens) || !isCount(usage.outputTokens)) {
    return { valid: false, reason: "usage token counts must be non-negative integers within bounds" }
  }
  return { valid: true, usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens } }
}

/**
 * Deterministic integer rounding for a fractional token-based charge:
 * standard rounding applied to the TOTAL (never per-field), so a tiny usage
 * either rounds to its honest value or to 0 — no per-field rounding drift,
 * no hidden fractional debt (Phase 9 §51).
 */
function roundCredits(total: number): number {
  return Math.round(total)
}

/** The outcome of a runtime charge calculation. */
export interface RuntimeChargeCalculation {
  /** Integer Atai credits to charge. Never negative. 0 only when genuinely free. */
  credits: number
  /** Whether the operation has a configured price at all. */
  configured: boolean
  /** Whether this invocation is fixed-price (deterministic pre-provider charge). */
  fixed: boolean
  /** Immutable pricing snapshot persisted onto usage + ledger metadata. */
  snapshot: RuntimePricingSnapshot
  /** Audit metadata: the rule/fallback that produced the charge (no secrets). */
  pricingRule: {
    pricingRuleId?: string
    provider: string
    capability: string
    operation: string
    model?: string
    mode?: "fixed_per_request" | "per_1k_tokens"
    inputTokens: number
    outputTokens: number
    inputPer1k?: number
    outputPer1k?: number
    credits?: number
  }
}

/**
 * Calculate the Atai customer charge for one billable runtime invocation
 * under the resolved pricing decision.
 *
 * - fixed_per_request: the charge is the configured flat price, independent
 *   of provider usage (the deterministic pre-provider case — Phase 9.5 §19).
 * - per_1k_tokens: the validated usage determines the charge.
 * - Unconfigured decisions cannot reach this function (the resolver denies
 *   them first); an assertion guards the invariant anyway.
 */
export function calculateRuntimeCredits(params: {
  decision: RuntimeBillingDecision
  provider: string
  capability: string
  operation: string
  model?: string
  usage: NormalizedProviderUsage | undefined
}): RuntimeChargeCalculation {
  const { decision } = params
  if (!decision.chargeable) {
    throw new Error("calculateRuntimeCredits called for a non-billable capability")
  }

  const ruleBase = {
    provider: params.provider,
    capability: params.capability,
    operation: params.operation,
    ...(params.model !== undefined ? { model: params.model } : {}),
    ...(decision.pricingRuleId !== undefined ? { pricingRuleId: decision.pricingRuleId } : {}),
    mode: decision.snapshot.mode,
    inputPer1k: decision.inputPer1k,
    outputPer1k: decision.outputPer1k,
    credits: decision.fixedCredits,
  }

  // Fixed-price operation: one deterministic charge per billable request.
  if (decision.snapshot.mode === "fixed_per_request") {
    const credits = decision.fixedCredits ?? 0
    return {
      credits,
      configured: true,
      fixed: true,
      snapshot: decision.snapshot,
      pricingRule: {
        ...ruleBase,
        inputTokens: 0,
        outputTokens: 0,
      },
    }
  }

  // Token-priced operation: validated usage determines the charge.
  const validated = validateUsage(params.usage)
  const inputTokens = validated.valid ? validated.usage.inputTokens : 0
  const outputTokens = validated.valid ? validated.usage.outputTokens : 0
  const total =
    (inputTokens / 1_000) * (decision.inputPer1k ?? 0) +
    (outputTokens / 1_000) * (decision.outputPer1k ?? 0)

  return {
    credits: roundCredits(total),
    // Usage-based charge with an all-zero price is still "configured" — the
    // admin explicitly set rates to 0 (free), which is not "missing config".
    configured: decision.source !== "unconfigured",
    fixed: false,
    snapshot: decision.snapshot,
    pricingRule: {
      ...ruleBase,
      inputTokens,
      outputTokens,
    },
  }
}
