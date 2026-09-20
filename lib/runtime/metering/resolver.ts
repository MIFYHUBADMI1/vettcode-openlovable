import "server-only"
import {
  getRuntimePricingRules,
  getRuntimePricing,
  RUNTIME_PRICING_VERSION,
  type RuntimePricingRule,
} from "@/lib/billing/runtime-config"

/**
 * Atai Runtime — pricing resolution (server-only, Phase 9.5).
 *
 * The ONE authoritative pricing-resolution path (Phase 9.5 §35/§108): the
 * router and metering pipeline ask THIS module what a runtime operation
 * costs — pricing is never scattered across adapters, routes, or the SDK,
 * and never derived from client input.
 *
 * Resolution hierarchy (§8, documented behavior):
 *
 *   1. active admin rule matching provider + capability + operation
 *      → mode fixed_per_request  → deterministic flat charge (0 = free)
 *      → mode per_1k_tokens      → usage-based charge from rule rates
 *   2. no rule → legacy capability-level flat pricing (Phase 9 defaults,
 *      preserved verbatim so existing behavior/config carries forward)
 *   3. neither → UNCONFIGURED → deny (runtime_pricing_unconfigured, 503)
 *
 * A missing configuration must never silently become free (§9/§85): an
 * unpriced operation is refused before any provider spend. Zero-price rules
 * are an explicit admin decision and remain free.
 *
 * Historical integrity (§12/§41/§76): the caller persists the returned
 * snapshot (`pricingRuleId` + `pricingVersion` + rates) onto the runtime
 * usage record and ledger metadata. Admin edits affect FUTURE requests only.
 *
 * @module lib/runtime/metering/resolver
 */

/** What the resolver decided for one runtime operation. */
export interface RuntimeBillingDecision {
  /** Is this operation chargeable at all? (`test` capability is not.) */
  chargeable: boolean
  /** Why the decision has this shape (audit/logging). */
  source: "rule" | "legacy" | "unconfigured" | "non_billable"
  /** The matching active rule, when one decided the price. */
  pricingRuleId?: string
  /** Fixed flat charge (fixed_per_request). */
  fixedCredits?: number
  /** Token rates (per_1k_tokens / legacy fallback). */
  inputPer1k?: number
  outputPer1k?: number
  /** Immutable audit snapshot persisted onto usage + ledger metadata. */
  snapshot: RuntimePricingSnapshot
}

/** The pricing facts a billable event was charged under (immutable). */
export interface RuntimePricingSnapshot {
  pricingVersion: string
  pricingRuleId?: string
  /** "rule" = admin rule; "legacy" = Phase 9 flat config fallback. */
  pricingSource: "rule" | "legacy"
  mode?: "fixed_per_request" | "per_1k_tokens"
  credits?: number
  inputPer1k?: number
  outputPer1k?: number
}

/** Thrown by resolveRuntimePrice when an operation has no pricing configured. */
export class RuntimePricingUnconfiguredError extends Error {
  constructor() {
    super("Runtime pricing is not configured for this operation.")
    this.name = "RuntimePricingUnconfiguredError"
  }
}

/**
 * Resolve the applicable pricing for one runtime operation.
 * Throws RuntimePricingUnconfiguredError when nothing covers the route —
 * the meter translates that into the normalized fail-safe error.
 */
export async function resolveRuntimePrice(params: {
  provider: string
  capability: string
  operation: string
  /** The router self-test capability is never billed (Phase 9 §40). */
}): Promise<RuntimeBillingDecision> {
  if (params.capability === "test") {
    const snapshot: RuntimePricingSnapshot = { pricingVersion: RUNTIME_PRICING_VERSION, pricingSource: "legacy" }
    return { chargeable: false, source: "non_billable", snapshot }
  }

  // 1. Admin-managed rules — exact provider+capability+operation match.
  const rules = await getRuntimePricingRules()
  const rule = findActiveRule(rules, params)
  if (rule) {
    if (rule.mode === "fixed_per_request") {
      return {
        chargeable: true,
        source: "rule",
        pricingRuleId: rule.id,
        fixedCredits: rule.credits ?? 0,
        snapshot: {
          pricingVersion: RUNTIME_PRICING_VERSION,
          pricingRuleId: rule.id,
          pricingSource: "rule",
          mode: rule.mode,
          credits: rule.credits ?? 0,
        },
      }
    }
    return {
      chargeable: true,
      source: "rule",
      pricingRuleId: rule.id,
      inputPer1k: rule.inputPer1k ?? 0,
      outputPer1k: rule.outputPer1k ?? 0,
      snapshot: {
        pricingVersion: RUNTIME_PRICING_VERSION,
        pricingRuleId: rule.id,
        pricingSource: "rule",
        mode: rule.mode,
        inputPer1k: rule.inputPer1k ?? 0,
        outputPer1k: rule.outputPer1k ?? 0,
      },
    }
  }

  // 2. Legacy Phase 9 capability-level pricing (backward-compatible fallback).
  const legacy = await getRuntimePricing()
  if (params.capability === "search.web") {
    return {
      chargeable: true,
      source: "legacy",
      fixedCredits: legacy.webRequest,
      snapshot: {
        pricingVersion: RUNTIME_PRICING_VERSION,
        pricingSource: "legacy",
        mode: "fixed_per_request",
        credits: legacy.webRequest,
      },
    }
  }
  if (params.capability === "ai.text") {
    return {
      chargeable: true,
      source: "legacy",
      inputPer1k: legacy.aiTextInputPer1k,
      outputPer1k: legacy.aiTextOutputPer1k,
      snapshot: {
        pricingVersion: RUNTIME_PRICING_VERSION,
        pricingSource: "legacy",
        mode: "per_1k_tokens",
        inputPer1k: legacy.aiTextInputPer1k,
        outputPer1k: legacy.aiTextOutputPer1k,
      },
    }
  }

  // 3. Unpriced capability/operation — deny BEFORE provider execution.
  throw new RuntimePricingUnconfiguredError()
}

/**
 * Deterministic uniqueness (Phase 9.5 §75): for any provider+capability+
 * operation there must be AT MOST ONE active rule. The admin API enforces
 * this on write; this matcher is the runtime-side guarantee.
 */
export function findActiveRule(
  rules: readonly RuntimePricingRule[],
  params: { provider: string; capability: string; operation: string },
): RuntimePricingRule | null {
  let found: RuntimePricingRule | null = null
  for (const r of rules) {
    if (!r.active) continue
    if (
      r.provider === params.provider &&
      r.capability === params.capability &&
      r.operation === params.operation
    ) {
      if (found) {
        // Defensive: should be unreachable (writes are validated) — but if it
        // ever is, deterministic precedence beats an accidental double price.
        throw new Error(`Duplicate active runtime pricing rule for ${params.provider}/${params.capability}/${params.operation}`)
      }
      found = r
    }
  }
  return found
}
