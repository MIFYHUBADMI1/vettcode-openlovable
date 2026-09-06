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
 * 
 * @param userId - The unique identifier of the user
 * @returns Promise resolving to a CreditBalance object with total, subscription, and permanent amounts
 * 
 * @remarks
 * This function handles the transition from legacy single-field credits to the new
 * dual-field system (subscriptionCredits + permanentCredits). If the new fields are
 * not yet populated, it falls back to the legacy `credits` field.
 * 
 * @example
 * ```typescript
 * const balance = await getBalance("user_123");
 * console.log(`Total: ${balance.total}, Subscription: ${balance.subscription}, Permanent: ${balance.permanent}`);
 * ```
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
 * This is what the rest of the app should use for credit checks.
 * 
 * @param userId - The unique identifier of the user
 * @returns Promise resolving to the total number of available credits
 * 
 * @remarks
 * This is the primary function for checking if a user has sufficient credits
 * for an operation. It automatically sums subscription and permanent credits.
 * 
 * @example
 * ```typescript
 * const available = await getAvailableCredits("user_123");
 * if (available >= 100) {
 *   // User has enough credits to proceed
 * }
 * ```
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
 * 
 * @param params - Grant credits parameters
 * @param params.userId - The unique identifier of the user
 * @param params.creditType - Type of credits: 'subscription' or 'permanent'
 * @param params.amount - Number of credits to grant (must be positive)
 * @param params.transactionType - Type of transaction (signup_bonus, referral_bonus, topup_grant, etc.)
 * @param params.idempotencyKey - Unique key to prevent duplicate grants (REQUIRED)
 * @param params.referenceType - Optional type of reference (e.g., 'payment', 'subscription')
 * @param params.referenceId - Optional reference identifier
 * @param params.metadata - Optional additional data (reason, description, etc.)
 * @returns Promise resolving to success status and the created/existing ledger entry
 * 
 * @remarks
 * **Idempotency:** This function is idempotent. If called multiple times with the same
 * idempotencyKey, only the first call will grant credits. Subsequent calls will return
 * the existing ledger entry without modifying the balance.
 * 
 * **Double-Entry Ledger:** This function creates a credit (positive) entry in the ledger
 * and increments both the type-specific balance field and the total credits field.
 * 
 * **Transaction Safety:** Uses MongoDB transactions to ensure atomicity. If the database
 * operation fails, no credits are granted and no ledger entry is created.
 * 
 * **Error Handling:** 
 * - Throws if the user does not exist
 * - Throws on database errors (except duplicate key for idempotency)
 * - Never throws on duplicate idempotency key (returns existing entry instead)
 * 
 * @example
 * ```typescript
 * // Grant signup bonus
 * const result = await grantCredits({
 *   userId: "user_123",
 *   creditType: "permanent",
 *   amount: 50,
 *   transactionType: "signup_bonus",
 *   idempotencyKey: `signup_user_123`,
 *   metadata: { reason: "Welcome bonus after email verification" }
 * });
 * 
 * // Grant referral reward
 * const referralResult = await grantCredits({
 *   userId: "user_456",
 *   creditType: "permanent",
 *   amount: 25,
 *   transactionType: "referral_bonus",
 *   idempotencyKey: `referral_user_456_from_user_123`,
 *   referenceType: "referral",
 *   referenceId: "referral_789",
 *   metadata: { reason: "Referral bonus", referredBy: "user_123" }
 * });
 * ```
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
 * Consume credits from a user's balance.
 * 
 * @param params - Consume credits parameters
 * @param params.userId - The unique identifier of the user
 * @param params.amount - Number of credits to consume (must be positive)
 * @param params.transactionType - Type of transaction (build_consumption, etc.)
 * @param params.idempotencyKey - Unique key to prevent duplicate consumptions (REQUIRED)
 * @param params.referenceType - Optional type of reference (e.g., 'build')
 * @param params.referenceId - Optional reference identifier (e.g., build ID)
 * @param params.metadata - Optional additional data
 * @returns Promise resolving to success status and ledger entry, or failure details
 * 
 * @remarks
 * **Credit Consumption Order:** Credits are consumed in the order defined by CONSUMPTION_ORDER:
 * 1. Subscription credits (oldest expiring first, based on expiresAt)
 * 2. Permanent credits
 * 
 * This ensures subscription credits are used before they expire, maximizing value for users.
 * 
 * **Idempotency:** Like grantCredits, this function is idempotent. Duplicate calls with the
 * same idempotencyKey will not consume additional credits.
 * 
 * **Insufficient Balance:** If the user doesn't have enough credits, the function returns
 * `{ success: false }` with `insufficientBalance: true`. No partial consumption occurs.
 * 
 * **Transaction Safety:** Uses MongoDB transactions to ensure atomicity. Either all credits
 * are consumed and the ledger entry is created, or nothing happens.
 * 
 * **Error Handling:**
 * - Returns `{ success: false, insufficientBalance: true }` if not enough credits
 * - Throws on database errors (except duplicate key for idempotency)
 * - Never throws on duplicate idempotency key
 * 
 * @example
 * ```typescript
 * // Consume credits for a build
 * const result = await consumeCredits({
 *   userId: "user_123",
 *   amount: 15,
 *   transactionType: "build_consumption",
 *   idempotencyKey: `build_consumption_${buildId}`,
 *   referenceType: "build",
 *   referenceId: buildId,
 *   metadata: { complexity: "medium", projectId }
 * });
 * 
 * if (!result.success && result.insufficientBalance) {
 *   // User doesn't have enough credits
 *   throw new Error("Insufficient credits");
 * }
 * ```
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
  const user = await users.findOne({ id: params.userId })
  if (!user) return { success: false, subscriptionConsumed: 0, permanentConsumed: 0 }

  const balance = await getBalance(params.userId)

  if (balance.total < params.amount) {
    logger.warn("credit.consume", "Insufficient credits", {
      userId: params.userId,
      requested: params.amount,
      available: balance.total,
    })
    return { success: false, subscriptionConsumed: 0, permanentConsumed: 0 }
  }

  // ── Sort buckets oldest-expiry-first, skip already-expired ones ────────────
  const rawBuckets: import("@/lib/types/db").CreditBucket[] = user.creditBuckets ?? []
  const now = Date.now()

  // Separate non-expired and expired buckets. Non-expired are consumed first
  // (oldest first). Expired buckets are consumed only if non-expired are exhausted.
  const nonExpiredBuckets = rawBuckets.filter((b) => b.expiresAt > now)
  const expiredBuckets = rawBuckets.filter((b) => b.expiresAt <= now)

  // Sort each group oldest-expiry-first
  nonExpiredBuckets.sort((a, b) => a.expiresAt - b.expiresAt)
  expiredBuckets.sort((a, b) => a.expiresAt - b.expiresAt)

  // Consume order: non-expired (oldest first), then expired (oldest first), then permanent
  const sortedBuckets = [...nonExpiredBuckets, ...expiredBuckets]

  let remaining = params.amount
  let subConsumed = 0
  let permConsumed = 0

  // Track how much to deduct from each bucket (for the DB update)
  const bucketDeductions: Array<{ subscriptionId: string; deduct: number; newAmount: number }> = []

  for (const bucket of sortedBuckets) {
    if (remaining <= 0) break
    const toConsume = Math.min(remaining, bucket.amount)
    if (toConsume > 0) {
      subConsumed += toConsume
      remaining -= toConsume
      bucketDeductions.push({
        subscriptionId: bucket.subscriptionId,
        deduct: toConsume,
        newAmount: bucket.amount - toConsume,
      })
    }
  }

  // If subscription buckets are exhausted, consume from permanent
  if (remaining > 0 && balance.permanent > 0) {
    const toConsume = Math.min(remaining, balance.permanent)
    permConsumed += toConsume
    remaining -= toConsume
  }

  // Fallback: no buckets but has legacy subscriptionCredits — consume from flat field
  if (remaining > 0 && rawBuckets.length === 0 && balance.subscription > 0) {
    const toConsume = Math.min(remaining, balance.subscription)
    subConsumed += toConsume
    remaining -= toConsume
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

      // Build the flat-field update
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
        success = false
        return
      }

      // Update individual bucket amounts (set each bucket's new amount)
      // We do this as a separate update since MongoDB doesn't support
      // updating array elements by a filter in the same operation.
      if (bucketDeductions.length > 0) {
        for (const { subscriptionId, newAmount, deduct } of bucketDeductions) {
          if (newAmount <= 0) {
            // Bucket fully consumed — remove it
            await users.updateOne(
              { id: params.userId },
              { $pull: { creditBuckets: { subscriptionId } } as Record<string, unknown> },
              { session },
            )
          } else {
            // Partially consumed — update the amount
            await users.updateOne(
              { id: params.userId, "creditBuckets.subscriptionId": subscriptionId },
              { $inc: { "creditBuckets.$.amount": -deduct } },
              { session },
            )
          }
        }
      }

      // Record ledger entries — use actual computed balances
      const newSubBalance = balance.subscription - subConsumed
      const newPermBalance = balance.permanent - permConsumed

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
          balanceAfter: newSubBalance,
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
          balanceAfter: newPermBalance,
          idempotencyKey: `${params.idempotencyKey}_perm`,
          metadata: params.metadata,
        })
      }

      success = true
    })

    if (success) {
      logger.info("credit.consume", "Credits consumed (oldest-first)", {
        userId: params.userId,
        amount: params.amount,
        subscriptionConsumed: subConsumed,
        permanentConsumed: permConsumed,
        bucketsUsed: bucketDeductions.length,
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
 * 
 * @param params - Reservation parameters
 * @param params.userId - The unique identifier of the user
 * @param params.projectId - The project ID for the build
 * @param params.buildId - The build ID being reserved for
 * @param params.complexity - Build complexity level
 * @param params.creditCost - Number of credits to reserve
 * @param params.idempotencyKey - Unique key to prevent duplicate reservations
 * @returns Promise resolving to the created ledger entry
 * 
 * @throws {InsufficientCreditsError} If user doesn't have enough credits
 * @throws {Error} On database errors
 * 
 * @remarks
 * **Purpose:** Reservations prevent race conditions when multiple builds are triggered.
 * Credits are immediately debited, ensuring they can't be double-spent.
 * 
 * **Release:** If the build fails or is cancelled, call `releaseReservation` to refund
 * the reserved credits. If the build succeeds, the reservation is already accounted for
 * (no additional action needed).
 * 
 * **Idempotency:** Safe to retry on network failures. Duplicate idempotency keys will
 * return the existing reservation without double-charging.
 * 
 * @example
 * ```typescript
 * try {
 *   await reserveCredits({
 *     userId: "user_123",
 *     projectId: "project_456",
 *     buildId: "build_789",
 *     complexity: "medium",
 *     creditCost: 15,
 *     idempotencyKey: `reservation_build_789`
 *   });
 * } catch (error) {
 *   if (error.message.includes("Insufficient credits")) {
 *     // Handle insufficient balance
 *   }
 * }
 * ```
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
 * Idempotent per subscription per billing period (keyed on periodEnd).
 *
 * Uses periodEnd (next_billing_date from Dodo) as the idempotency key
 * component — this is the same value whether the grant comes from
 * subscription.active or subscription.renewed for the same period,
 * so duplicate events from Dodo are safely deduplicated regardless of
 * when they arrive or what periodStart value was used.
 *
 * The credit grant AND bucket creation happen in a single transaction
 * so they can never be out of sync.
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
  // Key on periodEnd (day-epoch) so both subscription.active and
  // subscription.renewed for the same billing period produce the same key.
  const periodEndDay = Math.floor(params.periodEnd / 86400000)
  const idempotencyKey = `sub_grant_${params.subscriptionId}_period_${periodEndDay}`

  // Idempotency check first — don't double-grant
  const ledger = await creditLedgerCol()
  const existing = await ledger.findOne({ idempotencyKey })
  if (existing) {
    logger.info("credit.grant", "Subscription grant already recorded (idempotent)", { idempotencyKey })
    return true
  }

  const users = await usersCol()
  const balance = await getBalance(params.userId)
  const newBalance = balance.total + params.amount
  const now = Date.now()
  const newBucket: import("@/lib/types/db").CreditBucket = {
    subscriptionId: params.subscriptionId,
    planId: params.planId,
    amount: params.amount,
    originalAmount: params.amount,
    expiresAt: params.periodEnd,
    createdAt: now,
  }

  const client = (await import("@/lib/db/mongodb")).getMongoClient
  const mongoClient = await client()
  const session = mongoClient.startSession()

  try {
    let success = false

    await session.withTransaction(async () => {
      // Re-check idempotency inside the transaction to prevent races
      const existingInTxn = await (await creditLedgerCol()).findOne(
        { idempotencyKey: idempotencyKey },
        { session },
      )
      if (existingInTxn) {
        logger.info("credit.grant", "Subscription grant already recorded (idempotent, in transaction)", { idempotencyKey })
        success = true
        return
      }

      // Grant the credits (increment flat fields)
      await users.updateOne(
        { id: params.userId },
        {
          $inc: { subscriptionCredits: params.amount, credits: params.amount },
          $set: { updatedAt: now },
        },
        { session },
      )

      // Push the new bucket — in the SAME transaction so grant + bucket are atomic
      await users.updateOne(
        { id: params.userId },
        {
          $push: { creditBuckets: newBucket } as Record<string, unknown>,
          $set: {
            subscriptionPeriodStart: params.periodStart,
            subscriptionPeriodEnd: params.periodEnd,
          },
        },
        { session },
      )

      // Record ledger entry
      await recordLedgerEntry({
        userId: params.userId,
        creditType: "subscription",
        amount: params.amount,
        direction: "credit",
        transactionType: "subscription_grant",
        referenceType: "subscription",
        referenceId: params.subscriptionId,
        balanceBefore: balance.subscription,
        balanceAfter: balance.subscription + params.amount,
        idempotencyKey,
        metadata: {
          ...params.metadata,
          planId: params.planId,
          periodStart: params.periodStart,
          periodEnd: params.periodEnd,
        },
      })

      success = true
    })

    if (success) {
      logger.info("credit.grant", "Subscription credits granted (with bucket)", {
        userId: params.userId,
        amount: params.amount,
        subscriptionId: params.subscriptionId,
        planId: params.planId,
        newBalance,
      })
    }

    return success
  } finally {
    await session.endSession()
  }
}

/**
 * Expire subscription credits for a specific subscription.
 *
 * With the bucket model: removes the matching CreditBucket from the user's
 * creditBuckets array and decrements subscriptionCredits by that bucket's
 * remaining amount. If no matching bucket exists (e.g. older account without
 * buckets), falls back to expiring the full subscription balance.
 *
 * Idempotent — safe to call multiple times with the same params.
 */
export async function expireSubscriptionCredits(params: {
  userId: string
  subscriptionId: string
  periodStart?: number
  metadata?: Record<string, unknown>
}): Promise<boolean> {
  const users = await usersCol()
  const user = await users.findOne({ id: params.userId })
  if (!user) return false

  // ── Bucket-aware path ────────────────────────────────────────────────────
  const buckets: import("@/lib/types/db").CreditBucket[] = user.creditBuckets ?? []
  const matchingBucket = buckets.find((b) => b.subscriptionId === params.subscriptionId)

  const balance = await getBalance(params.userId)
  if (balance.subscription <= 0) return true

  // Amount to expire: the matching bucket's remaining amount, capped at the actual
  // subscription balance to prevent over-expiration if the flat field is out of sync.
  let amount: number
  if (matchingBucket) {
    // Only expire what's in this specific bucket — don't touch other buckets' credits
    amount = Math.min(matchingBucket.amount, balance.subscription)
  } else {
    // Legacy account without buckets — expire the full subscription balance
    amount = balance.subscription
  }

  if (amount <= 0) return true

  // Stable idempotency key — include periodStart when available so renewals
  // for different periods produce different keys
  const idempotencyKey = params.periodStart
    ? `sub_expire_${params.subscriptionId}_${Math.floor(params.periodStart / 86400000)}`
    : `sub_expire_${params.subscriptionId}`

  const client = (await import("@/lib/db/mongodb")).getMongoClient
  const mongoClient = await client()
  const session = mongoClient.startSession()

  try {
    let success = false

    await session.withTransaction(async () => {
      // Idempotency check
      const existingLedger = await (await creditLedgerCol()).findOne({ idempotencyKey }, { session })
      if (existingLedger) {
        logger.info("credit.expire", "Expiration already recorded (idempotent)", { idempotencyKey })
        success = true
        return
      }

      // Re-read the user inside the transaction to get the latest bucket state
      const freshUser = await users.findOne({ id: params.userId }, { session })
      if (!freshUser) {
        success = false
        return
      }

      // Recalculate amount based on fresh data — bucket may have been partially consumed
      const freshBuckets: import("@/lib/types/db").CreditBucket[] = freshUser.creditBuckets ?? []
      const freshMatchingBucket = freshBuckets.find((b) => b.subscriptionId === params.subscriptionId)
      const freshBalance = await getBalance(params.userId)

      if (freshMatchingBucket) {
        // Re-derive amount from the fresh bucket state — only expire what's actually in the bucket now
        amount = Math.min(freshMatchingBucket.amount, freshBalance.subscription)
      } else {
        amount = freshBalance.subscription
      }

      if (amount <= 0) {
        // Nothing to expire (bucket already consumed or balance is 0)
        // Record a no-op ledger entry to mark the idempotency key as used
        await recordLedgerEntry({
          userId: params.userId,
          creditType: "subscription",
          amount: 0,
          direction: "debit",
          transactionType: "subscription_expiration",
          referenceType: "subscription",
          referenceId: params.subscriptionId,
          balanceBefore: freshBalance.subscription,
          balanceAfter: freshBalance.subscription,
          idempotencyKey,
          metadata: { ...params.metadata, expiredAmount: 0, hadBucket: Boolean(freshMatchingBucket), reason: "no_credits_to_expire" },
        })
        success = true
        return
      }

      // Debit subscriptionCredits by the bucket amount (not the full balance)
      const filter = { id: params.userId, subscriptionCredits: { $gte: amount } }
      const updateOps: Record<string, unknown> = {
        $inc: { subscriptionCredits: -amount, credits: -amount },
        $set: { updatedAt: Date.now() },
      }

      // Remove the matching bucket from the array if it existed
      if (freshMatchingBucket) {
        (updateOps as Record<string, unknown>).$pull = {
          creditBuckets: { subscriptionId: params.subscriptionId },
        }
      }

      const result = await users.updateOne(filter, updateOps, { session })
      if (result.modifiedCount === 0) {
        // Either the user doesn't exist or subscriptionCredits < amount (race condition)
        // Record the idempotency key anyway to prevent retry loops
        await recordLedgerEntry({
          userId: params.userId,
          creditType: "subscription",
          amount,
          direction: "debit",
          transactionType: "subscription_expiration",
          referenceType: "subscription",
          referenceId: params.subscriptionId,
          balanceBefore: freshBalance.subscription,
          balanceAfter: freshBalance.subscription,
          idempotencyKey,
          metadata: { ...params.metadata, expiredAmount: amount, hadBucket: Boolean(freshMatchingBucket), reason: "update_failed" },
        })
        success = true
        return
      }

      await recordLedgerEntry({
        userId: params.userId,
        creditType: "subscription",
        amount,
        direction: "debit",
        transactionType: "subscription_expiration",
        referenceType: "subscription",
        referenceId: params.subscriptionId,
        balanceBefore: freshBalance.subscription,
        balanceAfter: freshBalance.subscription - amount,
        idempotencyKey,
        metadata: {
          ...params.metadata,
          expiredAmount: amount,
          hadBucket: Boolean(freshMatchingBucket),
        },
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
