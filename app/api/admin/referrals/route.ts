import { ok, handleRouteError } from "@/lib/api/respond"
import { requireAdmin } from "@/lib/auth/session"
import { getAllReferrals } from "@/lib/referrals/referrals"
import { usersCol } from "@/lib/db/collections"

/**
 * GET /api/admin/referrals
 * Admin-only endpoint to list all referrals with user details.
 */
export async function GET(req: Request) {
  try {
    await requireAdmin()

    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200)
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10)

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
