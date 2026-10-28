import { ObjectId } from "mongodb"
import { referralsCol, usersCol, buildRunsCol, ensureIndexes } from "@/lib/db/collections"
import type { ReferralDoc, UserDoc } from "@/lib/types/db"
import { cryptoId } from "@/lib/store/id"
import { logger } from "@/lib/logging/logger"
import { grantCredits } from "@/lib/billing/credit-service"
import { getMongoClient } from "@/lib/db/mongodb"

/**
 * Atai referral system.
 *
 * Business model:
 *   - Referrer gets +500 credits when referred user verifies their account.
 *   - Referrer gets +1,500 credits when referred user reaches 75,000 eligible
 *     application-generation usage (successful builds only).
 *   - Max 2,000 credits per referred user.
 */

const REFERRAL_CODE_PREFIX = "MSA"
const REFERRAL_CODE_LENGTH = 6
/** Legacy fallback constants — live values come from admin-configurable
 * runtime settings (lib/billing/runtime-config.ts) at grant time. */
const VERIFICATION_REWARD = 500
const MILESTONE_REWARD = 1500
const MILESTONE_THRESHOLD = 75_000

/** Resolve the current admin-configured reward values. */
async function getRuntimeRewards() {
  const { getRewardSettings } = await import("@/lib/billing/runtime-config")
  try {
    return await getRewardSettings()
  } catch {
    return {
      referralVerificationReward: VERIFICATION_REWARD,
      referralMilestoneReward: MILESTONE_REWARD,
      referralMilestoneThreshold: MILESTONE_THRESHOLD,
    }
  }
}

// ─── Referral Code Generation ───────────────────────────────────────────────

/**
 * Generate a unique referral code in the format MSA-XXXXXX.
 * Uses alphanumeric characters (uppercase) excluding ambiguous chars (0, O, I, L).
 */
function generateReferralCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return `${REFERRAL_CODE_PREFIX}-${code}`
}

/**
 * Ensure the user has a referral code. Generates one if missing.
 * Safe to call repeatedly — idempotent.
 */
export async function ensureReferralCode(userId: string): Promise<string> {
  const col = await usersCol()
  const user = await col.findOne({ id: userId, deletedAt: { $exists: false } })
  if (!user) throw new Error("User not found")

  if (user.referralCode) return user.referralCode

  // Generate a unique code (retry on collision)
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateReferralCode()
    const existing = await col.findOne({ referralCode: code, deletedAt: { $exists: false } })
    if (!existing) {
      await col.updateOne({ id: userId }, { $set: { referralCode: code, updatedAt: Date.now() } })
      return code
    }
  }
  throw new Error("Failed to generate unique referral code after multiple attempts")
}

/**
 * Resolve a referral code to a user ID. Returns null if invalid.
 */
export async function resolveReferralCode(code: string): Promise<UserDoc | null> {
  const col = await usersCol()
  return col.findOne({ referralCode: code, deletedAt: { $exists: false } })
}

// ─── Referral Relationship ──────────────────────────────────────────────────

/**
 * Establish a referral relationship during registration.
 * - Validates the referral code exists and resolves to a different user.
 * - Prevents self-referral.
 * - Prevents overwriting an existing referral.
 * - Records the relationship in the referrals collection.
 *
 * Returns the referral doc if created, null if no valid referral.
 */
export async function captureReferral(
  referredUserId: string,
  referralCode: string,
): Promise<ReferralDoc | null> {
  await ensureIndexes()
  console.log("[referral] captureReferral: starting", { referredUserId, referralCode })

  // Resolve the code
  const referrer = await resolveReferralCode(referralCode)
  console.log("[referral] captureReferral: resolveReferralCode result", { found: !!referrer, referrerId: referrer?.id })
  if (!referrer) {
    console.warn("[referral] captureReferral: invalid referral code", { referredUserId, referralCode })
    return null
  }

  // Self-referral protection
  if (referrer.id === referredUserId) {
    logger.warn("referral.capture", "self-referral attempt blocked", { referredUserId, referralCode })
    return null
  }

  const referrals = await referralsCol()

  // Check if the referred user already has a referral (one referrer per user)
  const existing = await referrals.findOne({ referredUserId })
  if (existing) {
    logger.info("referral.capture", "referral already exists, not overwriting", { referredUserId })
    return null
  }

  // Fraud check: basic circular referral detection
  // Check if the referrer was referred by the same user (A→B→A loop)
  const referrerDoc = await (await usersCol()).findOne({ id: referrer.id })
  if (referrerDoc?.referredBy === referredUserId) {
    logger.warn("referral.capture", "circular referral detected", { referredUserId, referrerUserId: referrer.id })
    return null
  }

  const now = Date.now()
  const doc: ReferralDoc = {
    _id: new ObjectId(),
    id: cryptoId(),
    referrerUserId: referrer.id,
    referredUserId,
    referralCode,
    status: "registered",
    verificationRewardIssued: false,
    milestoneRewardIssued: false,
    eligibleUsage: 0,
    createdAt: now,
    updatedAt: now,
  }

  await referrals.insertOne(doc)
  console.log("[referral] captureReferral: referral inserted", { referralId: doc.id, referrerUserId: referrer.id, referredUserId })

  // Also set referredBy on the user document
  const col = await usersCol()
  await col.updateOne({ id: referredUserId }, { $set: { referredBy: referrer.id, updatedAt: now } })
  console.log("[referral] captureReferral: user referredBy set", { referredUserId, referredBy: referrer.id })

  logger.info("referral.capture", "referral created", {
    referralId: doc.id,
    referrerUserId: referrer.id,
    referredUserId,
  })

  return doc
}

// ─── Verification Reward ────────────────────────────────────────────────────

export async function processVerificationReward(userId: string): Promise<boolean> {
  return processReward(userId, "verification")
}

export async function processMilestoneCheck(referredUserId: string): Promise<boolean> {
  return processReward(referredUserId, "milestone")
}

async function processReward(referredUserId: string, kind: "verification" | "milestone"): Promise<boolean> {
  await ensureIndexes()
  const referrals = await referralsCol()
  const users = await usersCol()
  const rewards = await getRuntimeRewards()
  const session = (await getMongoClient()).startSession()
  const issued = kind === "verification" ? "verificationRewardIssued" : "milestoneRewardIssued"
  try {
    return await session.withTransaction(async () => {
      const referral = await referrals.findOne({ referredUserId }, { session })
      if (!referral || referral[issued] || referral.status === "blocked") return false
      const user = await users.findOne({ id: referredUserId, deletedAt: { $exists: false }, banned: { $ne: true }, suspended: { $ne: true } }, { session })
      const referrer = await users.findOne({ id: referral.referrerUserId, deletedAt: { $exists: false }, banned: { $ne: true }, suspended: { $ne: true } }, { session })
      if (!user?.emailVerified || !referrer) return false
      const flags = new Set(referral.fraudFlags ?? [])
      if (referrer.id === referredUserId) flags.add("self_referral")
      if (user.referredBy !== referrer.id) flags.add("attribution_mismatch")
      if (referrer.referredBy === referredUserId) flags.add("circular_referral")
      const count = await referrals.countDocuments({ referrerUserId: referrer.id }, { session })
      if (count > 20) flags.add("high_referral_count")
      const approved = new Set(referral.review?.decision === "approve" ? referral.review.approvedFlags : [])
      const hardFlags = new Set(["self_referral", "attribution_mismatch", "circular_referral"])
      if ([...flags].some((flag) => hardFlags.has(flag) || !approved.has(flag))) {
        await referrals.updateOne({ _id: referral._id }, { $set: { fraudFlags: [...flags], updatedAt: Date.now() } }, { session })
        logger.warn("referral.reward_deferred", "Referral requires review before rewards", { referralId: referral.id })
        return false
      }
      let eligibleUsage = referral.eligibleUsage
      if (kind === "milestone") {
        // Recompute from unique successful runs so duplicate poll/webhook events add nothing.
        const usage = await (await buildRunsCol()).aggregate<{ total: number }>([
          { $match: { userId: referredUserId, status: "succeeded", startedAt: { $gte: referral.createdAt } } },
          { $group: { _id: null, total: { $sum: { $max: [0, { $ifNull: ["$creditsConsumed", "$creditsReserved"] }] } } } },
        ], { session }).toArray()
        eligibleUsage = usage[0]?.total ?? 0
        await referrals.updateOne({ _id: referral._id }, { $set: { eligibleUsage, updatedAt: Date.now() } }, { session })
        if (eligibleUsage < rewards.referralMilestoneThreshold) return false
      }
      const claim = await referrals.findOneAndUpdate(
        { _id: referral._id, [issued]: false, status: { $ne: "blocked" } },
        { $set: { [issued]: true, status: kind === "milestone" ? "milestone_reached" : referral.milestoneRewardIssued ? "milestone_reached" : "verified", updatedAt: Date.now() } },
        { session, returnDocument: "after" },
      )
      if (!claim) return false
      const grant = await grantCredits({
        userId: referrer.id,
        amount: kind === "verification" ? rewards.referralVerificationReward : rewards.referralMilestoneReward,
        creditType: "permanent",
        transactionType: "referral_bonus",
        idempotencyKey: `referral_${kind}_${referral.id}`,
        metadata: { reason: kind === "verification" ? "Referral verification reward" : "Referral usage milestone", referredUserId, eligibleUsage },
        session,
      })
      if (!grant.success) throw new Error("Referral reward was not committed")
      return true
    }) ?? false
  } finally {
    await session.endSession()
  }
}

/**
 * Check if a build run qualifies for the milestone calculation.
 * Returns the credits consumed if the build succeeded, 0 otherwise.
 */
export async function getQualifyingBuildUsage(buildRunId: string): Promise<number> {
  const col = await buildRunsCol()
  const run = await col.findOne({ id: buildRunId })
  if (!run) return 0
  if (run.status !== "succeeded") return 0
  return run.creditsConsumed ?? 0
}

// ─── Fraud Detection ────────────────────────────────────────────────────────

/**
 * Run basic fraud checks on a referral and flag if suspicious.
 * Returns a list of fraud flags (empty = clean).
 */
export async function runFraudChecks(referralId: string): Promise<string[]> {
  const referrals = await referralsCol()
  const referral = await referrals.findOne({ id: referralId })
  if (!referral) return []

  const flags: string[] = []

  // Check: multiple referrals from the same IP pattern (heuristic)
  // Check: referral chain (A referred B, B referred C, C referred A)
  const col = await usersCol()
  const referredUser = await col.findOne({ id: referral.referredUserId })
  if (referredUser?.referredBy) {
    // Check if the referrer was also referred by the same person
    const referrerUser = await col.findOne({ id: referral.referrerUserId })
    if (referrerUser?.referredBy === referral.referredUserId) {
      flags.push("circular_referral")
    }
  }

  // Check: many accounts referred by the same user (potential ring)
  const referrerReferrals = await referrals.countDocuments({
    referrerUserId: referral.referrerUserId,
  })
  if (referrerReferrals > 20) {
    flags.push("high_referral_count")
  }

  if (flags.length > 0) {
    await referrals.updateOne(
      { id: referralId },
      { $addToSet: { fraudFlags: { $each: flags } }, $set: { updatedAt: Date.now() } },
    )
    logger.warn("referral.fraud_check", "flags raised", { referralId, flags })
  }

  return flags
}

// ─── Queries ────────────────────────────────────────────────────────────────

/** Get a user's referral code (generating one if needed). */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  return ensureReferralCode(userId)
}

/** Get all referrals where the user is the referrer. */
export async function getReferralsByReferrer(referrerUserId: string): Promise<ReferralDoc[]> {
  const col = await referralsCol()
  return col.find({ referrerUserId }).sort({ createdAt: -1 }).toArray()
}

/** Get the referral where the user is the referred person. */
export async function getReferralByReferred(referredUserId: string): Promise<ReferralDoc | null> {
  const col = await referralsCol()
  return col.findOne({ referredUserId })
}

/** Get referral statistics for a referrer. */
export async function getReferralStats(referrerUserId: string) {
  const col = await referralsCol()

  const all = await col.find({ referrerUserId }).toArray()

  const successful = all.filter((r) => r.status === "verified" || r.status === "active" || r.status === "milestone_reached")
  const pending = all.filter((r) => r.status === "registered")

  let totalCreditsEarned = 0
  const rewards = await getRuntimeRewards()
  for (const r of all) {
    if (r.verificationRewardIssued) totalCreditsEarned += rewards.referralVerificationReward
    if (r.milestoneRewardIssued) totalCreditsEarned += rewards.referralMilestoneReward
  }

  return {
    totalReferrals: all.length,
    successfulReferrals: successful.length,
    pendingReferrals: pending.length,
    verificationRewards: all.filter((r) => r.verificationRewardIssued).length,
    milestoneRewards: all.filter((r) => r.milestoneRewardIssued).length,
    totalCreditsEarned,
  }
}

/** Get all referrals (admin only). */
export async function getAllReferrals(limit = 100, offset = 0) {
  const col = await referralsCol()
  const total = await col.countDocuments()
  const referrals = await col.find({}).sort({ createdAt: -1 }).skip(offset).limit(limit).toArray()
  return { referrals, total }
}

export { VERIFICATION_REWARD, MILESTONE_REWARD, MILESTONE_THRESHOLD }
