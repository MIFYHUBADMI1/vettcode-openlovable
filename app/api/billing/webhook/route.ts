import { NextResponse } from "next/server"
import { createHash } from "crypto"
import { ObjectId } from "mongodb"
import { webhookEventsCol, paymentRecordsCol, subscriptionRecordsCol, creditLedgerCol } from "@/lib/db/collections"
import { verifyWebhookSignature } from "@/lib/billing/dodo-webhook"
import {
  grantCredits,
  grantSubscriptionCredits,
  expireSubscriptionCredits,
  reverseCredits,
} from "@/lib/billing/credit-service"
import { SUBSCRIPTION_PLANS } from "@/lib/billing/config"
import { logger } from "@/lib/logging/logger"
import { cryptoId } from "@/lib/store/id"
import type { WebhookEventDoc } from "@/lib/types/db"
import type { PaymentRecord, SubscriptionRecord } from "@/lib/billing/billing-types"
import type { SubscriptionStatus, PaymentStatus } from "@/lib/billing/config"

export const runtime = "nodejs"

export async function GET() {
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY ?? ""
  const apiKey = process.env.DODO_PAYMENTS_API_KEY ?? ""
  return NextResponse.json({
    ok: true,
    data: {
      endpoint: "/api/billing/webhook",
      webhookKeyConfigured: webhookKey.length > 0,
      webhookKeyPrefix: webhookKey.length > 0 ? webhookKey.slice(0, 10) + "..." : "(missing)",
      apiKeyConfigured: apiKey.length > 0,
      environment: process.env.DODO_PAYMENTS_ENVIRONMENT ?? "(missing)",
      timestamp: new Date().toISOString(),
    },
  })
}

export async function POST(req: Request) {
  let webhookId = ""
  let rawBody = ""

  try {
    rawBody = await req.text()
    webhookId = req.headers.get("webhook-id") ?? ""

    logger.info("webhook.dodo", "Received webhook", {
      webhookId,
      hasSignature: Boolean(req.headers.get("webhook-signature")),
      hasTimestamp: Boolean(req.headers.get("webhook-timestamp")),
      bodyLength: rawBody.length,
      webhookKeyConfigured: Boolean(process.env.DODO_PAYMENTS_WEBHOOK_KEY),
    })

    const verification = verifyWebhookSignature(rawBody, {
      "webhook-id": req.headers.get("webhook-id"),
      "webhook-signature": req.headers.get("webhook-signature"),
      "webhook-timestamp": req.headers.get("webhook-timestamp"),
    })

    if (!verification.valid) {
      logger.warn("webhook.dodo", "Invalid webhook signature", {
        webhookId,
        error: verification.error,
        webhookKeyConfigured: Boolean(process.env.DODO_PAYMENTS_WEBHOOK_KEY),
      })
      return NextResponse.json(
        { ok: false, error: { code: "UNAUTHORIZED", message: "Invalid webhook signature" } },
        { status: 401 },
      )
    }

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      logger.warn("webhook.dodo", "Invalid JSON payload", { webhookId })
      return NextResponse.json({ ok: true, data: { received: true } })
    }

    const eventType = payload.type as string
    const eventData = payload.data as Record<string, unknown> | undefined

    if (!eventType) {
      logger.warn("webhook.dodo", "Missing event type", { webhookId })
      return NextResponse.json({ ok: true, data: { received: true } })
    }

    // Persist event for webhook-id-level idempotency (Dodo may retry same event)
    const col = await webhookEventsCol()
    const payloadHash = createHash("sha256").update(rawBody).digest("hex")
    const now = Date.now()

    const existing = await col.findOne({ webhookId })
    if (existing) {
      logger.info("webhook.dodo", "Duplicate webhook-id ignored", { webhookId, eventType })
      return NextResponse.json({ ok: true, data: { received: true, duplicate: true } })
    }

    const eventDoc: WebhookEventDoc = {
      _id: new ObjectId(),
      id: `evt_${cryptoId()}`,
      provider: "dodo",
      webhookId,
      eventType,
      payload,
      payloadHash,
      status: "received",
      receivedAt: now,
    }

    try {
      await col.insertOne(eventDoc)
    } catch (err) {
      if (err instanceof Error && /E11000|duplicate key/i.test(err.message)) {
        logger.info("webhook.dodo", "Duplicate webhook (race condition)", { webhookId, eventType })
        return NextResponse.json({ ok: true, data: { received: true, duplicate: true } })
      }
      throw err
    }

    try {
      await processEvent(eventType, eventData, eventDoc.id)
    } catch (processingError) {
      logger.error("webhook.dodo", "Event processing failed", {
        webhookId,
        eventType,
        eventId: eventDoc.id,
        error: processingError instanceof Error ? processingError.message : String(processingError),
      })
    }

    return NextResponse.json({ ok: true, data: { received: true } })
  } catch (error) {
    logger.error("webhook.dodo", "Unexpected webhook error", {
      webhookId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ ok: true, data: { received: true } })
  }
}

async function processEvent(
  eventType: string,
  data: Record<string, unknown> | undefined,
  eventId: string,
): Promise<void> {
  const col = await webhookEventsCol()

  try {
    switch (eventType) {
      case "payment.succeeded":
        await handlePaymentSucceeded(data)
        break
      case "payment.failed":
        await handlePaymentFailed(data)
        break
      case "payment.processing":
        logger.info("webhook.dodo", "Payment processing", { eventId })
        break
      case "payment.cancelled":
        await handlePaymentCancelled(data)
        break
      case "subscription.active":
        await handleSubscriptionActive(data)
        break
      case "subscription.renewed":
        await handleSubscriptionRenewed(data)
        break
      case "subscription.cancelled":
        await handleSubscriptionCancelled(data)
        break
      case "subscription.past_due":
        await handleSubscriptionPastDue(data)
        break
      case "subscription.on_hold":
        await handleSubscriptionOnHold(data)
        break
      case "subscription.expired":
        await handleSubscriptionExpired(data)
        break
      case "subscription.updated":
        await handleSubscriptionUpdated(data)
        break
      case "subscription.plan_changed":
        await handleSubscriptionPlanChanged(data)
        break
      case "refund.succeeded":
        await handleRefundSucceeded(data)
        break
      case "refund.failed":
        logger.warn("webhook.dodo", "Refund failed", { eventId, data })
        break
      case "dispute.opened":
      case "dispute.accepted":
      case "dispute.challenged":
      case "dispute.won":
      case "dispute.lost":
      case "dispute.expired":
      case "dispute.cancelled":
        logger.info("webhook.dodo", `Dispute event: ${eventType}`, { eventId, data })
        break
      case "credit.added":
      case "credit.deducted":
      case "credit.expired":
      case "credit.rolled_over":
        logger.info("webhook.dodo", `Credit event: ${eventType}`, { eventId })
        break
      default:
        logger.info("webhook.dodo", `Unhandled event type: ${eventType}`, { eventId })
        break
    }

    await col.updateOne(
      { id: eventId },
      { $set: { status: "processed", processedAt: Date.now() } },
    )
  } catch (error) {
    await col.updateOne(
      { id: eventId },
      {
        $set: {
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
          processedAt: Date.now(),
        },
      },
    )
    throw error
  }
}

// ─── Payment Handlers ──────────────────────────────────────────────────────────

async function handlePaymentSucceeded(data: Record<string, unknown> | undefined) {
  if (!data) {
    logger.warn("webhook.dodo", "payment.succeeded: missing data")
    return
  }

  const paymentId = data.payment_id as string
  const customer = data.customer as Record<string, unknown> | undefined
  const customerId = customer?.customer_id as string
  const metadata = data.metadata as Record<string, unknown> | undefined
  const subscriptionId = data.subscription_id as string | null
  const totalAmount = data.total_amount as number
  const currency = data.currency as string

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
    return
  }

  const userId = metadata?.userId as string | undefined
  const credits = metadata?.credits as number | undefined
  const packageId = metadata?.packageId as string | undefined

  if (!userId || !credits) {
    logger.warn("webhook.dodo", "payment.succeeded: missing userId or credits", { paymentId, metadata })
    return
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

  if (result.success) {
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
  }
}

async function handlePaymentFailed(data: Record<string, unknown> | undefined) {
  if (!data) return
  const paymentId = data.payment_id as string
  const subscriptionId = data.subscription_id as string | null
  const metadata = data.metadata as Record<string, unknown> | undefined
  const userId = metadata?.userId as string | undefined

  await recordPayment({
    dodoPaymentId: paymentId,
    amount: 0,
    currency: "USD",
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
  await recordPayment({ dodoPaymentId: paymentId, amount: 0, currency: "USD", status: "cancelled", paymentType: "unknown", createdAt: Date.now() })
  logger.info("webhook.dodo", "Payment cancelled", { paymentId })
}

// ─── Subscription Handlers ─────────────────────────────────────────────────────

/**
 * subscription.active — fires when a subscription is first created/activated.
 *
 * On plan switch: Dodo creates a NEW subscription and fires active for it.
 * We ADD the new plan's credits on top of whatever the user already has.
 * We do NOT expire the old plan's credits — the user keeps them until
 * their natural expiry (handled by subscription.expired).
 *
 * Idempotency: keyed on subscriptionId + periodEnd (day-epoch).
 * Both subscription.active and subscription.renewed for the same billing
 * cycle carry the same next_billing_date, so duplicates are always blocked.
 */
async function handleSubscriptionActive(data: Record<string, unknown> | undefined) {
  if (!data) { logger.warn("webhook.dodo", "subscription.active: missing data"); return }

  const subscriptionId = data.subscription_id as string
  const customer = data.customer as Record<string, unknown> | undefined
  const customerId = customer?.customer_id as string
  const productId = data.product_id as string
  const status = data.status as string
  const metadata = data.metadata as Record<string, unknown> | undefined
  const nextBillingDate = data.next_billing_date as string

  const userId = metadata?.userId as string | undefined
  const planId = metadata?.planId as string | undefined
  const plan = planId ? SUBSCRIPTION_PLANS.find((p) => p.id === planId) : undefined
  const credits = plan?.mirrorCredits ?? (metadata?.credits as number | undefined) ?? 0

  logger.info("webhook.dodo", "subscription.active received", { subscriptionId, userId, planId, credits, status })

  if (!userId || !credits) {
    logger.warn("webhook.dodo", "subscription.active: missing userId or credits", { subscriptionId })
    return
  }

  const now = Date.now()
  const periodEnd = nextBillingDate ? new Date(nextBillingDate).getTime() : now + 30 * 24 * 60 * 60 * 1000

  // ── Idempotency check: has this exact subscription+period already been granted? ──
  const grantKey = `sub_grant_${subscriptionId}_period_${Math.floor(periodEnd / 86400000)}`
  const ledger = await creditLedgerCol()
  const alreadyGranted = await ledger.findOne({ idempotencyKey: grantKey })
  if (alreadyGranted) {
    logger.info("webhook.dodo", "subscription.active: duplicate — grant already exists, skipping", { subscriptionId, grantKey })
    return
  }

  // ── Mark old subscription record as switched-away-from (no credit change) ──
  const subCol = await subscriptionRecordsCol()
  const prevSub = await subCol.findOne({
    userId,
    status: { $in: ["active", "trialing"] },
    dodoSubscriptionId: { $ne: subscriptionId },
  })
  if (prevSub) {
    logger.info("webhook.dodo", "Plan switch detected — old credits KEPT, new credits ADDED on top", {
      userId, prevPlan: prevSub.planId, newPlan: planId,
      prevSubId: prevSub.dodoSubscriptionId, newSubId: subscriptionId,
    })
    await subCol.updateOne(
      { dodoSubscriptionId: prevSub.dodoSubscriptionId },
      { $set: { status: "cancelled", cancelAtPeriodEnd: true, updatedAt: now } },
    )
  }

  // ── Grant new plan credits on top of existing balance ──
  const granted = await grantSubscriptionCredits({
    userId, amount: credits, subscriptionId,
    planId: planId ?? "unknown", periodStart: now, periodEnd,
    metadata: { dodoCustomerId: customerId, productId, event: "activation" },
  })

  if (granted) {
    await recordSubscription({
      userId,
      dodoSubscriptionId: subscriptionId,
      dodoCustomerId: customerId,
      planId: planId ?? "unknown",
      planName: plan?.name ?? "Unknown",
      priceUSD: plan?.priceUSD ?? 0,
      mirrorCredits: credits,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      nextBillingDate: nextBillingDate ? new Date(nextBillingDate).getTime() : undefined,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    })
    logger.info("webhook.dodo", "subscription.active: credits granted", { subscriptionId, userId, credits, planId })
  }
}

/**
 * subscription.renewed — fires every month when Dodo successfully charges
 * for the next billing period.
 *
 * ONLY fires for the SAME subscription renewing (not for plan switches —
 * those fire subscription.active on a new subscription ID).
 *
 * Flow:
 * 1. Idempotency check — skip if already granted for this period
 * 2. Expire the CURRENT period's bucket for this subscription
 * 3. Grant fresh credits for the new period
 *
 * We do NOT expire credits from other subscriptions (plan switches) here.
 */
async function handleSubscriptionRenewed(data: Record<string, unknown> | undefined) {
  if (!data) { logger.warn("webhook.dodo", "subscription.renewed: missing data"); return }

  const subscriptionId = data.subscription_id as string
  const metadata = data.metadata as Record<string, unknown> | undefined
  const nextBillingDate = data.next_billing_date as string

  const userId = metadata?.userId as string | undefined
  const planId = metadata?.planId as string | undefined
  const plan = planId ? SUBSCRIPTION_PLANS.find((p) => p.id === planId) : undefined
  const credits = plan?.mirrorCredits ?? (metadata?.credits as number | undefined) ?? 0

  if (!userId || !credits) {
    logger.warn("webhook.dodo", "subscription.renewed: missing userId or credits", { subscriptionId })
    return
  }

  const now = Date.now()
  const periodEnd = nextBillingDate ? new Date(nextBillingDate).getTime() : now + 30 * 24 * 60 * 60 * 1000

  // ── Idempotency: skip if this subscription+period already granted ──
  const grantKey = `sub_grant_${subscriptionId}_period_${Math.floor(periodEnd / 86400000)}`
  const ledger = await creditLedgerCol()
  const alreadyGranted = await ledger.findOne({ idempotencyKey: grantKey })
  if (alreadyGranted) {
    logger.info("webhook.dodo", "subscription.renewed: duplicate — grant already exists, skipping", { subscriptionId, grantKey })
    return
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

// ─── Refund Handler ───────────────────────────────────────────────────────────

async function handleRefundSucceeded(data: Record<string, unknown> | undefined) {
  if (!data) { logger.warn("webhook.dodo", "refund.succeeded: missing data"); return }

  const refundId = data.refund_id as string
  const paymentId = data.payment_id as string
  const amount = data.amount as number
  const currency = data.currency as string

  const payCol = await paymentRecordsCol()
  const originalPayment = await payCol.findOne({ dodoPaymentId: paymentId })
  if (!originalPayment?.userId) {
    logger.warn("webhook.dodo", "Refund: no matching payment found", { refundId, paymentId })
    return
  }

  const existingRefund = await payCol.findOne({ dodoPaymentId: refundId })
  if (existingRefund) { logger.info("webhook.dodo", "Refund already processed", { refundId }); return }

  const creditsToReverse = originalPayment.creditsGranted ?? 0
  if (creditsToReverse <= 0) { logger.warn("webhook.dodo", "Refund: no credits to reverse", { refundId }); return }

  const result = await reverseCredits({
    userId: originalPayment.userId,
    creditType: originalPayment.creditType ?? "permanent",
    amount: creditsToReverse,
    transactionType: "build_refund",
    idempotencyKey: `refund_${refundId}`,
    referenceType: "refund",
    referenceId: refundId,
    metadata: { originalPaymentId: paymentId, refundAmount: amount, currency, creditsReversed: creditsToReverse },
  })

  if (result.success) {
    await recordPayment({ userId: originalPayment.userId, dodoPaymentId: refundId, amount: -amount, currency, status: "refunded", paymentType: "refund", creditsGranted: -creditsToReverse, createdAt: Date.now() })
    logger.info("webhook.dodo", "Credits reversed for refund", { refundId, paymentId, userId: originalPayment.userId, creditsReversed: creditsToReverse })
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function recordPayment(params: {
  userId?: string
  dodoPaymentId: string
  dodoCustomerId?: string
  amount: number
  currency: string
  status: PaymentStatus
  paymentType: string
  creditsGranted?: number
  creditType?: string
  subscriptionId?: string
  packageId?: string
  productId?: string
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
      createdAt: params.createdAt,
      updatedAt: Date.now(),
    }
    await col.insertOne(record)
  } catch (err) {
    logger.error("webhook.dodo", "Failed to record payment", { dodoPaymentId: params.dodoPaymentId, error: err instanceof Error ? err.message : String(err) })
  }
}

async function recordSubscription(params: {
  userId: string
  dodoSubscriptionId: string
  dodoCustomerId?: string
  planId: string
  planName: string
  priceUSD: number
  mirrorCredits: number
  status: SubscriptionStatus
  currentPeriodStart: number
  currentPeriodEnd: number
  nextBillingDate?: number
  cancelAtPeriodEnd: boolean
  createdAt: number
  updatedAt: number
}): Promise<void> {
  try {
    const col = await subscriptionRecordsCol()
    const existing = await col.findOne({ dodoSubscriptionId: params.dodoSubscriptionId })
    if (existing) {
      await col.updateOne(
        { dodoSubscriptionId: params.dodoSubscriptionId },
        { $set: { userId: params.userId, planId: params.planId, planName: params.planName, priceUSD: params.priceUSD, mirrorCredits: params.mirrorCredits, status: params.status as SubscriptionStatus, currentPeriodStart: params.currentPeriodStart, currentPeriodEnd: params.currentPeriodEnd, nextBillingDate: params.nextBillingDate, cancelAtPeriodEnd: params.cancelAtPeriodEnd, updatedAt: Date.now() } },
      )
      return
    }

    const record: SubscriptionRecord = {
      _id: new ObjectId(),
      id: `sub_${cryptoId()}`,
      userId: params.userId,
      dodoSubscriptionId: params.dodoSubscriptionId,
      dodoCustomerId: params.dodoCustomerId,
      planId: params.planId,
      planName: params.planName,
      priceUSD: params.priceUSD,
      mirrorCredits: params.mirrorCredits,
      status: params.status,
      currentPeriodStart: params.currentPeriodStart,
      currentPeriodEnd: params.currentPeriodEnd,
      nextBillingDate: params.nextBillingDate,
      cancelAtPeriodEnd: params.cancelAtPeriodEnd,
      createdAt: params.createdAt,
      updatedAt: params.updatedAt,
    }
    await col.insertOne(record)
  } catch (err) {
    logger.error("webhook.dodo", "Failed to record subscription", { dodoSubscriptionId: params.dodoSubscriptionId, error: err instanceof Error ? err.message : String(err) })
  }
}
