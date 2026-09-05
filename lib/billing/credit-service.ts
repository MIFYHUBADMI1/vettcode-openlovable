/**
 * MirrorSite AI — Unified Credit Service
 *
 * The SINGLE authoritative system for all credit operations.
 * No other file should directly mutate user credit balances.
 *
 * Operations:
 * - Check balances (total, subscription, permanent)
 * - Grant credits (signup, referral, purchase, subscription)
 * - Reserve credits (before builds)
 * - Consume credits (after successful builds)
 * - Release reservations (on failed builds)
 * - Expire subscription credits (at period end)
 * - Refund credits
 * - Record ledger transactions
 * - Calculate available balance
 *
 * @module lib/billing/credit-service
 */

import "server-only"
import { ObjectId } from "mongodb"
import { usersCol, creditLedgerCol } from "@/lib/db/collections"
import { cryptoId } from "@/lib/store/id"
import { logger } from "@/lib/logging/logger"
import {
  PRICING_MODEL_VERSION,
  COST_MODEL_VERSION,
  WELCOME_BONUS_CREDITS,
  REFERRAL_VERIFICATION_REWARD,
  REFERRAL_MILESTONE_REWARD,
  CONSUMPTION_ORDER,
  CREDITS_PER_BASELINE_UNIT,
} from "./config"
import type { CreditType, LedgerTransactionType } from "./config"
import type { CreditLedgerEntry } from "./billing-types"

// ─── Balance Reading ─────────────────────────────────────────────────────────

export interface CreditBalance {
  total: number
  subscription: number
  permanent: number
}

/**
 * Get the user's credit balance, broken down by type.
 * Falls back to legacy `credits` field if new fields are not yet populated.
 */
export async function getBalance(userId: string): Promise<CreditBalance> {
  const users = await usersCol()
  const user = await users.findOne({ id: userId })
  if (!user) return { total: 0, subscription: 0, permanent: 0 }

  // Use new fields if available, otherwise fall back to legacy credits
  const subscription = user.subscriptionCredits ?? 0
  const permanent = user.permanentCredits ?? 0
  const newTotal = subscription + permanent
  const legacyCredits = user.credits ?? 0

  // If new fields are populated, use them; otherwise fall back to legacy
  const total = newTotal > 0 ? newTotal : legacyCredits

  // Log divergence for monitoring (don't auto-fix to avoid data corruption)
  if (newTotal > 0 && newTotal !== legacyCredits) {
    logger.warn("credit.balance", "Balance divergence detected", {
      userId,
      newTotal,
      legacyCredits,
      subscription,
      permanent,
    })
  }

  return { total, subscription, permanent }
}

/**
 * Get the total available credits (subscription + permanent).
 * This is what the rest of the app should use.
 */
export async function getAvailableCredits(userId: string): Promise<number> {
  const balance = await getBalance(userId)
  return balance.total
}

// ─── Ledger Operations ───────────────────────────────────────────────────────

async function recordLedgerEntry(params: {
  userId: string
  creditType: CreditType
  amount: number
  direction: "credit" | "debit"
  transactionType: LedgerTransactionType
  referenceType?: string
  referenceId?: string
  balanceBefore: number
  balanceAfter: number
  idempotencyKey: string
  metadata?: Record<string, unknown>
}): Promise<CreditLedgerEntry> {
  const col = await creditLedgerCol()
  const entry: CreditLedgerEntry = {
    _id: new ObjectId(),
    id: `ledger_${cryptoId()}`,
    userId: params.userId,
    creditType: params.creditType,
    amount: params.amount,
    direction: params.direction,
    transactionType: params.transactionType,
    referenceType: params.referenceType,
    referenceId: params.referenceId,
    balanceBefore: params.balanceBefore,
    balanceAfter: params.balanceAfter,
    idempotencyKey: params.idempotencyKey,
    pricingModelVersion: PRICING_MODEL_VERSION,
    costModelVersion: COST_MODEL_VERSION,
    metadata: params.metadata,
    createdAt: Date.now(),
  }

  try {
    await col.insertOne(entry)
  } catch (err: unknown) {
    // E11000 = duplicate idempotency key — this is expected on retries
    if (err instanceof Error && /E11000|duplicate key/i.test(err.message)) {
      logger.info("credit.ledger", "Duplicate ledger entry (idempotent)", {
        idempotencyKey: params.idempotencyKey,
      })
      // Return the existing entry
      const existing = await col.findOne({ idempotencyKey: params.idempotencyKey })
      if (existing) return existing
    }
    throw err
  }

  return entry
}

// ─── Credit Grant Operations ─────────────────────────────────────────────────

/**
 * Grant credits to a user. Creates a ledger entry and updates the balance.
 * Always use idempotencyKey to prevent duplicate grants.
 */
export async function grantCredits(params: {
  userId: string
  creditType: CreditType
  amount: number
  transactionType: LedgerTransactionType
  idempotencyKey: string
  referenceType?: string
  referenceId?: string
  metadata?: Record<string, unknown>
}): Promise<{ success: boolean; ledgerEntry: CreditLedgerEntry }> {
  const users = await usersCol()
  const balance = await getBalance(params.userId)
  const field = params.creditType === "subscription" ? "subscriptionCredits" : "permanentCredits"
  const newBalance = balance.total + params.amount

  const client = (await import("@/lib/db/mongodb")).getMongoClient
  const mongoClient = await client()
  const session = mongoClient.startSession()

  try {
    let ledgerEntry: CreditLedgerEntry | null = null
    let success = false

    await session.withTransaction(async () => {
      // Check for duplicate (idempotency)
      const existingLedger = await (await creditLedgerCol()).findOne(
        { idempotencyKey: params.idempotencyKey },
        { session },
      )
      if (existingLedger) {
        ledgerEntry = existingLedger
        success = true
        return
      }

      // Update user balance (grant — no $gte needed, but idempotency check above prevents duplicates)
      await users.updateOne(
        { id: params.userId },
        {
          $inc: { [field]: params.amount, credits: params.amount },
          $set: { updatedAt: Date.now() },
        },
        { session },
      )

      // Record ledger entry
      ledgerEntry = await recordLedgerEntry({
        userId: params.userId,
        creditType: params.creditType,
        amount: params.amount,
        direction: "credit",
        transactionType: params.transactionType,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        balanceBefore: balance.total,
        balanceAfter: newBalance,
        idempotencyKey: params.idempotencyKey,
        metadata: params.metadata,
      })

      success = true
    })

    if (success && ledgerEntry) {
      logger.info("credit.grant", "Credits granted", {
        userId: params.userId,
        creditType: params.creditType,
        amount: params.amount,
        transactionType: params.transactionType,
        newBalance,
      })
    }

    return { success, ledgerEntry: ledgerEntry! }
  } finally {
    await session.endSession()
  }
}

// ─── Credit Consumption ──────────────────────────────────────────────────────

/**
 * Consume credits from a user's balance, following consumption order:
 * subscription credits first, then permanent credits.
 *
 * Returns the actual amounts consumed from each bucket.
 */
export async function consumeCredits(params: {
  userId: string
  amount: number
  transactionType: LedgerTransactionType
  idempotencyKey: string
  referenceType?: string
  referenceId?: string
  metadata?: Record<string, unknown>
}): Promise<{
  success: boolean
  subscriptionConsumed: number
  permanentConsumed: number
}> {
  const users = await usersCol()
  const balance = await getBalance(params.userId)

  if (balance.total < params.amount) {
    logger.warn("credit.consume", "Insufficient credits", {
      userId: params.userId,
      requested: params.amount,
      available: balance.total,
    })
    return { success: false, subscriptionConsumed: 0, permanentConsumed: 0 }
  }

  // Calculate consumption split
  let remaining = params.amount
  let subConsumed = 0
  let permConsumed = 0

  for (const creditType of CONSUMPTION_ORDER) {
    if (remaining <= 0) break
    const available = creditType === "subscription" ? balance.subscription : balance.permanent
    const toConsume = Math.min(remaining, available)
    if (toConsume > 0) {
      if (creditType === "subscription") subConsumed = toConsume
      else permConsumed = toConsume
      remaining -= toConsume
    }
  }

  const client = (await import("@/lib/db/mongodb")).getMongoClient
  const mongoClient = await client()
  const session = mongoClient.startSession()

  try {
    let success = false

    await session.withTransaction(async () => {
      // Check for idempotency
      const existingLedger = await (await creditLedgerCol()).findOne(
        { idempotencyKey: params.idempotencyKey },
        { session },
      )
      if (existingLedger) {
        success = true
        return
      }

      // Update user balance with atomic $gte check to prevent double-spend
      // The filter ensures credits >= amount BEFORE the $inc applies,
      // preventing two concurrent requests from both succeeding.
      const filter: Record<string, unknown> = { id: params.userId, credits: { $gte: params.amount } }
      const updateOps: Record<string, unknown> = {
        $inc: { credits: -params.amount },
        $set: { updatedAt: Date.now() },
      }
      if (subConsumed > 0) {
        (updateOps.$inc as Record<string, number>).subscriptionCredits = -subConsumed
      }
      if (permConsumed > 0) {
        (updateOps.$inc as Record<string, number>).permanentCredits = -permConsumed
      }

      const result = await users.updateOne(filter, updateOps, { session })
      if (result.modifiedCount === 0) {
        // Insufficient credits at atomic check time — another request consumed them
        success = false
        return
      }

      // Record ledger entries
      const newBalance = balance.total - params.amount

      if (subConsumed > 0) {
        await recordLedgerEntry({
          userId: params.userId,
          creditType: "subscription",
          amount: subConsumed,
          direction: "debit",
          transactionType: params.transactionType,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          balanceBefore: balance.subscription,
          balanceAfter: balance.subscription - subConsumed,
          idempotencyKey: `${params.idempotencyKey}_sub`,
          metadata: params.metadata,
        })
      }

      if (permConsumed > 0) {
        await recordLedgerEntry({
          userId: params.userId,
          creditType: "permanent",
          amount: permConsumed,
          direction: "debit",
          transactionType: params.transactionType,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          balanceBefore: balance.permanent,
          balanceAfter: balance.permanent - permConsumed,
          idempotencyKey: `${params.idempotencyKey}_perm`,
          metadata: params.metadata,
        })
      }

      success = true
    })

    if (success) {
      logger.info("credit.consume", "Credits consumed", {
        userId: params.userId,
        amount: params.amount,
        subscriptionConsumed: subConsumed,
        permanentConsumed: permConsumed,
        transactionType: params.transactionType,
      })
    }

    return { success, subscriptionConsumed: subConsumed, permanentConsumed: permConsumed }
  } finally {
    await session.endSession()
  }
}

// ─── Reservation Operations ──────────────────────────────────────────────────

/**
 * Reserve credits before a build. This debits credits atomically.
 * Use releaseReservation to refund if the build doesn't proceed.
 */
export async function reserveCredits(params: {
  userId: string
  amount: number
  buildId: string
  reason: string
  metadata?: Record<string, unknown>
}): Promise<boolean> {
  const result = await consumeCredits({
    userId: params.userId,
    amount: params.amount,
    transactionType: "build_reservation",
    idempotencyKey: `reserve_${params.buildId}`,
    referenceType: "build",
    referenceId: params.buildId,
    metadata: { ...params.metadata, reason: params.reason },
  })
  return result.success
}

/**
 * Release a reservation (refund credits for failed/cancelled builds).
 * Credits are released to permanent bucket since we can't guarantee
 * the original subscription period is still active.
 */
export async function releaseReservation(params: {
  userId: string
  amount: number
  buildId: string
  reason: string
  subscriptionConsumed?: number
  permanentConsumed?: number
  metadata?: Record<string, unknown>
}): Promise<boolean> {
  // If we know the exact bucket breakdown from the reservation, release to permanent
  // (subscription credits may have expired by the time the build fails)
  const result = await grantCredits({
    userId: params.userId,
    creditType: "permanent",
    amount: params.amount,
    transactionType: "build_release",
    idempotencyKey: `release_${params.buildId}`,
    referenceType: "build",
    referenceId: params.buildId,
    metadata: {
      ...params.metadata,
      reason: params.reason,
      subscriptionConsumed: params.subscriptionConsumed,
      permanentConsumed: params.permanentConsumed,
    },
  })
  return result.success
}

// ─── Subscription Credit Operations ──────────────────────────────────────────

/**
 * Grant subscription credits for a new billing period.
 * Idempotent per subscription per period.
 */
export async function grantSubscriptionCredits(params: {
  userId: string
  amount: number
  subscriptionId: string
  planId: string
  periodStart: number
  periodEnd: number
  metadata?: Record<string, unknown>
}): Promise<boolean> {
  const result = await grantCredits({
    userId: params.userId,
    creditType: "subscription",
    amount: params.amount,
    transactionType: "subscription_grant",
    idempotencyKey: `sub_grant_${params.subscriptionId}_${params.periodStart}`,
    referenceType: "subscription",
    referenceId: params.subscriptionId,
    metadata: {
      ...params.metadata,
      planId: params.planId,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
    },
  })

  if (result.success) {
    // Update user's subscription period
    const users = await usersCol()
    await users.updateOne(
      { id: params.userId },
      {
        $set: {
          subscriptionPeriodStart: params.periodStart,
          subscriptionPeriodEnd: params.periodEnd,
          updatedAt: Date.now(),
        },
      },
    )
  }

  return result.success
}

/**
 * Expire subscription credits at the end of a billing period.
 * Directly debits the subscription bucket without going through normal
 * consumption logic (which would consume subscription first anyway, but
 * this is more explicit and correct).
 *
 * @param periodStart - The start timestamp (ms) of the NEW billing period
 *   being activated. Used to build a stable, time-independent idempotency
 *   key of the form `sub_expire_<id>_<dayEpoch>` so that webhook retries
 *   within the same billing period are safely deduplicated regardless of
 *   which minute they arrive. When omitted (subscription expiration, not
 *   renewal) the key is simply `sub_expire_<id>` since the sub won't
 *   be renewed again.
 */
export async function expireSubscriptionCredits(params: {
  userId: string
  subscriptionId: string
  periodStart?: number
  metadata?: Record<string, unknown>
}): Promise<boolean> {
  const balance = await getBalance(params.userId)
  if (balance.subscription <= 0) return true

  const amount = balance.subscription
  const users = await usersCol()
  const client = (await import("@/lib/db/mongodb")).getMongoClient
  const mongoClient = await client()
  const session = mongoClient.startSession()

  // Build a stable idempotency key that does NOT depend on the current clock
  // minute. For renewals, key on day-epoch of the new period start so retries
  // within the same billing cycle always produce the same key. For plain
  // expirations there is no future renewal, so the subscriptionId alone is unique.
  const idempotencyKey = params.periodStart
    ? `sub_expire_${params.subscriptionId}_${Math.floor(params.periodStart / 86400000)}`
    : `sub_expire_${params.subscriptionId}`

  try {
    let success = false

    await session.withTransaction(async () => {
      // Idempotency check
      const existingLedger = await (await creditLedgerCol()).findOne(
        { idempotencyKey },
        { session },
      )
      if (existingLedger) {
        success = true
        return
      }

      // Directly debit subscription credits
      const filter = { id: params.userId, subscriptionCredits: { $gte: amount } }
      const result = await users.updateOne(
        filter,
        {
          $inc: { subscriptionCredits: -amount, credits: -amount },
          $set: { updatedAt: Date.now() },
        },
        { session },
      )

      if (result.modifiedCount === 0) {
        success = false
        return
      }

      // Record ledger entry
      await recordLedgerEntry({
        userId: params.userId,
        creditType: "subscription",
        amount,
        direction: "debit",
        transactionType: "subscription_expiration",
        referenceType: "subscription",
        referenceId: params.subscriptionId,
        balanceBefore: balance.subscription,
        balanceAfter: 0,
        idempotencyKey,
        metadata: { ...params.metadata, expiredAmount: amount },
      })

      success = true
    })

    return success
  } finally {
    await session.endSession()
  }
}

// ─── Signup & Referral Operations ────────────────────────────────────────────

/**
 * Grant the welcome bonus credits after email verification.
 * Idempotent per user.
 */
export async function grantWelcomeBonus(userId: string): Promise<boolean> {
  const result = await grantCredits({
    userId,
    creditType: "permanent",
    amount: WELCOME_BONUS_CREDITS,
    transactionType: "signup_bonus",
    idempotencyKey: `welcome_${userId}`,
    referenceType: "signup",
    referenceId: userId,
  })
  return result.success
}

/**
 * Grant referral verification reward.
 * Idempotent per referrer per referred user.
 */
export async function grantReferralVerificationReward(
  referrerUserId: string,
  referredUserId: string,
): Promise<boolean> {
  const result = await grantCredits({
    userId: referrerUserId,
    creditType: "permanent",
    amount: REFERRAL_VERIFICATION_REWARD,
    transactionType: "referral_bonus",
    idempotencyKey: `ref_verify_${referrerUserId}_${referredUserId}`,
    referenceType: "referral",
    referenceId: referredUserId,
    metadata: { rewardType: "verification" },
  })
  return result.success
}

/**
 * Grant referral milestone reward.
 * Idempotent per referrer per referred user.
 */
export async function grantReferralMilestoneReward(
  referrerUserId: string,
  referredUserId: string,
): Promise<boolean> {
  const result = await grantCredits({
    userId: referrerUserId,
    creditType: "permanent",
    amount: REFERRAL_MILESTONE_REWARD,
    transactionType: "referral_bonus",
    idempotencyKey: `ref_milestone_${referrerUserId}_${referredUserId}`,
    referenceType: "referral",
    referenceId: referredUserId,
    metadata: { rewardType: "milestone" },
  })
  return result.success
}

// ─── Refund/Reversal Operations ─────────────────────────────────────────────

/**
 * Reverse credits (for refunds). Properly debits from the specified credit type.
 * Unlike grantCredits with negative amounts, this correctly handles direction.
 */
export async function reverseCredits(params: {
  userId: string
  creditType: CreditType
  amount: number
  transactionType: LedgerTransactionType
  idempotencyKey: string
  referenceType?: string
  referenceId?: string
  metadata?: Record<string, unknown>
}): Promise<{ success: boolean }> {
  const users = await usersCol()
  const balance = await getBalance(params.userId)
  const field = params.creditType === "subscription" ? "subscriptionCredits" : "permanentCredits"
  const available = params.creditType === "subscription" ? balance.subscription : balance.permanent

  // Can't reverse more than available in this bucket
  const actualReversal = Math.min(params.amount, available)
  if (actualReversal <= 0) {
    return { success: false }
  }

  const client = (await import("@/lib/db/mongodb")).getMongoClient
  const mongoClient = await client()
  const session = mongoClient.startSession()

  try {
    let success = false

    await session.withTransaction(async () => {
      // Idempotency check
      const existingLedger = await (await creditLedgerCol()).findOne(
        { idempotencyKey: params.idempotencyKey },
        { session },
      )
      if (existingLedger) {
        success = true
        return
      }

      // Atomic debit with $gte check
      const filter: Record<string, unknown> = { id: params.userId, credits: { $gte: actualReversal } }
      const updateOps: Record<string, unknown> = {
        $inc: { credits: -actualReversal, [field]: -actualReversal },
        $set: { updatedAt: Date.now() },
      }

      const result = await users.updateOne(filter, updateOps, { session })
      if (result.modifiedCount === 0) {
        success = false
        return
      }

      // Record ledger entry
      await recordLedgerEntry({
        userId: params.userId,
        creditType: params.creditType,
        amount: actualReversal,
        direction: "debit",
        transactionType: params.transactionType,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        balanceBefore: available,
        balanceAfter: available - actualReversal,
        idempotencyKey: params.idempotencyKey,
        metadata: { ...params.metadata, originalAmount: params.amount, actualReversed: actualReversal },
      })

      success = true
    })

    if (success) {
      logger.info("credit.reverse", "Credits reversed", {
        userId: params.userId,
        creditType: params.creditType,
        amount: actualReversal,
        transactionType: params.transactionType,
      })
    }

    return { success }
  } finally {
    await session.endSession()
  }
}

// ─── Admin Operations ────────────────────────────────────────────────────────

/**
 * Admin credit adjustment. Must go through the ledger.
 */
export async function adminAdjustCredits(params: {
  userId: string
  amount: number
  adminId: string
  reason: string
  creditType?: CreditType
  idempotencyKey?: string
}): Promise<boolean> {
  const creditType = params.creditType ?? "permanent"
  // Use provided idempotency key or generate one from admin+user+reason+amount
  // to prevent duplicate adjustments from accidental double-submits
  const key = params.idempotencyKey ?? `admin_${params.adminId}_${params.userId}_${params.amount}_${Buffer.from(params.reason).toString("base64").slice(0, 20)}`

  if (params.amount >= 0) {
    const result = await grantCredits({
      userId: params.userId,
      creditType,
      amount: params.amount,
      transactionType: "admin_adjustment",
      idempotencyKey: key,
      referenceType: "admin",
      referenceId: params.adminId,
      metadata: { reason: params.reason, adminId: params.adminId },
    })
    return result.success
  } else {
    const result = await reverseCredits({
      userId: params.userId,
      creditType,
      amount: Math.abs(params.amount),
      transactionType: "admin_adjustment",
      idempotencyKey: key,
      referenceType: "admin",
      referenceId: params.adminId,
      metadata: { reason: params.reason, adminId: params.adminId },
    })
    return result.success
  }
}

// ─── Ledger Query ────────────────────────────────────────────────────────────

/**
 * Get a user's credit ledger entries.
 */
export async function getLedgerEntries(
  userId: string,
  options: { limit?: number; offset?: number; creditType?: CreditType } = {},
): Promise<CreditLedgerEntry[]> {
  const col = await creditLedgerCol()
  const query: Record<string, unknown> = { userId }
  if (options.creditType) query.creditType = options.creditType

  return col
    .find(query)
    .sort({ createdAt: -1 })
    .skip(options.offset ?? 0)
    .limit(options.limit ?? 100)
    .toArray()
}

/**
 * Get the total credits consumed by a user (for referral milestone tracking).
 */
export async function getTotalCreditsConsumed(userId: string): Promise<number> {
  const col = await creditLedgerCol()
  const result = await col
    .aggregate([
      {
        $match: {
          userId,
          direction: "debit",
          transactionType: { $in: ["build_finalization"] },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ])
    .toArray()

  return result[0]?.total ?? 0
}

/**
 * Convert credits to baseline cost units (internal only).
 */
export function creditsToBaselineUnits(credits: number): number {
  return Math.floor(credits / CREDITS_PER_BASELINE_UNIT)
}

/**
 * Get the user's credit history formatted for display.
 */
export async function getCreditHistory(
  userId: string,
  limit = 50,
): Promise<Array<{
  id: string
  type: string
  amount: number
  creditType: string
  reason: string
  createdAt: number
}>> {
  const col = await creditLedgerCol()
  const entries = await col
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()

  return entries.map((e) => ({
    id: e.id,
    type: e.transactionType,
    amount: e.direction === "credit" ? e.amount : -e.amount,
    creditType: e.creditType,
    reason: formatTransactionReason(e.transactionType, e.metadata),
    createdAt: e.createdAt,
  }))
}

function formatTransactionReason(type: LedgerTransactionType, metadata?: Record<string, unknown>): string {
  switch (type) {
    case "signup_bonus":
      return "Welcome bonus"
    case "referral_bonus":
      return metadata?.rewardType === "milestone"
        ? "Referral milestone reward"
        : "Referral verification reward"
    case "credit_purchase":
      return "Credit purchase"
    case "subscription_grant":
      return "Subscription credits"
    case "subscription_renewal":
      return "Subscription renewal"
    case "build_reservation":
      return "Application build"
    case "build_finalization":
      return "Application build (finalized)"
    case "build_release":
      return "Build refund"
    case "build_refund":
      return "Build refund"
    case "promotional_grant":
      return "Promotional grant"
    case "admin_adjustment":
      return "Admin adjustment"
    case "subscription_expiration":
      return "Subscription credits expired"
    default:
      return type.replace(/_/g, " ")
  }
}
