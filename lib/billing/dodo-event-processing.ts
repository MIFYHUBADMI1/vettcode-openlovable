import { ObjectId } from "mongodb"
import { paymentRecordsCol, subscriptionRecordsCol, creditLedgerCol } from "@/lib/db/collections"
import {
  grantCredits,
  grantSubscriptionCredits,
  expireSubscriptionCredits,
  reverseCredits,
} from "@/lib/billing/credit-service"
import { SUBSCRIPTION_PLANS } from "@/lib/billing/config"
import { activatePaidSubscription } from "@/lib/billing/activate-subscription"
import { logger } from "@/lib/logging/logger"
import { cryptoId } from "@/lib/store/id"
import type { PaymentRecord, SubscriptionRecord } from "@/lib/billing/billing-types"
import type { SubscriptionStatus, PaymentStatus } from "@/lib/billing/config"

/**
 * Atai Finance — Phase 3 authoritative Dodo event processing (Workstream A/B).
 *
 * This module is the SINGLE business-logic path for every Dodo webhook effect.
 * Both the live webhook route (`app/api/billing/webhook/route.ts`) and the
 * recovery worker (`lib/billing/webhook-recovery.ts`) call `processDodoEvent`,
 * so a replayed event always runs the same financial invariants as a live
 * delivery — never a separate, weaker code path.
 *
 * ── Financial lifecycle (documented per brief §3A) ──────────────────────
 *
 * payment.succeeded (pack)     → ledger grant `payment_${paymentId}`
 *                                 (permanent credits) + payment_records row
 *                                 status "succeeded". Unattributable (no
 *                                 trusted userId / no positive integer
 *                                 credits) → "unresolved": NO grant, NO guess.
 * payment.succeeded (sub)      → payment record only; credits belong to the
 *                                 subscription events (period-keyed grant).
 * payment.failed / cancelled   → payment record with provider status; never
 *                                 treated as revenue or a purchase; renewal
 *                                 failure flips the subscription to past_due
 *                                 (credits kept; Dodo retries).
 * subscription.active/renewed  → activate / expire-then-grant keyed
 *                                 `sub_grant_${subscriptionId}_period_${day}`
 *                                 — the SAME key across active & renewed for
 *                                 one cycle, so a duplicate billing period
 *                                 event can never grant twice.
 * subscription.cancelled/…     → status transitions only (no credit change;
 *                                 credits remain until natural expiry).
 * refund.succeeded             → refund row is a SEPARATE payment_records row
 *                                 (never overwrites the original payment);
 *                                 credit reversal keyed `refund_${refundId}`;
 *                                 original payment's refundedAmountMinor/status
 *                                 advanced; unassociable or currency-mismatched
 *                                 refunds go "unresolved" for reconciliation.
 * refund.failed / disputes / credit.* → logged; no financial effect (Dodo-side
 *                                 accounting objects, not Atai balances).
 *
 * ── Invariants enforced by this module ──────────────────────────────────
 *
 *  1. One successful payment grants its credits at most once (unique ledger
 *     idempotencyKey; duplicates return success=true = already-applied).
 *  2. One subscription billing period grants at most once (period key).
 *  3. A failed payment is never recorded as succeeded and grants nothing.
 *  4. A refund is a new traceable row — the original payment record is never
 *     silently overwritten as if it never occurred.
 *  5. Duplicate webhook deliveries are blocked upstream by the unique
 *     webhookId index AND remain harmless here because every effect is
 *     idempotency-keyed (crash-after-write replays are no-ops).
 *  6. A persistence failure THROWS so the caller marks the event `failed` —
 *     a successful HTTP ack never implies the financial effects completed;
 *     failed events stay discoverable for the recovery workflow.
 *  7. Missing authoritative data (user, payment link, amount, currency) →
 *     explicit "unresolved"; nothing is guessed or fabricated as 0.
 *
 * Event semantics are unchanged from the Phase 1/2 live behavior except where
 * Phase 3 §4 explicitly corrected refund accounting (documented inline).
 *
 * @module lib/billing/dodo-event-processing
 */

export type DodoEventOutcome = { status: "processed" } | { status: "unresolved"; reason: string }

/** Event types whose handlers have (or may have) financial effect and can be
 * SAFELY re-run through this module by the recovery worker. Unknown/dispute/
 * informational types are never replayed — there is nothing to recompute. */
export const REPROCESSABLE_EVENT_TYPES: ReadonlySet<string> = new Set([
  "payment.succeeded",
  "payment.failed",
  "payment.cancelled",
  "subscription.active",
  "subscription.renewed",
  "subscription.cancelled",
  "subscription.past_due",
  "subscription.on_hold",
  "subscription.expired",
  "subscription.updated",
  "subscription.plan_changed",
  "refund.succeeded",
])

/**
 * Process one Dodo event. Returns "processed" or "unresolved" (with a safe,
 * secret-free reason). THROWS when a required financial write failed — the
 * caller must then mark the event `failed` so recovery can find it.
 */
export async function processDodoEvent(
  eventType: string,
  data: Record<string, unknown> | undefined,
  eventId: string,
): Promise<DodoEventOutcome> {
  switch (eventType) {
    case "payment.succeeded": {
      const reason = await handlePaymentSucceeded(data, eventId)
      return reason ? { status: "unresolved", reason } : { status: "processed" }
    }
    case "payment.failed":
      await handlePaymentFailed(data)
      return { status: "processed" }
    case "payment.processing":
      logger.info("webhook.dodo", "Payment processing", { eventId })
      return { status: "processed" }
    case "payment.cancelled":
      await handlePaymentCancelled(data)
      return { status: "processed" }
    case "subscription.active": {
      const reason = await handleSubscriptionActive(data)
      return reason ? { status: "unresolved", reason } : { status: "processed" }
    }
    case "subscription.renewed": {
      const reason = await handleSubscriptionRenewed(data)
      return reason ? { status: "unresolved", reason } : { status: "processed" }
    }
    case "subscription.cancelled":
      await handleSubscriptionCancelled(data)
      return { status: "processed" }
    case "subscription.past_due":
      await handleSubscriptionPastDue(data)
      return { status: "processed" }
    case "subscription.on_hold":
      await handleSubscriptionOnHold(data)
      return { status: "processed" }
    case "subscription.expired":
      await handleSubscriptionExpired(data)
      return { status: "processed" }
    case "subscription.updated":
      await handleSubscriptionUpdated(data)
      return { status: "processed" }
    case "subscription.plan_changed":
      await handleSubscriptionPlanChanged(data)
      return { status: "processed" }
    case "refund.succeeded": {
      const reason = await handleRefundSucceeded(data)
      return reason ? { status: "unresolved", reason } : { status: "processed" }
    }
    case "refund.failed":
      logger.warn("webhook.dodo", "Refund failed", { eventId })
      return { status: "processed" }
    case "dispute.opened":
    case "dispute.accepted":
    case "dispute.challenged":
    case "dispute.won":
    case "dispute.lost":
    case "dispute.expired":
    case "dispute.cancelled":
      logger.info("webhook.dodo", `Dispute event: ${eventType}`, { eventId })
      return { status: "processed" }
    case "credit.added":
    case "credit.deducted":
    case "credit.expired":
    case "credit.rolled_over":
      logger.info("webhook.dodo", `Credit event: ${eventType}`, { eventId })
      return { status: "processed" }
    default:
      logger.info("webhook.dodo", `Unhandled event type: ${eventType}`, { eventId })
      return { status: "processed" }
  }
}

// ─── Payment Handlers ──────────────────────────────────────────────────────────

/**
 * metadata.credits arrives from the checkout session as a STRING (the checkout
 * route writes String(pack.credits)) — Phase 3 validates it into a positive
 * integer before any grant. An unparseable/non-positive amount is a missing
 * authoritative fact → unresolved, never a guessed grant.
 */
function positiveIntegerCredits(raw: unknown): number | undefined {
  const n = typeof raw === "number" ? raw : Number(raw)
  if (!Number.isInteger(n) || n <= 0) return undefined
  return n
}

/**
 * Returns a safe unresolved-reason string when the verified event could not
 * be attributed to a user/payment (credits are NOT granted, nothing is
 * guessed), or `undefined` when the event was fully handled.
 */
async function handlePaymentSucceeded(
  data: Record<string, unknown> | undefined,
  _eventId: string,
): Promise<string | undefined> {
  if (!data) {
    logger.warn("webhook.dodo", "payment.succeeded: missing data")
    return "payment.succeeded payload contained no data object; nothing to attribute"
  }

  const paymentId = data.payment_id as string
  const customer = data.customer as Record<string, unknown> | undefined
  const customerId = customer?.customer_id as string
  const metadata = data.metadata as Record<string, unknown> | undefined
  const subscriptionId = data.subscription_id as string | null
  const totalAmount = data.total_amount as number | undefined
  const currency = data.currency as string | undefined

  if (subscriptionId) {
    logger.info("webhook.dodo", "Subscription payment — credits handled by subscription events", { paymentId, subscriptionId })
    await recordPayment({
      userId: metadata?.userId as string,
      dodoPaymentId: paymentId,
      dodoCustomerId: customerId,
      amount: totalAmount,
      currency,
      status: "succeeded",
      paymentType: "subscription",
      subscriptionId,
      productId: data.product_id as string,
      createdAt: Date.now(),
    })
    return undefined
  }

  const userId = metadata?.userId as string | undefined
  const packageId = metadata?.packageId as string | undefined

  if (!userId) {
    logger.warn("webhook.dodo", "payment.succeeded: missing userId", { paymentId })
    return "payment.succeeded could not be attributed (no trusted userId in metadata); preserved for reconciliation, no credits granted"
  }

  const credits = positiveIntegerCredits(metadata?.credits)
  if (credits === undefined) {
    logger.warn("webhook.dodo", "payment.succeeded: missing or non-numeric credits", { paymentId })
    return "payment.succeeded carried no authoritative positive-integer credits amount; preserved for reconciliation, no credits granted"
  }

  const result = await grantCredits({
    userId,
    creditType: "permanent",
    amount: credits,
    transactionType: "credit_purchase",
    idempotencyKey: `payment_${paymentId}`,
    referenceType: "payment",
    referenceId: paymentId,
    metadata: { packageId, dodoPaymentId: paymentId, dodoCustomerId: customerId, totalAmount, currency },
  })

  if (!result.success) {
    // A failed grant must not be reported as a completed event. The ledger
    // idempotency key makes a later replay safe (no double grant).
    throw new Error(`payment.succeeded: credit grant failed for payment ${paymentId}`)
  }

  await recordPayment({
    userId,
    dodoPaymentId: paymentId,
    dodoCustomerId: customerId,
    amount: totalAmount,
    currency,
    status: "succeeded",
    paymentType: "permanent_credit_pack",
    creditsGranted: credits,
    creditType: "permanent",
    packageId,
    createdAt: Date.now(),
  })
  logger.info("webhook.dodo", "Permanent credits granted", { paymentId, userId, credits })
  return undefined
}

async function handlePaymentFailed(data: Record<string, unknown> | undefined) {
  if (!data) return
  const paymentId = data.payment_id as string
  const subscriptionId = data.subscription_id as string | null
  const metadata = data.metadata as Record<string, unknown> | undefined
  const userId = metadata?.userId as string | undefined

  // Preserve authoritative provider information where Dodo provides it.
  // Unknown amounts/currencies are recorded as absent — never fabricated
  // as a confirmed $0 USD payment.
  const totalAmount = data.total_amount as number | undefined
  const currency = data.currency as string | undefined

  await recordPayment({
    dodoPaymentId: paymentId,
    amount: totalAmount,
    currency,
    status: "failed",
    paymentType: subscriptionId ? "subscription" : "unknown",
    createdAt: Date.now(),
  })

  if (subscriptionId) {
    const subCol = await subscriptionRecordsCol()
    await subCol.updateOne(
      { dodoSubscriptionId: subscriptionId },
      { $set: { status: "past_due", updatedAt: Date.now() } },
    )
    logger.warn("webhook.dodo", "Subscription renewal payment failed — marked past_due, credits kept, Dodo will retry", {
      paymentId, subscriptionId, userId,
    })
  } else {
    logger.warn("webhook.dodo", "Payment failed", { paymentId, userId })
  }
}

async function handlePaymentCancelled(data: Record<string, unknown> | undefined) {
  if (!data) return
  const paymentId = data.payment_id as string
  await recordPayment({
    dodoPaymentId: paymentId,
    amount: data.total_amount as number | undefined,
    currency: data.currency as string | undefined,
    status: "cancelled",
    paymentType: "unknown",
    createdAt: Date.now(),
  })
  logger.info("webhook.dodo", "Payment cancelled", { paymentId })
}

// ─── Subscription Handlers ─────────────────────────────────────────────────────

async function handleSubscriptionActive(data: Record<string, unknown> | undefined): Promise<string | undefined> {
  if (!data) { logger.warn("webhook.dodo", "subscription.active: missing data"); return "subscription.active payload contained no data object; nothing to attribute" }

  const subscriptionId = data.subscription_id as string
  const customer = data.customer as Record<string, unknown> | undefined
  const result = await activatePaidSubscription({
    subscriptionId,
    customerId: customer?.customer_id as string | undefined,
    productId: data.product_id as string | undefined,
    status: data.status as string | undefined,
    metadata: data.metadata as Record<string, unknown> | undefined,
    nextBillingDate: data.next_billing_date as string | undefined,
  })
  if (!result.ok) {
    logger.warn("webhook.dodo", "subscription.active: could not record", { subscriptionId, reason: result.reason })
    return `subscription.active could not be attributed: ${result.reason}; preserved for reconciliation, no credits granted`
  }
  return undefined
}

async function handleSubscriptionRenewed(data: Record<string, unknown> | undefined): Promise<string | undefined> {
  if (!data) { logger.warn("webhook.dodo", "subscription.renewed: missing data"); return "subscription.renewed payload contained no data object; nothing to attribute" }

  const subscriptionId = data.subscription_id as string
  const metadata = data.metadata as Record<string, unknown> | undefined
  const nextBillingDate = data.next_billing_date as string

  const userId = metadata?.userId as string | undefined
  const planId = metadata?.planId as string | undefined
  const plan = planId ? SUBSCRIPTION_PLANS.find((p) => p.id === planId) : undefined
  const credits = plan?.mirrorCredits ?? positiveIntegerCredits(metadata?.credits) ?? 0

  if (!userId || !credits) {
    logger.warn("webhook.dodo", "subscription.renewed: missing userId or credits", { subscriptionId })
    return "subscription.renewed could not be attributed (no trusted userId/credits); preserved for reconciliation, no credits granted"
  }

  const now = Date.now()
  const periodEnd = nextBillingDate ? new Date(nextBillingDate).getTime() : now + 30 * 24 * 60 * 60 * 1000

  // ── Idempotency: skip if this subscription+period already granted ──
  const grantKey = `sub_grant_${subscriptionId}_period_${Math.floor(periodEnd / 86400000)}`
  const ledger = await creditLedgerCol()
  const alreadyGranted = await ledger.findOne({ idempotencyKey: grantKey })
  if (alreadyGranted) {
    logger.info("webhook.dodo", "subscription.renewed: duplicate — grant already exists, skipping", { subscriptionId, grantKey })
    return undefined
  }

  logger.info("webhook.dodo", "subscription.renewed: processing genuine renewal", { subscriptionId, userId, planId, credits })

  // ── Expire only THIS subscription's bucket (not credits from other plans) ──
  await expireSubscriptionCredits({
    userId,
    subscriptionId,
    periodStart: now,
    metadata: { event: "renewal", planId },
  })

  // ── Grant fresh credits for the new period ──
  const granted = await grantSubscriptionCredits({
    userId, amount: credits, subscriptionId,
    planId: planId ?? "unknown", periodStart: now, periodEnd,
    metadata: { event: "renewal", dodoCustomerId: metadata?.customerId as string },
  })

  if (granted) {
    const subCol = await subscriptionRecordsCol()
    await subCol.updateOne(
      { dodoSubscriptionId: subscriptionId },
      { $set: { status: "active", currentPeriodStart: now, currentPeriodEnd: periodEnd, nextBillingDate: nextBillingDate ? new Date(nextBillingDate).getTime() : undefined, updatedAt: now } },
    )
    logger.info("webhook.dodo", "subscription.renewed: renewal credits granted", { subscriptionId, userId, credits, planId })
  }
  return undefined
}

async function handleSubscriptionCancelled(data: Record<string, unknown> | undefined) {
  if (!data) return
  const subscriptionId = data.subscription_id as string
  const metadata = data.metadata as Record<string, unknown> | undefined
  const userId = metadata?.userId as string | undefined
  const cancelledAt = data.cancelled_at as string | undefined

  const subCol = await subscriptionRecordsCol()
  await subCol.updateOne(
    { dodoSubscriptionId: subscriptionId },
    { $set: { status: "cancelled", cancelledAt: cancelledAt ? new Date(cancelledAt).getTime() : Date.now(), cancelAtPeriodEnd: true, updatedAt: Date.now() } },
  )
  logger.info("webhook.dodo", "Subscription cancelled (credits remain until period ends)", { subscriptionId, userId, cancelledAt })
}

async function handleSubscriptionPastDue(data: Record<string, unknown> | undefined) {
  if (!data) return
  const subscriptionId = data.subscription_id as string
  const subCol = await subscriptionRecordsCol()
  await subCol.updateOne({ dodoSubscriptionId: subscriptionId }, { $set: { status: "past_due", updatedAt: Date.now() } })
  logger.warn("webhook.dodo", "Subscription past due", { subscriptionId })
}

async function handleSubscriptionOnHold(data: Record<string, unknown> | undefined) {
  if (!data) return
  const subscriptionId = data.subscription_id as string
  const subCol = await subscriptionRecordsCol()
  await subCol.updateOne({ dodoSubscriptionId: subscriptionId }, { $set: { status: "paused", updatedAt: Date.now() } })
  logger.warn("webhook.dodo", "Subscription on hold", { subscriptionId })
}

async function handleSubscriptionExpired(data: Record<string, unknown> | undefined) {
  if (!data) return
  const subscriptionId = data.subscription_id as string
  const metadata = data.metadata as Record<string, unknown> | undefined
  const userId = metadata?.userId as string | undefined

  if (userId) {
    await expireSubscriptionCredits({ userId, subscriptionId, metadata: { event: "expiration" } })
  }

  const subCol = await subscriptionRecordsCol()
  await subCol.updateOne({ dodoSubscriptionId: subscriptionId }, { $set: { status: "expired", expiredAt: Date.now(), updatedAt: Date.now() } })
  logger.info("webhook.dodo", "Subscription expired", { subscriptionId, userId })
}

async function handleSubscriptionUpdated(data: Record<string, unknown> | undefined) {
  if (!data) return
  const subscriptionId = data.subscription_id as string
  const status = data.status as string
  const statusMap: Record<string, string> = { active: "active", cancelled: "cancelled", past_due: "past_due", paused: "paused", expired: "expired" }
  const subCol = await subscriptionRecordsCol()
  await subCol.updateOne({ dodoSubscriptionId: subscriptionId }, { $set: { status: (statusMap[status] ?? status) as never, updatedAt: Date.now() } })
  logger.info("webhook.dodo", "Subscription updated", { subscriptionId, status })
}

async function handleSubscriptionPlanChanged(data: Record<string, unknown> | undefined) {
  if (!data) return
  const subscriptionId = data.subscription_id as string
  const productId = data.product_id as string
  const newPlan = SUBSCRIPTION_PLANS.find((p) => p.dodoProductId === productId)
  if (newPlan) {
    const subCol = await subscriptionRecordsCol()
    await subCol.updateOne(
      { dodoSubscriptionId: subscriptionId },
      { $set: { planId: newPlan.id, planName: newPlan.name, priceUSD: newPlan.priceUSD, mirrorCredits: newPlan.mirrorCredits, updatedAt: Date.now() } },
    )
  }
  logger.info("webhook.dodo", "Subscription plan changed", { subscriptionId, productId })
}

// ─── Refund Handler (Phase 3 §4 corrected accounting) ─────────────────────────

/**
 * refund.succeeded accounting rules:
 *
 *  - The refund is a NEW payment_records row (`paymentType: "refund"`,
 *    negative amount preserved from Dodo, `dodoPaymentId = refund_id` under
 *    the unique index, `originalPaymentId` link). The original successful
 *    payment row is NEVER overwritten as if it never happened.
 *  - Credit reversal is keyed on the stable Dodo refund id
 *    (`refund_${refundId}`) with transactionType "refund_reversal" — the
 *    honest enum for a payment refund clawback. (Phase 3 correction: the old
 *    code mislabeled Dodo refunds as "build_refund", the build-release type.)
 *  - Partial refunds: when the original payment's amount and the refund's
 *    amount/currency are both authoritative, only the PROPORTIONAL share of
 *    granted credits is reversed; the original row accumulates
 *    refundedAmountMinor and moves succeeded → partially_refunded → refunded.
 *    Amounts are never converted across currencies.
 *  - Unattributable refunds (no matching original payment — including a
 *    refund event that arrives before its payment — or currency mismatch)
 *    return an unresolved reason: the event stays discoverable and the
 *    recovery worker can re-run it once the missing record lands. Reversal
 *    FAILURE (e.g. clawback hit an empty balance) THROWS → status failed →
 *    recoverable discrepancy, never a silently "processed" refund.
 */
async function handleRefundSucceeded(data: Record<string, unknown> | undefined): Promise<string | undefined> {
  if (!data) { logger.warn("webhook.dodo", "refund.succeeded: missing data"); return "refund.succeeded payload contained no data object; nothing to attribute" }

  const refundId = data.refund_id as string
  const paymentId = data.payment_id as string
  const refundAmount = typeof data.amount === "number" ? data.amount : undefined
  const refundCurrency = typeof data.currency === "string" ? data.currency.toUpperCase() : undefined

  if (!refundId || !paymentId) {
    return "refund.succeeded carried no authoritative refund_id/payment_id pair; preserved for reconciliation, nothing reversed"
  }

  const payCol = await paymentRecordsCol()
  const originalPayment = await payCol.findOne({ dodoPaymentId: paymentId })
  if (!originalPayment?.userId) {
    // Includes the refund-before-payment ordering case: recovery re-runs this
    // event once the payment row exists (the reversal key makes that replay
    // idempotent).
    logger.warn("webhook.dodo", "Refund: no matching payment found", { refundId, paymentId })
    return `refund.succeeded has no matching original payment record (${paymentId}); preserved for recovery — reversal skipped, nothing fabricated`
  }

  if (refundCurrency && originalPayment.currency && refundCurrency !== originalPayment.currency.toUpperCase()) {
    logger.warn("webhook.dodo", "Refund: currency mismatch", { refundId, refundCurrency, paymentCurrency: originalPayment.currency })
    return `refund.succeeded currency (${refundCurrency}) does not match the original payment (${originalPayment.currency}); no FX source exists, preserved for manual reconciliation`
  }

  // Stable per-refund dedupe (unique dodoPaymentId index namespace shared by
  // payments and refunds — Dodo ids do not collide across object types).
  // Everything below runs ONLY when the refund row does not exist yet, so a
  // recovery replay after a mid-flow crash can never double-increment the
  // original payment's refunded progress or double-reverse credits (the
  // ledger key guards the reversal itself; the refund row guards this block).
  const existingRefund = await payCol.findOne({ dodoPaymentId: refundId })

  const creditsGranted = originalPayment.creditsGranted ?? 0

  if (existingRefund) {
    logger.info("webhook.dodo", "Refund already processed", { refundId })
    return undefined
  }

  if (creditsGranted > 0) {
    // Proportional reversal only when both amounts are authoritative and
    // in the same currency; otherwise reverse the full grant (the refund
    // event is Dodo's own confirmation; a partial refund WITHOUT a known
    // original amount must not guess a ratio — the full reversal is the
    // previously agreed policy and is labeled in the ledger metadata).
    const originalAmount = originalPayment.amount
    const isPartial =
      typeof originalAmount === "number" && originalAmount > 0 &&
      typeof refundAmount === "number" && refundAmount > 0 &&
      refundAmount < originalAmount
    const creditsToReverse = isPartial
      ? Math.max(1, Math.floor((creditsGranted * refundAmount) / originalAmount))
      : creditsGranted

    const result = await reverseCredits({
      userId: originalPayment.userId,
      creditType: originalPayment.creditType ?? "permanent",
      amount: creditsToReverse,
      transactionType: "refund_reversal",
      idempotencyKey: `refund_${refundId}`,
      referenceType: "refund",
      referenceId: refundId,
      metadata: {
        originalPaymentId: paymentId,
        refundAmount: refundAmount ?? null,
        currency: refundCurrency ?? originalPayment.currency ?? null,
        creditsReversed: creditsToReverse,
        partialRefund: isPartial,
      },
    })

    if (!result.success) {
      throw new Error(`refund.succeeded: credit reversal failed for refund ${refundId}`)
    }
  } else {
    logger.warn("webhook.dodo", "Refund: original payment granted no credits — nothing to reverse", { refundId, paymentId })
  }

  await recordPayment({
    userId: originalPayment.userId,
    dodoPaymentId: refundId,
    amount: typeof refundAmount === "number" ? -refundAmount : undefined,
    currency: refundCurrency ?? originalPayment.currency,
    status: "refunded",
    paymentType: "refund",
    creditsGranted: creditsGranted > 0 ? -creditsGranted : undefined,
    originalPaymentId: paymentId,
    refundId,
    createdAt: Date.now(),
  })

  // Advance the ORIGINAL payment row: cumulative refunded amount (only when
  // authoritative) + lifecycle status. This is a state transition on the
  // payment's own record — the original amount and credit history
  // (createdAt, creditsGranted, succeeded→refunded trail) is preserved.
  if (typeof refundAmount === "number" && refundAmount > 0) {
    const total = typeof originalPayment.amount === "number" ? originalPayment.amount : undefined
    const already = originalPayment.refundedAmountMinor ?? 0
    const next = already + refundAmount
    const status: PaymentStatus = total !== undefined && next >= total ? "refunded" : "partially_refunded"
    await payCol.updateOne(
      { dodoPaymentId: paymentId },
      { $inc: { refundedAmountMinor: refundAmount }, $set: { status, updatedAt: Date.now() } },
    )
  } else {
    // Amount not authoritative on this event: the refund row exists and is
    // traceable, but we do NOT invent a monetary progress figure — only the
    // lifecycle status moves.
    await payCol.updateOne(
      { dodoPaymentId: paymentId },
      { $set: { status: "refunded", updatedAt: Date.now() } },
    )
  }

  logger.info("webhook.dodo", "Refund accounted", { refundId, paymentId, userId: originalPayment.userId })
  return undefined
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Persist a payment record. Amount/currency are recorded only when Dodo
 * actually provided them — an unknown amount is stored as absent, never as
 * a fabricated confirmed $0. A persistence failure is re-thrown so the
 * caller can mark the webhook event as failed; a required financial write
 * must never be silently treated as success. (Payment-record lookup keeps
 * the insert idempotent, so a later replay cannot double-record.)
 */
export async function recordPayment(params: {
  userId?: string
  dodoPaymentId: string
  dodoCustomerId?: string
  amount?: number
  currency?: string
  status: PaymentStatus
  paymentType: string
  creditsGranted?: number
  creditType?: string
  subscriptionId?: string
  packageId?: string
  productId?: string
  originalPaymentId?: string
  refundId?: string
  createdAt: number
}): Promise<void> {
  try {
    const col = await paymentRecordsCol()
    const existing = await col.findOne({ dodoPaymentId: params.dodoPaymentId })
    if (existing) return

    const record: PaymentRecord = {
      _id: new ObjectId(),
      id: `pay_${cryptoId()}`,
      userId: params.userId ?? "",
      dodoPaymentId: params.dodoPaymentId,
      dodoCustomerId: params.dodoCustomerId,
      amount: params.amount,
      currency: params.currency,
      status: params.status,
      paymentType: params.paymentType,
      creditsGranted: params.creditsGranted,
      creditType: params.creditType as "subscription" | "permanent" | undefined,
      subscriptionId: params.subscriptionId,
      packageId: params.packageId,
      productId: params.productId,
      originalPaymentId: params.originalPaymentId,
      refundId: params.refundId,
      createdAt: params.createdAt,
      updatedAt: Date.now(),
    }
    await col.insertOne(record)
  } catch (err) {
    logger.error("webhook.dodo", "Failed to record payment", { dodoPaymentId: params.dodoPaymentId, error: err instanceof Error ? err.message : String(err) })
    throw err
  }
}

export type { SubscriptionRecord, SubscriptionStatus }
