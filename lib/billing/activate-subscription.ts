import { ObjectId } from "mongodb"
import { subscriptionRecordsCol } from "@/lib/db/collections"
import { grantSubscriptionCredits } from "@/lib/billing/credit-service"
import { SUBSCRIPTION_PLANS } from "@/lib/billing/config"
import { getDodoClient } from "@/lib/billing/dodo-service"
import { cryptoId } from "@/lib/store/id"
import { logger } from "@/lib/logging/logger"
import type { SubscriptionRecord } from "@/lib/billing/billing-types"
import type { SubscriptionStatus } from "@/lib/billing/config"

type ActivateInput = {
  subscriptionId: string
  customerId?: string
  productId?: string
  status?: string
  metadata?: Record<string, unknown>
  nextBillingDate?: string
  expectedUserId?: string
}

export type ActivateResult =
  | { ok: true; planId: string; alreadyRecorded?: boolean }
  | { ok: false; reason: string }

function stringMeta(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key]
  return typeof value === "string" && value.trim() ? value : undefined
}

export async function activatePaidSubscription(input: ActivateInput): Promise<ActivateResult> {
  const subscriptionId = input.subscriptionId?.trim()
  if (!subscriptionId) return { ok: false, reason: "missing_subscription" }

  const userId = stringMeta(input.metadata, "userId") ?? stringMeta(input.metadata, "user_id") ?? input.expectedUserId
  if (!userId) return { ok: false, reason: "missing_user" }
  if (input.expectedUserId && userId !== input.expectedUserId) {
    return { ok: false, reason: "user_mismatch" }
  }

  const planId = stringMeta(input.metadata, "planId") ?? stringMeta(input.metadata, "plan_id")
  const plan =
    (planId ? SUBSCRIPTION_PLANS.find((item) => item.id === planId) : undefined) ??
    SUBSCRIPTION_PLANS.find((item) => item.dodoProductId && item.dodoProductId === input.productId)
  const credits = plan?.mirrorCredits ?? Number(stringMeta(input.metadata, "credits") ?? 0)
  if (!plan || !credits) return { ok: false, reason: "missing_plan" }

  const now = Date.now()
  const periodEnd = input.nextBillingDate ? new Date(input.nextBillingDate).getTime() : now + 30 * 24 * 60 * 60 * 1000
  const status = (input.status === "trialing" ? "trialing" : "active") as SubscriptionStatus

  const col = await subscriptionRecordsCol()
  const prevSub = await col.findOne({
    userId,
    status: { $in: ["active", "trialing"] },
    dodoSubscriptionId: { $ne: subscriptionId },
  })
  if (prevSub) {
    await col.updateOne(
      { dodoSubscriptionId: prevSub.dodoSubscriptionId },
      { $set: { status: "cancelled", cancelAtPeriodEnd: true, updatedAt: now } },
    )
  }

  const granted = await grantSubscriptionCredits({
    userId,
    amount: credits,
    subscriptionId,
    planId: plan.id,
    periodStart: now,
    periodEnd,
    metadata: { dodoCustomerId: input.customerId, productId: input.productId, event: "activation" },
  })

  await upsertSubscriptionRecord({
    userId,
    dodoSubscriptionId: subscriptionId,
    dodoCustomerId: input.customerId,
    planId: plan.id,
    planName: plan.name,
    priceUSD: plan.priceUSD,
    mirrorCredits: credits,
    status,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    nextBillingDate: input.nextBillingDate ? new Date(input.nextBillingDate).getTime() : undefined,
    cancelAtPeriodEnd: false,
    createdAt: now,
    updatedAt: now,
  })

  logger.info("billing.activate", "subscription recorded", {
    subscriptionId,
    userId,
    planId: plan.id,
    granted,
  })

  return { ok: true, planId: plan.id }
}

export async function syncDodoSubscription(subscriptionId: string, expectedUserId: string): Promise<ActivateResult> {
  const client = await getDodoClient()
  const raw = (await client.subscriptions.retrieve(subscriptionId)) as {
    subscription_id?: string
    status?: string
    product_id?: string
    next_billing_date?: string
    customer?: { customer_id?: string }
    metadata?: Record<string, unknown>
  }

  const status = raw.status ?? "active"
  if (status !== "active" && status !== "trialing") {
    return { ok: false, reason: `not_active:${status}` }
  }

  return activatePaidSubscription({
    subscriptionId: raw.subscription_id ?? subscriptionId,
    customerId: raw.customer?.customer_id,
    productId: raw.product_id,
    status,
    metadata: raw.metadata,
    nextBillingDate: raw.next_billing_date,
    expectedUserId,
  })
}

async function upsertSubscriptionRecord(params: {
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
}) {
  const col = await subscriptionRecordsCol()
  const existing = await col.findOne({ dodoSubscriptionId: params.dodoSubscriptionId })
  if (existing) {
    await col.updateOne(
      { dodoSubscriptionId: params.dodoSubscriptionId },
      {
        $set: {
          userId: params.userId,
          planId: params.planId,
          planName: params.planName,
          priceUSD: params.priceUSD,
          mirrorCredits: params.mirrorCredits,
          status: params.status,
          currentPeriodStart: params.currentPeriodStart,
          currentPeriodEnd: params.currentPeriodEnd,
          nextBillingDate: params.nextBillingDate,
          cancelAtPeriodEnd: params.cancelAtPeriodEnd,
          updatedAt: Date.now(),
        },
      },
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
}
