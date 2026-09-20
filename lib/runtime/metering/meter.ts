import "server-only"
import { runtimeError } from "@/runtime/contracts/errors"
import type { AppError } from "@/lib/errors"
import { makeUsageEvent, recordUsage } from "@/lib/runtime/usage"
import { logger } from "@/lib/logging/logger"
import type { RuntimeAuthContext } from "@/runtime/contracts/auth"
import type { NormalizedProviderUsage } from "@/runtime/contracts/router"
import { resolveRuntimePrice, RuntimePricingUnconfiguredError } from "./resolver"
import type { RuntimeBillingDecision, RuntimePricingSnapshot } from "./resolver"
import { calculateRuntimeCredits, estimateRequestUsage, estimateMinimumCredits } from "./pricing"
import { chargeRuntimeUsage, refundRuntimeCharge } from "./charge"
import type { RuntimeChargeResult } from "./charge"
import type { RuntimeChargeCalculation } from "./pricing"

/**
 * Atai Runtime — usage meter (server-only, Phase 9 + 9.5).
 *
 * The central metering pipeline for every billable runtime provider
 * invocation (Phase 9 §14/§57). Exactly ONE place records usage and charges
 * credits — provider adapters stay billing-agnostic (§40/§42), the router
 * delegates here, and no other path may charge runtime credits:
 *
 *   resolveRuntimePrice()          WHAT the operation costs (9.5: rules →
 *                                  legacy fallback → DENY if unconfigured)
 *        ↓
 *   pre-provider authorization     fixed price → charge BEFORE the provider;
 *                                  zero balance → reject before the provider
 *        ↓
 *   provider execution (router)
 *        ↓
 *   calculateRuntimeCredits()      pure charge calculation
 *        ↓
 *   chargeRuntimeUsage()           authoritative charge (existing ledger) —
 *                                  already paid upfront for fixed price
 *        ↓
 *   recordUsage()                  runtime_usage audit record with the
 *                                  immutable pricing snapshot + provider cost
 *
 * Failure handling (Phase 9 §44, 9.5 §20/§58):
 *   - fixed-price charge succeeded, provider FAILED → idempotent
 *     runtime_refund back to the customer, usage recorded with the refund
 *     metadata; refund failure fails closed (503) — never silently wrong.
 *   - usage-based charge + provider failure → 0 credits, recorded for audit.
 *   - pricing unconfigured → denied BEFORE any provider spend (fail safe).
 *   - billing subsystem failure → fail closed (runtime_billing_unavailable).
 *   - usage persistence failure never fails the request — the ledger remains
 *     the financial source of truth.
 *
 * Provider cost (Phase 9.5 §23/§24/§50/§82): the adapter-normalized
 * provider-reported cost is persisted verbatim (amount/currency/source);
 * unavailable cost is recorded as explicitly unavailable — never fabricated,
 * never conflated with the customer credit charge.
 *
 * @module lib/runtime/metering/meter
 */

/** What the router receives back from metering a provider result. */
export interface RuntimeMeterResult {
  /** Credits actually charged for this billable event. */
  creditsCharged: number
  /** Ledger correlation key (also persisted on the usage record). */
  ledgerIdempotencyKey: string
  /** The immutable pricing snapshot applied to this event. */
  pricingSnapshot: RuntimePricingSnapshot
}

/** Normalized provider cost, as reported by the adapter (never fabricated). */
export interface ProviderCostInfo {
  /** Provider-reported/estimated monetary cost. Undefined = unavailable. */
  amount?: number
  /** ISO currency as reported (e.g. "USD"); undefined when cost is absent. */
  currency?: string
  /** "provider_reported" | "provider_estimated" | "unavailable". */
  source: "provider_reported" | "provider_estimated" | "unavailable"
}

/** Outcome of the pre-provider financial gate (Phase 9.5 §14 steps 6–8). */
export interface PreflightMeteringResult {
  /** Denial AppError (throw it) or null when the request may proceed. */
  denial: AppError | null
  /**
   * Fixed-price pre-charge: when set, the customer was ALREADY charged
   * before the provider call. The router MUST pass this back into
   * meterRuntimeResult / recordFailedRuntimeUsage so the same billable
   * event is finalized (not re-charged) or refunded on failure.
   */
  prepaid?: RuntimeChargeCalculation
}

/**
 * Pre-provider financial gate (Phase 9.5 §15/§19/§37 — mandatory order):
 *
 *   1. resolve pricing — unconfigured operations are DENIED here, before any
 *      provider spend (a missing configuration never silently becomes free).
 *   2. fixed price  → charge upfront via the existing ledger (idempotent).
 *   3. usage-based  → reject when the balance cannot cover a CONSERVATIVE
 *      estimate of the charge (estimated input tokens + max_tokens-bounded
 *      output, or the output floor when unbounded). The exact charge still
 *      settles post-provider from real usage; this gate prevents the worst
 *      unbilled-provider exposure — a near-zero balance triggering an
 *      arbitrarily large provider run that can only end in a post-hoc 402
 *      (Phase 9.5 audit HIGH fix: provider must not run for accounts that
 *      demonstrably cannot pay).
 *
 * Returns the prepaid calculation for fixed-price ops so the post-provider
 * path finalizes the SAME billable event instead of charging twice.
 */
export async function preflightMeteredRequest(params: {
  auth: RuntimeAuthContext & { requestId: string }
  provider: string
  capability: string
  operation: string
  /** Untrusted provider-neutral request input — used ONLY for a conservative
   * volume estimate of usage-based operations (never for pricing decisions). */
  input?: unknown
}): Promise<PreflightMeteringResult> {
  // 1. Resolve pricing (central — the only resolution path).
  let decision: RuntimeBillingDecision
  try {
    decision = await resolveRuntimePrice({
      provider: params.provider,
      capability: params.capability,
      operation: params.operation,
    })
  } catch (e) {
    if (e instanceof RuntimePricingUnconfiguredError) {
      logger.info("runtime.metering", "request denied: pricing not configured", {
        requestId: params.auth.requestId,
        userId: params.auth.userId,
        projectId: params.auth.projectId,
        apiKeyId: params.auth.apiKeyId,
        capability: params.capability,
        operation: params.operation,
        provider: params.provider,
      })
      return { denial: runtimeError("runtime_pricing_unconfigured") }
    }
    // Pricing config read failed — fail closed before provider spend.
    logger.warn("runtime.metering", "pricing resolution failed", {
      requestId: params.auth.requestId,
      message: e instanceof Error ? e.message : String(e),
    })
    return { denial: runtimeError("runtime_billing_unavailable") }
  }

  if (!decision.chargeable) {
    // Non-billable capability (router self-test) — nothing to gate.
    return { denial: null }
  }

  // 2. Fixed price → deterministic charge BEFORE the provider call.
  if (decision.snapshot.mode === "fixed_per_request") {
    const calculation = calculateRuntimeCredits({
      decision,
      provider: params.provider,
      capability: params.capability,
      operation: params.operation,
      usage: undefined,
    })
    if (calculation.credits > 0) {
      const { getAvailableCredits } = await import("@/lib/billing/credit-service")
      let available: number
      try {
        available = await getAvailableCredits(params.auth.userId)
      } catch (e) {
        logger.warn("runtime.metering", "pre-charge balance check failed", {
          requestId: params.auth.requestId,
          userId: params.auth.userId,
          message: e instanceof Error ? e.message : String(e),
        })
        return { denial: runtimeError("runtime_billing_unavailable") }
      }
      if (available < calculation.credits) {
        logger.info("runtime.metering", "request denied: insufficient credits (pre-charge)", {
          requestId: params.auth.requestId,
          userId: params.auth.userId,
          projectId: params.auth.projectId,
          apiKeyId: params.auth.apiKeyId,
          capability: params.capability,
          operation: params.operation,
          required: calculation.credits,
          available,
        })
        return { denial: runtimeError("runtime_insufficient_entitlement") }
      }
      try {
        await chargeRuntimeUsage({ auth: params.auth, calculation })
      } catch (e) {
        // 402 (raced away) / 503 (ledger failure) — nothing was billed
        // beyond this point and the provider has not been called.
        return { denial: e as AppError }
      }
      return { denial: null, prepaid: calculation }
    }
    // Explicitly free operation (credits = 0): nothing to charge.
    return { denial: null, prepaid: calculation }
  }

  // 3. Usage-based → conservative estimated-charge gate (fail closed on read
  //    failure). The estimate uses only the neutral request shape and the
  //    resolved rates — never client-supplied pricing fields.
  const { getAvailableCredits } = await import("@/lib/billing/credit-service")
  try {
    const available = await getAvailableCredits(params.auth.userId)
    const estimate = estimateRequestUsage(params.input)
    const minimumCredits = estimateMinimumCredits(decision, estimate)
    // minimumCredits === 0 → the rates themselves are zero (explicitly free
    // configuration): never balance-gate a free operation, even at balance 0.
    if (minimumCredits > 0 && available < minimumCredits) {
      logger.info("runtime.metering", "preflight rejected: balance below estimated charge", {
        requestId: params.auth.requestId,
        userId: params.auth.userId,
        projectId: params.auth.projectId,
        apiKeyId: params.auth.apiKeyId,
        capability: params.capability,
        operation: params.operation,
        available,
        estimatedMinimumCredits: minimumCredits,
      })
      return { denial: runtimeError("runtime_insufficient_entitlement") }
    }
    return { denial: null }
  } catch (e) {
    logger.warn("runtime.metering", "preflight balance check failed", {
      requestId: params.auth.requestId,
      userId: params.auth.userId,
      message: e instanceof Error ? e.message : String(e),
    })
    return { denial: runtimeError("runtime_billing_unavailable") }
  }
}

/**
 * Meter one COMPLETED provider invocation (success path).
 * When `prepaid` is supplied (fixed-price op charged pre-provider), the
 * charge is NOT repeated — the same billable event is finalized and
 * recorded; only usage-based ops charge here.
 *
 * Throws AppError (runtime_*) on: insufficient credits (402), or a billing
 * subsystem failure (503, fail closed). Usage with zero charge never throws.
 */
export async function meterRuntimeResult(params: {
  auth: RuntimeAuthContext & { requestId: string }
  provider: string
  capability: string
  operation: string
  model?: string
  usage: NormalizedProviderUsage | undefined
  providerCost?: ProviderCostInfo
  latencyMs: number
  startedAt: number
  /** Set when preflight already charged a fixed price for THIS event. */
  prepaid?: RuntimeChargeCalculation
}): Promise<RuntimeMeterResult> {
  const { auth } = params

  // PREPAID (fixed-price) fast path: the charge was ALREADY taken pre-provider
  // and the provider already ran. Pricing is NOT re-resolved here — an admin
  // deactivating a rule (or a pricing-config read failure) between preflight
  // and metering must never strand an already-paid charge behind a post-
  // provider 503 with no refund and no usage record (Phase 9.5 audit HIGH
  // fix — financial safety under admin changes §79). The event is finalized
  // under the SAME snapshot it was charged under; recordUsage never throws,
  // so this path cannot fail after the money moved.
  if (params.prepaid) {
    const calculation = params.prepaid
    const charge: RuntimeChargeResult = {
      charged: calculation.credits > 0,
      creditsCharged: calculation.credits,
      idempotencyKey: `runtime_${auth.requestId}`,
    }
    const usageEvent = makeUsageEvent({
      requestId: auth.requestId,
      userId: auth.userId,
      projectId: auth.projectId,
      apiKeyId: auth.apiKeyId,
      environment: auth.environment,
      capability: params.capability,
      operation: params.operation,
      provider: params.provider,
      ...(params.model !== undefined ? { model: params.model } : {}),
      status: "succeeded",
      latencyMs: Math.max(0, Math.round(params.latencyMs)),
      ...(sanitizeUsageRecord(params.usage) ? { usage: sanitizeUsageRecord(params.usage)! } : {}),
      costMetadata: buildCostMetadata({
        snapshot: calculation.snapshot,
        providerCost: params.providerCost,
        charge,
        prepaid: true,
      }),
      creditsCharged: charge.creditsCharged,
      createdAt: params.startedAt,
    })
    await recordUsage(usageEvent)
    return {
      creditsCharged: charge.creditsCharged,
      ledgerIdempotencyKey: charge.idempotencyKey,
      pricingSnapshot: calculation.snapshot,
    }
  }

  // Non-prepaid: resolve the pricing decision for this completed invocation.
  // Non-billable capability: record audit only, never charge.
  let decision: RuntimeBillingDecision
  try {
    decision = await resolveRuntimePrice({
      provider: params.provider,
      capability: params.capability,
      operation: params.operation,
    })
  } catch (e) {
    if (e instanceof RuntimePricingUnconfiguredError) {
      // Should be unreachable (preflight denies first) — fail closed anyway.
      throw runtimeError("runtime_pricing_unconfigured")
    }
    throw runtimeError("runtime_billing_unavailable")
  }

  if (!decision.chargeable) {
    const usageEvent = makeUsageEvent({
      requestId: auth.requestId,
      userId: auth.userId,
      projectId: auth.projectId,
      apiKeyId: auth.apiKeyId,
      environment: auth.environment,
      capability: params.capability,
      operation: params.operation,
      provider: params.provider,
      ...(params.model !== undefined ? { model: params.model } : {}),
      status: "succeeded",
      latencyMs: Math.max(0, Math.round(params.latencyMs)),
      ...(sanitizeUsageRecord(params.usage) ? { usage: sanitizeUsageRecord(params.usage)! } : {}),
      costMetadata: buildCostMetadata({
        snapshot: decision.snapshot,
        providerCost: params.providerCost,
      }),
      creditsCharged: 0,
      createdAt: params.startedAt,
    })
    await recordUsage(usageEvent)
    return { creditsCharged: 0, ledgerIdempotencyKey: "", pricingSnapshot: decision.snapshot }
  }

  // Calculate the charge. Fixed-price ops reuse the prepaid calculation —
  // the same billable event must never be priced twice (§32/§60).
  const calculation = params.prepaid
    ? params.prepaid
    : calculateRuntimeCredits({
        decision,
        provider: params.provider,
        capability: params.capability,
        operation: params.operation,
        model: params.model,
        usage: params.usage,
      })

  // Authoritative charge — skipped when preflight already charged.
  let charge: RuntimeChargeResult
  if (params.prepaid) {
    charge = {
      charged: calculation.credits > 0,
      creditsCharged: calculation.credits,
      idempotencyKey: `runtime_${auth.requestId}`,
    }
  } else {
    charge = await chargeRuntimeUsage({ auth, calculation })
  }

  const usageEvent = makeUsageEvent({
    requestId: auth.requestId,
    userId: auth.userId,
    projectId: auth.projectId,
    apiKeyId: auth.apiKeyId,
    environment: auth.environment,
    capability: params.capability,
    operation: params.operation,
    provider: params.provider,
    ...(params.model !== undefined ? { model: params.model } : {}),
    status: "succeeded",
    latencyMs: Math.max(0, Math.round(params.latencyMs)),
    ...(sanitizeUsageRecord(params.usage) ? { usage: sanitizeUsageRecord(params.usage) } : {}),
    costMetadata: buildCostMetadata({
      snapshot: calculation.snapshot,
      providerCost: params.providerCost,
      charge,
      prepaid: Boolean(params.prepaid),
    }),
    creditsCharged: charge.creditsCharged,
    createdAt: params.startedAt,
  })

  // Telemetry must not fail requests (established recordUsage contract).
  await recordUsage(usageEvent)

  return {
    creditsCharged: charge.creditsCharged,
    ledgerIdempotencyKey: charge.idempotencyKey,
    pricingSnapshot: calculation.snapshot,
  }
}

/**
 * Record a FAILED provider invocation and settle any prepaid charge.
 *
 * Fixed-price prepaid + provider failure → idempotent runtime_refund (Phase
 * 9.5 §20 Case D): the customer is not charged for provider work that never
 * happened. Refund failure throws runtime_billing_unavailable (fail closed) —
 * the router propagates that instead of the provider error so the unknown
 * financial state is never reported as a routine provider failure.
 *
 * Usage-based failures charge 0 and are recorded for operational visibility
 * (Phase 9 §16/§43). Persistence failures never mask the provider error.
 */
export async function recordFailedRuntimeUsage(params: {
  auth: RuntimeAuthContext & { requestId: string }
  provider: string
  capability: string
  operation: string
  model?: string
  errorCategory: string
  latencyMs: number
  startedAt: number
  /** Prepaid fixed-price calculation to refund (set by preflight). */
  prepaid?: RuntimeChargeCalculation
}): Promise<void> {
  // 1. Settle the prepaid charge first — financial correctness before audit.
  if (params.prepaid && params.prepaid.credits > 0) {
    await refundRuntimeCharge({
      auth: params.auth,
      calculation: params.prepaid,
      reason: "provider_failed",
    })
    // Throws (503) on refund failure — deliberate fail closed.
  }

  // 2. Persist the failed-usage audit record (best effort, never throws).
  try {
    const usageEvent = makeUsageEvent({
      requestId: params.auth.requestId,
      userId: params.auth.userId,
      projectId: params.auth.projectId,
      apiKeyId: params.auth.apiKeyId,
      environment: params.auth.environment,
      capability: params.capability,
      operation: params.operation,
      provider: params.provider,
      ...(params.model !== undefined ? { model: params.model } : {}),
      status: "failed",
      latencyMs: Math.max(0, Math.round(params.latencyMs)),
      costMetadata: {
        ...(params.prepaid
          ? {
              // Refund metadata — reconciliation can trace the round trip.
              refundedAfterPrecharge: params.prepaid.credits > 0,
              ...(params.prepaid.credits > 0
                ? {
                    refundIdempotencyKey: `runtime_${params.auth.requestId}_refund`,
                    refundReason: "provider_failed",
                  }
                : {}),
              pricingRuleId: params.prepaid.snapshot.pricingRuleId,
            }
          : {
              // No ledger entry exists for failed usage — mark that
              // explicitly so reconciliation never expects one (Phase 9 §86).
              ledgerIdempotencyKey: null,
              failedBeforeBillableUsage: true,
            }),
      },
      creditsCharged: 0,
      errorCategory: params.errorCategory,
      createdAt: params.startedAt,
    })
    await recordUsage(usageEvent)
  } catch (e) {
    // Absolute best-effort: a failure-recording failure must never mask the
    // provider error the router is about to rethrow.
    logger.warn("runtime.metering", "failed-usage recording failed", {
      requestId: params.auth.requestId,
      message: e instanceof Error ? e.message : String(e),
    })
  }
}

/**
 * Phase 10 §55: merge provider-specific usage metadata (characters, credits
 * used, message segments — safe scalars reported by the adapter) into the
 * runtime_usage record's usage object. Sanitized: scalar values only, capped
 * count, and any key that even looks credential-like is dropped (defense in
 * depth — adapters already emit safe metadata; the meter is the last gate).
 * Content payloads are never accepted.
 */
const CREDENTIAL_LIKE_KEY = /(api[_-]?key|token|secret|authorization|password|credential)/i
const MAX_USAGE_METADATA_KEYS = 20

function sanitizeUsageRecord(
  usage: NormalizedProviderUsage | undefined,
): Record<string, unknown> | undefined {
  if (!usage) return undefined
  const record: Record<string, unknown> = {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    ...(usage.totalTokens !== undefined ? { totalTokens: usage.totalTokens } : {}),
  }
  const metadata = usage.metadata
  if (metadata && typeof metadata === "object") {
    for (const [key, value] of Object.entries(metadata)) {
      if (record[key] !== undefined) continue
      if (CREDENTIAL_LIKE_KEY.test(key)) continue
      const safe =
        typeof value === "number" || typeof value === "string" || typeof value === "boolean" ? value : undefined
      if (safe === undefined) continue
      if (Object.keys(record).length >= MAX_USAGE_METADATA_KEYS) break
      record[key] = safe
    }
  }
  return record
}

/** Build the immutable costMetadata persisted on every usage record. */
function buildCostMetadata(args: {
  snapshot: RuntimePricingSnapshot
  providerCost?: ProviderCostInfo
  charge?: RuntimeChargeResult
  prepaid?: boolean
}): Record<string, unknown> {
  const { snapshot, providerCost, charge, prepaid } = args
  return {
    pricingVersion: snapshot.pricingVersion,
    ...(snapshot.pricingRuleId !== undefined ? { pricingRuleId: snapshot.pricingRuleId } : {}),
    pricingSource: snapshot.pricingSource,
    ...(snapshot.mode !== undefined ? { pricingMode: snapshot.mode } : {}),
    ...(snapshot.credits !== undefined ? { pricingCredits: snapshot.credits } : {}),
    ...(snapshot.inputPer1k !== undefined ? { pricingInputPer1k: snapshot.inputPer1k } : {}),
    ...(snapshot.outputPer1k !== undefined ? { pricingOutputPer1k: snapshot.outputPer1k } : {}),
    // Billable-event identity (Phase 9 §7): requestId today — see charge.ts.
    ...(charge !== undefined
      ? {
          ledgerIdempotencyKey: charge.idempotencyKey,
          billableEventKey: charge.idempotencyKey,
          ...(prepaid ? { chargedBeforeProvider: true } : {}),
        }
      : {}),
    // Provider cost (Phase 9.5 §23/§82): verbatim, distinguishable from the
    // customer charge; unavailable stays explicitly unavailable, never 0.
    ...(providerCost !== undefined
      ? {
          providerCost:
            providerCost.source === "unavailable" || providerCost.amount === undefined
              ? null
              : providerCost.amount,
          providerCostCurrency: providerCost.currency ?? null,
          providerCostSource: providerCost.source,
        }
      : {}),
  }
}
