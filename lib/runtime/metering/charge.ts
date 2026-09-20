import "server-only"
import { runtimeError } from "@/runtime/contracts/errors"
import { runtimeUsageIdempotencyKey } from "@/runtime/contracts/billing"
import { consumeCredits } from "@/lib/billing/credit-service"
import { logger } from "@/lib/logging/logger"
import type { RuntimeAuthContext } from "@/runtime/contracts/auth"
import type { RuntimeChargeCalculation } from "./pricing"

/**
 * Atai Runtime — charge service (server-only).
 *
 * The ONE authoritative path that turns a calculated runtime charge into a
 * customer credit mutation on the EXISTING Atai credit system (Phase 9 §8/§42).
 * No second balance, no second ledger, no per-adapter charging:
 *
 *   calculateRuntimeCredits()   (pricing.ts — pure calculation)
 *        ↓
 *   chargeRuntimeUsage()        (THIS module — the only mutation point)
 *        ↓
 *   consumeCredits()            (lib/billing/credit-service — atomic debit,
 *                                subscription-first consumption, unique
 *                                idempotencyKey in the shared credit_ledger)
 *
 * Idempotency (Phase 9 §20/§21/§131): the ledger enforces a UNIQUE
 * idempotencyKey. The runtime charge key is `runtime_<requestId>` (Phase 2
 * helper runtimeUsageIdempotencyKey). Today one runtime request = one billable
 * provider invocation, so the requestId IS the billable call identity; if the
 * runtime later fans a request out to multiple provider calls, the call
 * identity must be extended BEFORE any second charge is introduced. The same
 * billable event charged twice (retry, network replay, crash recovery) maps
 * to the same ledger key → one effective charge; two genuinely independent
 * requests carry different requestIds → two charges.
 *
 * Failure semantics (Phase 9 §44/§128/§129): a FAILED charge (DB error —
 * distinct from insufficient credits) throws runtime_billing_unavailable so
 * the router fails CLOSED. An unknown financial state is never reported as a
 * successful, unbilled request.
 *
 * @module lib/runtime/metering/charge
 */

/** Result of an authoritative runtime charge. */
export interface RuntimeChargeResult {
  /** Whether the charge was applied (or already applied — idempotent replay). */
  charged: boolean
  /** Credits reserved by this billable event (0 when nothing was charged). */
  creditsCharged: number
  /** Ledger idempotency key correlating usage record ↔ credit_ledger (§23). */
  idempotencyKey: string
}

/**
 * Charge an already-calculated runtime charge against the customer's
 * existing credit balance.
 *
 * Insufficient credits → throws runtime_insufficient_entitlement (402) after
 * checking nothing was mutated (consumeCredits is transactional).
 * Ledger failure      → throws runtime_billing_unavailable (503) — fail closed.
 */
export async function chargeRuntimeUsage(params: {
  auth: RuntimeAuthContext & { requestId: string }
  calculation: RuntimeChargeCalculation
}): Promise<RuntimeChargeResult> {
  const idempotencyKey = runtimeUsageIdempotencyKey(params.auth.requestId)

  if (params.calculation.credits < 0 || !Number.isInteger(params.calculation.credits)) {
    // Defensive: the calculator already guarantees this. Never persist a
    // negative/invalid charge (Phase 9 §50/§52).
    throw runtimeError("runtime_billing_unavailable")
  }

  if (params.calculation.credits === 0) {
    // Zero-cost usage (free capability, zero pricing, empty usage): nothing
    // to debit and no debit ledger entry is written (a zero-amount debit
    // entry would pollute the ledger). The usage record is still persisted
    // by the meter for auditability (Phase 9 §49).
    return { charged: false, creditsCharged: 0, idempotencyKey }
  }

  let result: Awaited<ReturnType<typeof consumeCredits>>
  try {
    result = await consumeCredits({
      userId: params.auth.userId,
      amount: params.calculation.credits,
      transactionType: "runtime_usage",
      idempotencyKey,
      referenceType: "runtime_request",
      referenceId: params.auth.requestId,
      metadata: {
        // Safe audit metadata only — no credentials, no request content.
        projectId: params.auth.projectId,
        apiKeyId: params.auth.apiKeyId,
        environment: params.auth.environment,
        capability: params.calculation.pricingRule.capability,
        operation: params.calculation.pricingRule.operation,
        provider: params.calculation.pricingRule.provider,
        ...(params.calculation.pricingRule.model !== undefined
          ? { model: params.calculation.pricingRule.model }
          : {}),
        // Phase 9.5 pricing snapshot — explains the charge even after the
        // admin later changes pricing (historical integrity §12/§41).
        pricingVersion: params.calculation.snapshot.pricingVersion,
        ...(params.calculation.snapshot.pricingRuleId !== undefined
          ? { pricingRuleId: params.calculation.snapshot.pricingRuleId }
          : {}),
        pricingSource: params.calculation.snapshot.pricingSource,
        ...(params.calculation.snapshot.mode !== undefined
          ? { pricingMode: params.calculation.snapshot.mode }
          : {}),
        usage: {
          inputTokens: params.calculation.pricingRule.inputTokens,
          outputTokens: params.calculation.pricingRule.outputTokens,
        },
      },
    })
  } catch (e) {
    // Ledger/db failure — the financial state is unknown, so fail CLOSED
    // (Phase 9 §128/§129): the request must not be reported as a successful,
    // unbilled one. The router turns this into a 503 for the caller.
    logger.error("runtime.metering", "runtime charge failed at ledger level", {
      requestId: params.auth.requestId,
      userId: params.auth.userId,
      message: e instanceof Error ? e.message : String(e),
    })
    throw runtimeError("runtime_billing_unavailable")
  }

  if (!result.success) {
    // Distinguish the two failure modes consumeCredits returns:
    //   - user missing / insufficient balance  → 402 (safe to surface)
    //   - any other non-success (rare races)   → fail closed (503)
    // The pre-charge gate in the router prevents most 402s before the
    // provider call; this is the authoritative backstop.
    logger.info("runtime.metering", "runtime charge not applied", {
      requestId: params.auth.requestId,
      userId: params.auth.userId,
      projectId: params.auth.projectId,
      apiKeyId: params.auth.apiKeyId,
      requested: params.calculation.credits,
    })
    throw runtimeError("runtime_insufficient_entitlement")
  }

  logger.info("runtime.metering", "runtime usage charged", {
    requestId: params.auth.requestId,
    userId: params.auth.userId,
    projectId: params.auth.projectId,
    apiKeyId: params.auth.apiKeyId,
    environment: params.auth.environment,
    capability: params.calculation.pricingRule.capability,
    provider: params.calculation.pricingRule.provider,
    creditsCharged: params.calculation.credits,
    subscriptionConsumed: result.subscriptionConsumed,
    permanentConsumed: result.permanentConsumed,
  })

  return { charged: true, creditsCharged: params.calculation.credits, idempotencyKey }
}

/**
 * Refund a PREVIOUSLY CHARGED fixed-price runtime charge because the provider
 * failed after the charge (Phase 9.5 §20/§58). Uses the existing ledger via
 * grantCredits with the `runtime_refund` transaction type and a stable refund
 * idempotency key — the refund is itself idempotent, so a retried failure
 * path can never double-refund (§60).
 *
 * Never called for usage-based charges (those happen post-provider). A failed
 * refund is logged and surfaced as a billing failure (fail closed) — the
 * financial state must not be silently wrong.
 */
export async function refundRuntimeCharge(params: {
  auth: RuntimeAuthContext & { requestId: string }
  calculation: RuntimeChargeCalculation
  /** Why the refund happened (safe constant, e.g. "provider_failed"). */
  reason: string
}): Promise<{ refunded: boolean; idempotencyKey: string }> {
  const chargeKey = runtimeUsageIdempotencyKey(params.auth.requestId)
  const refundKey = `${chargeKey}_refund`

  if (params.calculation.credits <= 0) {
    return { refunded: false, idempotencyKey: refundKey }
  }

  try {
    const { grantCredits } = await import("@/lib/billing/credit-service")
    const result = await grantCredits({
      userId: params.auth.userId,
      creditType: "permanent",
      amount: params.calculation.credits,
      transactionType: "runtime_refund",
      idempotencyKey: refundKey,
      referenceType: "runtime_request",
      referenceId: params.auth.requestId,
      metadata: {
        reason: params.reason,
        projectId: params.auth.projectId,
        apiKeyId: params.auth.apiKeyId,
        environment: params.auth.environment,
        capability: params.calculation.pricingRule.capability,
        operation: params.calculation.pricingRule.operation,
        provider: params.calculation.pricingRule.provider,
        ...(params.calculation.snapshot.pricingRuleId !== undefined
          ? { pricingRuleId: params.calculation.snapshot.pricingRuleId }
          : {}),
        originalChargeKey: chargeKey,
      },
    })
    if (!result.success) {
      logger.error("runtime.metering", "runtime refund did not apply", {
        requestId: params.auth.requestId,
        userId: params.auth.userId,
        refundKey,
      })
      throw runtimeError("runtime_billing_unavailable")
    }
    logger.info("runtime.metering", "runtime charge refunded", {
      requestId: params.auth.requestId,
      userId: params.auth.userId,
      projectId: params.auth.projectId,
      apiKeyId: params.auth.apiKeyId,
      creditsRefunded: params.calculation.credits,
      reason: params.reason,
    })
    return { refunded: true, idempotencyKey: refundKey }
  } catch (e) {
    if (e instanceof Error && e.name === "AppError") throw e
    logger.error("runtime.metering", "runtime refund failed at ledger level", {
      requestId: params.auth.requestId,
      userId: params.auth.userId,
      message: e instanceof Error ? e.message : String(e),
    })
    throw runtimeError("runtime_billing_unavailable")
  }
}
