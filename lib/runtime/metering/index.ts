/**
 * Atai Runtime — metering module barrel (server-only).
 *
 * Runtime usage metering and credit charging (Phase 9 + 9.5). One central
 * pipeline:
 *
 *   resolveRuntimePrice (resolver.ts — admin rules → legacy fallback → deny)
 *     → preflightMeteredRequest (meter.ts — pre-provider authorization /
 *       fixed-price pre-charge)
 *     → provider execution (router)
 *     → calculateRuntimeCredits (pricing.ts — pure, decision-driven)
 *     → chargeRuntimeUsage      (charge.ts — existing credit ledger, idempotent)
 *     → refundRuntimeCharge     (charge.ts — idempotent runtime_refund)
 *     → recordUsage             (runtime_usage audit record w/ pricing
 *                                snapshot + provider cost)
 *
 * Provider adapters NEVER charge credits and never hardcode prices; this is
 * the only authoritative customer-charge path for runtime usage (Phase 9
 * §40/§42). Build billing remains a completely separate flow.
 *
 * @module lib/runtime/metering
 */

export {
  resolveRuntimePrice,
  findActiveRule,
  RuntimePricingUnconfiguredError,
} from "./resolver"
export type {
  RuntimeBillingDecision,
  RuntimePricingSnapshot,
} from "./resolver"
export {
  calculateRuntimeCredits,
  validateUsage,
  estimateRequestUsage,
  estimateMinimumCredits,
  MAX_TOKENS_PER_FIELD,
  ESTIMATED_OUTPUT_TOKEN_FLOOR,
} from "./pricing"
export type { UsageEstimate } from "./pricing"
export type { RuntimeChargeCalculation, ValidatedUsage } from "./pricing"
export { chargeRuntimeUsage, refundRuntimeCharge } from "./charge"
export type { RuntimeChargeResult } from "./charge"
export {
  meterRuntimeResult,
  recordFailedRuntimeUsage,
  preflightMeteredRequest,
} from "./meter"
export type { RuntimeMeterResult, PreflightMeteringResult, ProviderCostInfo } from "./meter"
