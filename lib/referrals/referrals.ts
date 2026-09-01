import { ObjectId } from "mongodb"
import { referralsCol, usersCol, creditTransactionsCol, buildRunsCol, ensureIndexes } from "@/lib/db/collections"
import type { ReferralDoc, UserDoc } from "@/lib/types/db"
import { cryptoId } from "@/lib/store/id"
import { logger } from "@/lib/logging/logger"

/**
 * MirrorSite referral system.
 *
 * Business model:
 *   - Referrer gets +500 credits when referred user verifies their account.
 *   - Referrer gets +1,500 credits when referred user reaches 75,000 eligible
 *     application-generation usage (successful builds only).
 *   - Max 2,000 credits per referred user.
 */

const REFERRAL_CODE_PREFIX = "MSA"
const REFERRAL_CODE_LENGTH = 6
const VERIFICATION_REWARD = 500
const MILESTONE_REWARD = 1500
const MILESTONE_THRESHOLD = 75_000

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

/**
 * Award the 500-credit verification reward to the referrer when the
 * referred user verifies their account. Idempotent — safe to call
 * multiple times.
 */export async function processVerificationReward(userId: string): Promise<boolean> {
  await ensureIndexes()

  const col = await usersCol()
  const user = await col.findOne({ id: userId, deletedAt: { $exists: false } })
  if (!user?.emailVerified) return false

  const referrals = await referralsCol()
  const referral = await referrals.findOne({ referredUserId: userId })
  if (!referral) return false // Not referred by anyone
  if (referral.verificationRewardIssued) return false // Already rewarded
  if (referral.referrerUserId === userId) return false // Self-referral safety

  // Check referrer still exists and is not deleted
  const referrer = await col.findOne({ id: referral.referrerUserId, deletedAt: { $exists: false } })
  if (!referrer) {
    logger.warn("referral.verification_reward", "referrer not found", { referralId: referral.id })
    return false
  }

  // Fraud check: if referral is blocked, skip
  if (referral.status === "blocked") return false

  const now = Date.now()

  // Atomically claim the reward — only one call can succeed
  const result = await referrals.findOneAndUpdate(
    { _id: referral._id, verificationRewardIssued: false },
    { $set: { verificationRewardIssued: true, status: "verified", updatedAt: now } },
    { returnDocument: "after" },
  )
  if (!result) return false // Already rewarded (concurrent call won)

  // Grant 500 credits to referrer — direct update, no MongoDB sessions
  await col.updateOne(
    { id: referral.referrerUserId },
    { $inc: { credits: VERIFICATION_REWARD }, $set: { updatedAt: now } },
  )

  // Record credit transaction
  const txCol = await creditTransactionsCol()
  const { ObjectId } = await import("mongodb")
  await txCol.insertOne({
    _id: new ObjectId(),
    id: cryptoId(),
    userId: referral.referrerUserId,
    type: "grant",
    amount: VERIFICATION_REWARD,
    reason: "Referral verification reward",
    createdAt: now,
  })

  logger.info("referral.verification_reward", "awarded", {
    referralId: referral.id,
    referrerUserId: referral.referrerUserId,
    referredUserId: userId,
    credits: VERIFICATION_REWARD,
  })

  return true
}

// ─── Milestone Reward ───────────────────────────────────────────────────────

/**
 * Calculate and update the eligible usage for a referred user, then
 * check if the 75k milestone has been reached.
 *
 * Called when a build run succeeds. The qualifying usage amount should
 * be the credits consumed on that successful build.
 */
export async function processMilestoneCheck(
  referredUserId: string,
  additionalUsage: number,
): Promise<boolean> {
  await ensureIndexes()

  const referrals = await referralsCol()
  const referral = await referrals.findOne({ referredUserId })
  if (!referral) return false
  if (referral.milestoneRewardIssued) return false
  if (referral.status === "blocked") return false
  if (referral.referrerUserId === referredUserId) return false

  const col = await usersCol()

  // Check referrer still exists
  const referrer = await col.findOne({ id: referral.referrerUserId, deletedAt: { $exists: false } })
  if (!referrer) return false

  const now = Date.now()
  const updatedUsage = referral.eligibleUsage + additionalUsage

  if (updatedUsage >= MILESTONE_THRESHOLD) {
    // Atomically claim the milestone reward — only one call can succeed
    const result = await referrals.findOneAndUpdate(
      { _id: referral._id, milestoneRewardIssued: false },
      { $set: { milestoneRewardIssued: true, eligibleUsage: updatedUsage, status: "milestone_reached", updatedAt: now } },
      { returnDocument: "after" },
    )
    if (!result) {
      // Already rewarded — just update usage counter
      await referrals.updateOne(
        { _id: referral._id },
        { $set: { eligibleUsage: updatedUsage, updatedAt: now } },
      )
      return false
    }

    // Award 1500 credits to referrer — direct update, no MongoDB sessions
    await col.updateOne(
      { id: referral.referrerUserId },
      { $inc: { credits: MILESTONE_REWARD }, $set: { updatedAt: now } },
    )

    const txCol = await creditTransactionsCol()
    const { ObjectId } = await import("mongodb")
    await txCol.insertOne({
      _id: new ObjectId(),
      id: cryptoId(),
      userId: referral.referrerUserId,
      type: "grant",
      amount: MILESTONE_REWARD,
      reason: "Referral usage milestone (75k)",
      createdAt: now,
    })

    logger.info("referral.milestone_reward", "awarded", {
      referralId: referral.id,
      referrerUserId: referral.referrerUserId,
      referredUserId,
      credits: MILESTONE_REWARD,
    })
    return true
  }

  // Below threshold — just update usage counter
  await referrals.updateOne(
    { _id: referral._id },
    { $set: { eligibleUsage: updatedUsage, updatedAt: now } },
  )
  return false
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
      { $set: { fraudFlags: flags, updatedAt: Date.now() } },
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
  for (const r of all) {
    if (r.verificationRewardIssued) totalCreditsEarned += VERIFICATION_REWARD
    if (r.milestoneRewardIssued) totalCreditsEarned += MILESTONE_REWARD
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
