import { ok, handleRouteError } from "@/lib/api/respond"
import { requireUser } from "@/lib/auth/session"
import { getOrCreateReferralCode, getReferralsByReferrer, getReferralStats } from "@/lib/referrals/referrals"
import { getAppUrl } from "@/lib/env"

/**
 * GET /api/referrals
 * Returns the current user's referral code, link, stats, and referral list.
 */
export async function GET() {
  try {
    const user = await requireUser()

    const referralCode = await getOrCreateReferralCode(user.id)
    const referralLink = `${getAppUrl()}/register?ref=${referralCode}`
    const stats = await getReferralStats(user.id)

    // Get referrals with limited info (privacy-safe)
    const referrals = await getReferralsByReferrer(user.id)
    const referralList = referrals.map((r) => ({
      id: r.id,
      status: r.status,
      verificationRewardIssued: r.verificationRewardIssued,
      milestoneRewardIssued: r.milestoneRewardIssued,
      eligibleUsage: r.eligibleUsage,
      createdAt: r.createdAt,
    }))

    return ok({
      referralCode,
      referralLink,
      stats,
      referrals: referralList,
    })
  } catch (e) {
    return handleRouteError("api.referrals", e)
  }
}
