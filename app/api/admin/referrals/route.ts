import { ok, handleRouteError } from "@/lib/api/respond"
import { requireAdmin } from "@/lib/auth/session"
import { getAllReferrals, processMilestoneCheck, processVerificationReward, runFraudChecks } from "@/lib/referrals/referrals"
import { referralsCol, usersCol } from "@/lib/db/collections"
import { readAuthBody } from "@/lib/api/request-body"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { AppError } from "@/lib/errors"

/**
 * GET /api/admin/referrals
 * Admin-only endpoint to list all referrals with user details.
 */
export async function GET(req: Request) {
  try {
    await requireAdmin()

    const url = new URL(req.url)
    const limit = Number(url.searchParams.get("limit") ?? 50)
    const offset = Number(url.searchParams.get("offset") ?? 0)
    if (!Number.isInteger(limit) || limit < 1 || limit > 200 || !Number.isInteger(offset) || offset < 0 || offset > 10_000) throw new AppError("VALIDATION")

    const { referrals, total } = await getAllReferrals(limit, offset)

    // Enrich with user names (privacy: only show names, not emails)
    const userIds = new Set<string>()
    for (const r of referrals) {
      userIds.add(r.referrerUserId)
      userIds.add(r.referredUserId)
    }

    const col = await usersCol()
    const users = await col
      .find({ id: { $in: [...userIds] } })
      .project({ id: 1, name: 1, emailVerified: 1 })
      .toArray()

    const userMap = new Map(users.map((u) => [u.id, { name: u.name, emailVerified: u.emailVerified }]))

    const enriched = referrals.map((r) => ({
      id: r.id,
      referrerUserId: r.referrerUserId,
      referrerName: userMap.get(r.referrerUserId)?.name ?? "Unknown",
      referredUserId: r.referredUserId,
      referredName: userMap.get(r.referredUserId)?.name ?? "Unknown",
      referredEmailVerified: userMap.get(r.referredUserId)?.emailVerified ?? false,
      referralCode: r.referralCode,
      status: r.status,
      verificationRewardIssued: r.verificationRewardIssued,
      milestoneRewardIssued: r.milestoneRewardIssued,
      eligibleUsage: r.eligibleUsage,
      fraudFlags: r.fraudFlags,
      createdAt: r.createdAt,
    }))

    return ok({ referrals: enriched, total })
  } catch (e) {
    return handleRouteError("api.admin.referrals", e)
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin()
    await checkRateLimit({ action: "referral_review", identifier: admin.id, limit: 30, windowMs: 60_000 })
    const body = await readAuthBody(req)
    if (typeof body.id !== "string" || body.id.length > 100 || !body.id || !["approve", "block"].includes(String(body.decision)) || typeof body.reason !== "string" || body.reason.trim().length < 5 || body.reason.length > 1000) throw new AppError("VALIDATION")
    const decision = body.decision as "approve" | "block"
    await runFraudChecks(body.id)
    const col = await referralsCol()
    const referral = await col.findOne({ id: body.id })
    if (!referral) throw new AppError("VALIDATION", "Referral not found.", 404)
    const now = Date.now()
    const approvedFlags = decision === "approve" ? (referral.fraudFlags ?? []).filter((flag) => !["self_referral", "attribution_mismatch", "circular_referral"].includes(flag)) : []
    await col.updateOne({ _id: referral._id }, { $set: {
      review: { decision, reason: body.reason.trim(), adminId: admin.id, reviewedAt: now, approvedFlags },
      status: decision === "block" ? "blocked" : referral.milestoneRewardIssued ? "milestone_reached" : referral.verificationRewardIssued ? "verified" : "registered",
      updatedAt: now,
    } })
    if (decision === "approve") {
      await processVerificationReward(referral.referredUserId)
      await processMilestoneCheck(referral.referredUserId)
    }
    return ok({ reviewed: true })
  } catch (error) {
    return handleRouteError("api.admin.referrals.review", error)
  }
}
