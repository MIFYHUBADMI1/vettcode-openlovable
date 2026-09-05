import { NextResponse } from "next/server"
import { createHash } from "crypto"
import { ObjectId } from "mongodb"
import { webhookEventsCol, paymentRecordsCol, subscriptionRecordsCol } from "@/lib/db/collections"
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

/**
 * Dodo Payments webhook endpoint.
 *
 * Handles payment, subscription, and refund events from Dodo Payments.
 * Uses the unified CreditService for all credit operations.
 *
 * Implements:
 * - HMAC SHA-256 signature verification (Standard Webhooks spec)
 * - Idempotent event processing (duplicate webhook-id → skip)
 * - Credit grants via CreditService (subscription vs permanent)
 * - Subscription lifecycle tracking with proper records
 * - Refund/reversal handling
 *
 * Always returns 200 to Dodo on valid webhooks (they retry on non-200).
 * Returns 401 only for invalid signatures.
 *
 * @see https://docs.dodopayments.com/developer-resources/webhooks
 */

export const runtime = "nodejs"

/**
 * GET /api/billing/webhook — health check for the webhook endpoint.
 * Returns configuration status without exposing secret values.
 * Useful for confirming the endpoint is reachable and keys are loaded.
 */
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
    // ── 1. Read raw body for signature verification ────────────────────────
    rawBody = await req.text()
    webhookId = req.headers.get("webhook-id") ?? ""

    logger.info("webhook.dodo", "Received webhook", {
      webhookId,
      hasSignature: Boolean(req.headers.get("webhook-signature")),
      hasTimestamp: Boolean(req.headers.get("webhook-timestamp")),
      bodyLength: rawBody.length,
      webhookKeyConfigured: Boolean(process.env.DODO_PAYMENTS_WEBHOOK_KEY),
    })

    // ── 2. Verify webhook signature ────────────────────────────────────────
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

    // ── 3. Parse event payload ─────────────────────────────────────────────
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

    // ── 4. Persist event for idempotency ───────────────────────────────────
    const col = await webhookEventsCol()
    const payloadHash = createHash("sha256").update(rawBody).digest("hex")
    const now = Date.now()

    const existing = await col.findOne({ webhookId })
    if (existing) {
      logger.info("webhook.dodo", "Duplicate webhook ignored", {
        webhookId,
        eventType,
        existingStatus: existing.status,
      })
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

    // ── 5. Process event synchronously before responding ──────────────────
    // Awaiting here ensures that if the process is killed or a serverless
    // function times out after we respond, we haven't already returned 200
    // and lost the event silently. All handlers are idempotent so Dodo
    // retries (on non-200) are safe — but we avoid needing them by
    // completing the work before we acknowledge receipt.
    try {
      await processEvent(eventType, eventData, eventDoc.id)
    } catch (processingError) {
      // Processing failed but the event is persisted with status "failed".
      // We still return 200 so Dodo doesn't retry — our own event record
      // (status="failed") is the recovery mechanism. Retrying would re-hit
      // the duplicate check and be a no-op anyway.
      logger.error("webhook.dodo", "Event processing failed", {
        webhookId,
        eventType,
        eventId: eventDoc.id,
        error: processingError instanceof Error ? processingError.message : String(processingError),
      })
    }

    // ── 6. Return 200 after processing ────────────────────────────────────
    return NextResponse.json({ ok: true, data: { received: true } })
  } catch (error) {
    logger.error("webhook.dodo", "Unexpected webhook error", {
      webhookId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ ok: true, data: { received: true } })
  }
}

// ─── Event Processing ─────────────────────────────────────────────────────────

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

  logger.info("webhook.dodo", "Payment succeeded", {
    paymentId,
    customerId,
    subscriptionId,
    totalAmount,
    currency,
  })

  // For subscription payments, credit grant is handled by subscription.active/renewed
  if (subscriptionId) {
    logger.info("webhook.dodo", "Subscription payment — handled by subscription events", {
      paymentId,
      subscriptionId,
    })

    // Still record the payment
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

  // For one-time payments (permanent credit packs)
  const userId = metadata?.userId as string | undefined
  const credits = metadata?.credits as number | undefined
  const packageId = metadata?.packageId as string | undefined

  if (!userId || !credits) {
    logger.warn("webhook.dodo", "payment.succeeded: missing userId or credits in metadata", {
      paymentId,
      metadata,
    })
    return
  }

  // Grant permanent credits via CreditService
  const result = await grantCredits({
    userId,
    creditType: "permanent",
    amount: credits,
    transactionType: "credit_purchase",
    idempotencyKey: `payment_${paymentId}`,
    referenceType: "payment",
    referenceId: paymentId,
    metadata: {
      packageId,
      dodoPaymentId: paymentId,
      dodoCustomerId: customerId,
      totalAmount,
      currency,
    },
  })

  if (result.success) {
    // Record payment
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

    logger.info("webhook.dodo", "Permanent credits granted", {
      paymentId,
      userId,
      credits,
      packageId,
    })
  }
}

async function handlePaymentFailed(data: Record<string, unknown> | undefined) {
  if (!data) return
  const paymentId = data.payment_id as string

  await recordPayment({
    dodoPaymentId: paymentId,
    amount: 0,
    currency: "USD",
    status: "failed",
    paymentType: "unknown",
    createdAt: Date.now(),
  })

  logger.warn("webhook.dodo", "Payment failed", { paymentId })
}

async function handlePaymentCancelled(data: Record<string, unknown> | undefined) {
  if (!data) return
  const paymentId = data.payment_id as string

  await recordPayment({
    dodoPaymentId: paymentId,
    amount: 0,
    currency: "USD",
    status: "cancelled",
    paymentType: "unknown",
    createdAt: Date.now(),
  })

  logger.info("webhook.dodo", "Payment cancelled", { paymentId })
}

// ─── Subscription Handlers ─────────────────────────────────────────────────────

async function handleSubscriptionActive(data: Record<string, unknown> | undefined) {
  if (!data) {
    logger.warn("webhook.dodo", "subscription.active: missing data")
    return
  }

  const subscriptionId = data.subscription_id as string
  const customer = data.customer as Record<string, unknown> | undefined
  const customerId = customer?.customer_id as string
  const productId = data.product_id as string
  const status = data.status as string
  const metadata = data.metadata as Record<string, unknown> | undefined
  const nextBillingDate = data.next_billing_date as string

  const userId = metadata?.userId as string | undefined
  const planId = metadata?.planId as string | undefined

  // Look up plan credits from our config
  const plan = planId ? SUBSCRIPTION_PLANS.find((p) => p.id === planId) : undefined
  const credits = plan?.mirrorCredits ?? (metadata?.credits as number | undefined) ?? 0

  logger.info("webhook.dodo", "Subscription activated", {
    subscriptionId,
    customerId,
    productId,
    status,
    userId,
    planId,
    credits,
  })

  if (!userId || !credits) {
    logger.warn("webhook.dodo", "subscription.active: missing userId or credits", {
      subscriptionId,
    })
    return
  }

  const now = Date.now()
  const periodEnd = nextBillingDate ? new Date(nextBillingDate).getTime() : now + 30 * 24 * 60 * 60 * 1000

  // Grant subscription credits via CreditService
  const result = await grantSubscriptionCredits({
    userId,
    amount: credits,
    subscriptionId,
    planId: planId ?? "unknown",
    periodStart: now,
    periodEnd,
    metadata: {
      dodoCustomerId: customerId,
      productId,
      event: "activation",
    },
  })

  if (result) {
    // Create/update subscription record
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

    logger.info("webhook.dodo", "Subscription credits granted", {
      subscriptionId,
      userId,
      credits,
      planId,
    })
  }
}

async function handleSubscriptionRenewed(data: Record<string, unknown> | undefined) {
  if (!data) {
    logger.warn("webhook.dodo", "subscription.renewed: missing data")
    return
  }

  const subscriptionId = data.subscription_id as string
  const metadata = data.metadata as Record<string, unknown> | undefined
  const nextBillingDate = data.next_billing_date as string

  const userId = metadata?.userId as string | undefined
  const planId = metadata?.planId as string | undefined

  const plan = planId ? SUBSCRIPTION_PLANS.find((p) => p.id === planId) : undefined
  const credits = plan?.mirrorCredits ?? (metadata?.credits as number | undefined) ?? 0

  if (!userId || !credits) {
    logger.warn("webhook.dodo", "subscription.renewed: missing userId or credits", {
      subscriptionId,
    })
    return
  }

  const now = Date.now()
  const periodEnd = nextBillingDate ? new Date(nextBillingDate).getTime() : now + 30 * 24 * 60 * 60 * 1000

  // Expire previous period's subscription credits
  await expireSubscriptionCredits({
    userId,
    subscriptionId,
    periodStart: now,
    metadata: { event: "renewal" },
  })

  // Grant new period's subscription credits
  const result = await grantSubscriptionCredits({
    userId,
    amount: credits,
    subscriptionId,
    planId: planId ?? "unknown",
    periodStart: now,
    periodEnd,
    metadata: {
      event: "renewal",
      dodoCustomerId: metadata?.customerId as string,
    },
  })

  if (result) {
    // Update subscription record
    const subCol = await subscriptionRecordsCol()
    await subCol.updateOne(
      { dodoSubscriptionId: subscriptionId },
      {
        $set: {
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          nextBillingDate: nextBillingDate ? new Date(nextBillingDate).getTime() : undefined,
          updatedAt: now,
        },
      },
    )

    logger.info("webhook.dodo", "Renewal credits granted", {
      subscriptionId,
      userId,
      credits,
      planId,
    })
  }
}

async function handleSubscriptionCancelled(data: Record<string, unknown> | undefined) {
  if (!data) return
  const subscriptionId = data.subscription_id as string
  const metadata = data.metadata as Record<string, unknown> | undefined
  const userId = metadata?.userId as string | undefined
  const cancelledAt = data.cancelled_at as string | undefined

  // Update subscription record
  const subCol = await subscriptionRecordsCol()
  await subCol.updateOne(
    { dodoSubscriptionId: subscriptionId },
    {
      $set: {
        status: "cancelled",
        cancelledAt: cancelledAt ? new Date(cancelledAt).getTime() : Date.now(),
        cancelAtPeriodEnd: true,
        updatedAt: Date.now(),
      },
    },
  )

  logger.info("webhook.dodo", "Subscription cancelled", {
    subscriptionId,
    userId,
    cancelledAt,
  })
}

async function handleSubscriptionPastDue(data: Record<string, unknown> | undefined) {
  if (!data) return
  const subscriptionId = data.subscription_id as string

  const subCol = await subscriptionRecordsCol()
  await subCol.updateOne(
    { dodoSubscriptionId: subscriptionId },
    { $set: { status: "past_due", updatedAt: Date.now() } },
  )

  logger.warn("webhook.dodo", "Subscription past due", { subscriptionId })
}

async function handleSubscriptionOnHold(data: Record<string, unknown> | undefined) {
  if (!data) return
  const subscriptionId = data.subscription_id as string

  const subCol = await subscriptionRecordsCol()
  await subCol.updateOne(
    { dodoSubscriptionId: subscriptionId },
    { $set: { status: "paused", updatedAt: Date.now() } },
  )

  logger.warn("webhook.dodo", "Subscription on hold", { subscriptionId })
}

async function handleSubscriptionExpired(data: Record<string, unknown> | undefined) {
  if (!data) return
  const subscriptionId = data.subscription_id as string
  const metadata = data.metadata as Record<string, unknown> | undefined
  const userId = metadata?.userId as string | undefined

  // Expire subscription credits
  if (userId) {
    await expireSubscriptionCredits({
      userId,
      subscriptionId,
      metadata: { event: "expiration" },
    })
  }

  // Update subscription record
  const subCol = await subscriptionRecordsCol()
  await subCol.updateOne(
    { dodoSubscriptionId: subscriptionId },
    { $set: { status: "expired", expiredAt: Date.now(), updatedAt: Date.now() } },
  )

  logger.info("webhook.dodo", "Subscription expired", { subscriptionId, userId })
}

async function handleSubscriptionUpdated(data: Record<string, unknown> | undefined) {
  if (!data) return
  const subscriptionId = data.subscription_id as string
  const status = data.status as string
  const metadata = data.metadata as Record<string, unknown> | undefined
  const userId = metadata?.userId as string | undefined

  // Map Dodo status to our status
  const statusMap: Record<string, string> = {
    active: "active",
    cancelled: "cancelled",
    past_due: "past_due",
    paused: "paused",
    expired: "expired",
  }

  const mappedStatus = statusMap[status] ?? status

  const subCol = await subscriptionRecordsCol()
  await subCol.updateOne(
    { dodoSubscriptionId: subscriptionId },
    { $set: { status: mappedStatus as never, updatedAt: Date.now() } },
  )

  logger.info("webhook.dodo", "Subscription updated", {
    subscriptionId,
    userId,
    status,
  })
}

async function handleSubscriptionPlanChanged(data: Record<string, unknown> | undefined) {
  if (!data) return
  const subscriptionId = data.subscription_id as string
  const metadata = data.metadata as Record<string, unknown> | undefined
  const userId = metadata?.userId as string | undefined
  const productId = data.product_id as string

  // Find the new plan by Dodo product ID
  const newPlan = SUBSCRIPTION_PLANS.find((p) => p.dodoProductId === productId)

  if (newPlan) {
    const subCol = await subscriptionRecordsCol()
    await subCol.updateOne(
      { dodoSubscriptionId: subscriptionId },
      {
        $set: {
          planId: newPlan.id,
          planName: newPlan.name,
          priceUSD: newPlan.priceUSD,
          mirrorCredits: newPlan.mirrorCredits,
          updatedAt: Date.now(),
        },
      },
    )
  }

  logger.info("webhook.dodo", "Subscription plan changed", {
    subscriptionId,
    userId,
    productId,
  })
}

// ─── Refund Handlers ──────────────────────────────────────────────────────────

async function handleRefundSucceeded(data: Record<string, unknown> | undefined) {
  if (!data) {
    logger.warn("webhook.dodo", "refund.succeeded: missing data")
    return
  }

  const refundId = data.refund_id as string
  const paymentId = data.payment_id as string
  const amount = data.amount as number
  const currency = data.currency as string

  logger.info("webhook.dodo", "Refund succeeded", {
    refundId,
    paymentId,
    amount,
    currency,
  })

  // Find the original payment record
  const payCol = await paymentRecordsCol()
  const originalPayment = await payCol.findOne({ dodoPaymentId: paymentId })

  if (!originalPayment || !originalPayment.userId) {
    logger.warn("webhook.dodo", "Refund: no matching payment found", {
      refundId,
      paymentId,
    })
    return
  }

  // Check for duplicate refund
  const existingRefund = await payCol.findOne({ dodoPaymentId: refundId })
  if (existingRefund) {
    logger.info("webhook.dodo", "Refund already processed", { refundId })
    return
  }

  // Calculate credits to reverse based on original grant
  const creditsToReverse = originalPayment.creditsGranted ?? 0
  if (creditsToReverse <= 0) {
    logger.warn("webhook.dodo", "Refund: no credits to reverse", { refundId, paymentId })
    return
  }

  // Reverse credits via CreditService (proper debit, not negative grant)
  const result = await reverseCredits({
    userId: originalPayment.userId,
    creditType: originalPayment.creditType ?? "permanent",
    amount: creditsToReverse,
    transactionType: "build_refund",
    idempotencyKey: `refund_${refundId}`,
    referenceType: "refund",
    referenceId: refundId,
    metadata: {
      originalPaymentId: paymentId,
      refundAmount: amount,
      currency,
      creditsReversed: creditsToReverse,
    },
  })

  if (result.success) {
    // Record the refund payment
    await recordPayment({
      userId: originalPayment.userId,
      dodoPaymentId: refundId,
      amount: -amount,
      currency,
      status: "refunded",
      paymentType: "refund",
      creditsGranted: -creditsToReverse,
      createdAt: Date.now(),
    })

    logger.info("webhook.dodo", "Credits reversed for refund", {
      refundId,
      paymentId,
      userId: originalPayment.userId,
      creditsReversed: creditsToReverse,
    })
  }
}

// ─── Helper: Record Payment ──────────────────────────────────────────────────

async function recordPayment(params: {
  userId?: string
  dodoPaymentId: string
  dodoCustomerId?: string
  amount: number
  currency: string
  status: import("@/lib/billing/config").PaymentStatus
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
    if (existing) return // Idempotent

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
    logger.error("webhook.dodo", "Failed to record payment", {
      dodoPaymentId: params.dodoPaymentId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

// ─── Helper: Record Subscription ─────────────────────────────────────────────

async function recordSubscription(params: {
  userId: string
  dodoSubscriptionId: string
  dodoCustomerId?: string
  planId: string
  planName: string
  priceUSD: number
  mirrorCredits: number
  status: import("@/lib/billing/config").SubscriptionStatus
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
      // Update existing record
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
    logger.error("webhook.dodo", "Failed to record subscription", {
      dodoSubscriptionId: params.dodoSubscriptionId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
