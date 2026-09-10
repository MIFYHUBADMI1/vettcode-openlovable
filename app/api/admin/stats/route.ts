import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/session"
import { ok, handleRouteError } from "@/lib/api/respond"
import { usersCol, projectsCol, buildRunsCol, creditLedgerCol, topupsCol, publishEventsCol, referralsCol } from "@/lib/db/collections"

interface OnboardingBreakdown {
  label: string
  count: number
}

interface AdminStats {
  users: {
    total: number
    verified: number
    admins: number
    newToday: number
    newThisWeek: number
  }
  credits: {
    totalHeld: number
    totalGranted: number
    totalCharged: number
    totalRefunded: number
  }
  projects: {
    total: number
    building: number
    ready: number
    failed: number
    byMode: { website: number; scratch: number }
  }
  builds: {
    total: number
    running: number
    succeeded: number
    failed: number
  }
  topUps: {
    pending: number
    approved: number
    rejected: number
    totalAmount: number
  }
  onboarding: {
    completed: number
    bySource: OnboardingBreakdown[]
    byRole: OnboardingBreakdown[]
    bySignalType: OnboardingBreakdown[]
  }
  publishing: {
    total: number
    succeeded: number
    failed: number
    creditsSpent: number
    avgDurationMs: number
    byDay: { date: string; count: number; succeeded: number }[]
    recentEvents: { id: string; projectName: string; status: string; createdAt: number; durationMs?: number }[]
  }
  referrals: {
    total: number
    verificationRewards: number
    milestoneRewards: number
    totalCreditsAwarded: number
  }
  infrastructure: {
    totalManaged: number
    byPlan: { planId: string; planName: string; count: number }[]
    totalStorageUsed: number
    totalStorageCapacity: number
    totalInfraUsed: number
    totalInfraCap: number
    projectsNearStorageLimit: number
    projectsOverStorageLimit: number
    projectsNearInfraLimit: number
    expiredSubscriptions: number
    syncFailures: number
    totalInfraRevenue: number
    estimatedInfraCost: number
    estimatedGrossProfit: number
  }
}

/** Admin endpoint: system stats for the dashboard overview. */

// ─── In-process stats cache ───────────────────────────────────────────────────
// The stats endpoint fires 25+ parallel DB queries and is called on every admin
// dashboard load/refresh. A 60-second in-process cache cuts connection-pool
// pressure dramatically at no cost to data freshness for an admin overview.
// Filtered (date-range) queries use a shorter 30-second TTL.
interface CacheEntry {
  data: AdminStats
  expiresAt: number
}
const statsCache = new Map<string, CacheEntry>()
const CACHE_TTL_DEFAULT_MS = 60_000
const CACHE_TTL_FILTERED_MS = 30_000

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    // Optional date range for onboarding filter
    const { searchParams } = request.nextUrl
    const onboardingFromStr = searchParams.get("onboardingFrom")
    const onboardingToStr = searchParams.get("onboardingTo")
    const onboardingFrom = onboardingFromStr ? new Date(onboardingFromStr).getTime() : undefined
    const onboardingTo = onboardingToStr ? new Date(onboardingToStr).getTime() + 24 * 60 * 60 * 1000 : undefined // end of day
    const hasOnboardingFilter = onboardingFrom || onboardingTo

    // ── Cache lookup ────────────────────────────────────────────────────────
    const cacheKey = `stats:${onboardingFromStr ?? ""}:${onboardingToStr ?? ""}`
    const ttl = hasOnboardingFilter ? CACHE_TTL_FILTERED_MS : CACHE_TTL_DEFAULT_MS
    const cached = statsCache.get(cacheKey)
    if (cached && Date.now() < cached.expiresAt) {
      return ok(cached.data)
    }

    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000

    const [usersCol_, projectsCol_, buildRunsCol_, ledgerCol_, topupsCol_, publishCol_] = await Promise.all([
      usersCol(),
      projectsCol(),
      buildRunsCol(),
      creditLedgerCol(),
      topupsCol(),
      publishEventsCol(),
    ])

    // Run all counts in parallel
    const [
      totalUsers,
      verifiedUsers,
      adminUsers,
      newUsersToday,
      newUsersWeek,
      totalProjects,
      buildingProjects,
      readyProjects,
      failedProjects,
      websiteProjects,
      scratchProjects,
      totalBuilds,
      runningBuilds,
      succeededBuilds,
      failedBuilds,
      pendingTopUps,
      approvedTopUps,
      rejectedTopUps,
    ] = await Promise.all([
      usersCol_.countDocuments({ deletedAt: { $exists: false } }),
      usersCol_.countDocuments({ deletedAt: { $exists: false }, emailVerified: true }),
      usersCol_.countDocuments({ deletedAt: { $exists: false }, isAdmin: true }),
      usersCol_.countDocuments({ deletedAt: { $exists: false }, createdAt: { $gte: oneDayAgo } }),
      usersCol_.countDocuments({ deletedAt: { $exists: false }, createdAt: { $gte: oneWeekAgo } }),
      projectsCol_.countDocuments({}),
      projectsCol_.countDocuments({ state: "building" }),
      projectsCol_.countDocuments({ state: "ready" }),
      projectsCol_.countDocuments({ state: { $in: ["build_failed", "deployment_failed"] } }),
      projectsCol_.countDocuments({ mode: "website" }),
      projectsCol_.countDocuments({ mode: "scratch" }),
      buildRunsCol_.countDocuments({}),
      buildRunsCol_.countDocuments({ status: "running" }),
      buildRunsCol_.countDocuments({ status: "succeeded" }),
      buildRunsCol_.countDocuments({ status: "failed" }),
      topupsCol_.countDocuments({ status: { $in: ["payment_submitted", "analyzing", "manual_review"] } }),
      topupsCol_.countDocuments({ status: "approved" }),
      topupsCol_.countDocuments({ status: { $in: ["rejected", "amount_mismatch", "duplicate"] } }),
    ])

    // Aggregate credit totals from ledger (use direction instead of amount sign)
    const [grantAgg, chargeAgg, refundAgg] = await Promise.all([
      ledgerCol_.aggregate([
        { $match: { direction: "credit" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).toArray(),
      ledgerCol_.aggregate([
        { $match: { direction: "debit" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).toArray(),
      ledgerCol_.aggregate([
        { $match: { transactionType: { $in: ["refund", "build_refund"] } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).toArray(),
    ])

    // Total credits held by all users
    const creditAgg = await usersCol_.aggregate([
      { $match: { deletedAt: { $exists: false } } },
      { $group: { _id: null, total: { $sum: "$credits" } } },
    ]).toArray()

    // Total top-up amount (approved)
    const topUpAmountAgg = await topupsCol_.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: null, total: { $sum: "$expectedAmount" } } },
    ]).toArray()

    // Onboarding analytics — optionally filtered by date range
    const onboardingBaseMatch: Record<string, unknown>[] = [
      { deletedAt: { $exists: false } },
      { "onboarding.completedAt": { $exists: true } },
    ]
    if (onboardingFrom) onboardingBaseMatch.push({ "onboarding.completedAt": { $gte: onboardingFrom } })
    if (onboardingTo) onboardingBaseMatch.push({ "onboarding.completedAt": { $lte: onboardingTo } })

    const onboardingCompleted = await usersCol_.countDocuments({
      $and: onboardingBaseMatch,
    })

    const onboardingSourceMatch: Record<string, unknown>[] = [
      { deletedAt: { $exists: false } },
      { "onboarding.source": { $exists: true, $ne: null } },
    ]
    if (onboardingFrom) onboardingSourceMatch.push({ "onboarding.completedAt": { $gte: onboardingFrom } })
    if (onboardingTo) onboardingSourceMatch.push({ "onboarding.completedAt": { $lte: onboardingTo } })

    const onboardingSourceAgg = await usersCol_.aggregate([
      { $match: { $and: onboardingSourceMatch } },
      { $group: { _id: "$onboarding.source", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]).toArray()

    const onboardingRoleMatch: Record<string, unknown>[] = [
      { deletedAt: { $exists: false } },
      { "onboarding.role": { $exists: true, $ne: null } },
    ]
    if (onboardingFrom) onboardingRoleMatch.push({ "onboarding.completedAt": { $gte: onboardingFrom } })
    if (onboardingTo) onboardingRoleMatch.push({ "onboarding.completedAt": { $lte: onboardingTo } })

    const onboardingRoleAgg = await usersCol_.aggregate([
      { $match: { $and: onboardingRoleMatch } },
      { $group: { _id: "$onboarding.role", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]).toArray()

    const onboardingSignalMatch: Record<string, unknown>[] = [
      { deletedAt: { $exists: false } },
      { "onboarding.signalType": { $exists: true, $ne: null } },
    ]
    if (onboardingFrom) onboardingSignalMatch.push({ "onboarding.completedAt": { $gte: onboardingFrom } })
    if (onboardingTo) onboardingSignalMatch.push({ "onboarding.completedAt": { $lte: onboardingTo } })

    const onboardingSignalAgg = await usersCol_.aggregate([
      { $match: { $and: onboardingSignalMatch } },
      { $group: { _id: "$onboarding.signalType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray()

    // Publishing analytics
    const publishTotal = await publishCol_.countDocuments({})
    const publishSucceeded = await publishCol_.countDocuments({ status: "success" })
    const publishFailed = await publishCol_.countDocuments({ status: "failed" })

    const publishCreditsAgg = await publishCol_.aggregate([
      { $group: { _id: null, total: { $sum: "$creditsCharged" } } },
    ]).toArray()

    const publishAvgDurationAgg = await publishCol_.aggregate([
      { $match: { status: "success", durationMs: { $exists: true, $gt: 0 } } },
      { $group: { _id: null, avg: { $avg: "$durationMs" } } },
    ]).toArray()

    // Publish by day (last 30 days)
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
    const publishByDayAgg = await publishCol_.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$createdAt" } } },
          count: { $sum: 1 },
          succeeded: { $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray()

    // Recent publish events (last 10)
    const recentPublishEvents = await publishCol_
      .find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray()

    // Referral analytics
    const referralsCol_ = await referralsCol()
    const referralsAgg = await referralsCol_.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          verificationRewards: { $sum: { $cond: ["$verificationRewardIssued", 1, 0] } },
          milestoneRewards: { $sum: { $cond: ["$milestoneRewardIssued", 1, 0] } },
          totalCreditsAwarded: {
            $sum: {
              $add: [
                { $cond: ["$verificationRewardIssued", 500, 0] },
                { $cond: ["$milestoneRewardIssued", 1500, 0] },
              ],
            },
          },
        },
      },
    ]).toArray()

    // Infrastructure analytics
    const infraAgg = await projectsCol_.aggregate([
      { $match: { "infrastructure.planId": { $exists: true } } },
      {
        $group: {
          _id: "$infrastructure.planId",
          count: { $sum: 1 },
          storageUsed: { $sum: { $ifNull: ["$infrastructure.storageUsedBytes", 0] } },
          storageLimit: { $sum: { $ifNull: ["$infrastructure.storageLimitBytes", 0] } },
          infraUsed: { $sum: { $ifNull: ["$infrastructure.totalumCreditsUsed", 0] } },
          infraCap: { $sum: { $ifNull: ["$infrastructure.totalumInfrastructureCreditLimit", 0] } },
          overQuota: { $sum: { $cond: ["$infrastructure.overQuota", 1, 0] } },
          syncFailed: { $sum: { $cond: [{ $eq: ["$infrastructure.syncStatus", "failed"] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray()

    const totalManaged = infraAgg.reduce((s, p) => s + p.count, 0)
    const totalStorageUsed = infraAgg.reduce((s, p) => s + p.storageUsed, 0)
    const totalStorageCapacity = infraAgg.reduce((s, p) => s + p.storageLimit, 0)
    const totalInfraUsed = infraAgg.reduce((s, p) => s + p.infraUsed, 0)
    const totalInfraCap = infraAgg.reduce((s, p) => s + p.infraCap, 0)
    const projectsOverStorageLimit = infraAgg.reduce((s, p) => s + p.overQuota, 0)
    const syncFailures = infraAgg.reduce((s, p) => s + p.syncFailed, 0)

    // Projects near limits (>80% storage or >80% infra)
    const projectsNearLimit = await projectsCol_.countDocuments({
      $or: [
        { $expr: { $gt: [{ $divide: [{ $ifNull: ["$infrastructure.storageUsedBytes", 0] }, { $max: [{ $ifNull: ["$infrastructure.storageLimitBytes", 1] }, 1] }] }, 0.8] } },
        { $expr: { $gt: [{ $divide: [{ $ifNull: ["$infrastructure.totalumCreditsUsed", 0] }, { $max: [{ $ifNull: ["$infrastructure.totalumInfrastructureCreditLimit", 1] }, 1] }] }, 0.8] } },
      ],
      "infrastructure.planId": { $exists: true },
    })

    // Expired subscriptions
    const expiredSubscriptions = await projectsCol_.countDocuments({
      "infrastructure.planId": { $exists: true, $ne: "testing" },
      "infrastructure.expiresAt": { $lt: now },
    })

    // Infrastructure revenue (credit deductions with infrastructure in reason from ledger)
    const infraRevenueAgg = await ledgerCol_.aggregate([
      { $match: { direction: "debit", "metadata.reason": { $regex: /Infrastructure plan/i } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]).toArray()
    const totalInfraRevenue = infraRevenueAgg[0]?.total ?? 0

    // Estimated cost: Totalum credits used * cost per credit
    const TOTALUM_CREDIT_COST = 500 // UGX per Totalum credit (internal accounting)
    const estimatedInfraCost = totalInfraUsed * TOTALUM_CREDIT_COST
    const estimatedGrossProfit = totalInfraRevenue - estimatedInfraCost

    const planDistribution = infraAgg.map((p) => ({
      planId: p._id ?? "unknown",
      planName: p._id ?? "Unknown",
      count: p.count,
    }))

    const stats: AdminStats = {
      users: {
        total: totalUsers,
        verified: verifiedUsers,
        admins: adminUsers,
        newToday: newUsersToday,
        newThisWeek: newUsersWeek,
      },
      credits: {
        totalHeld: creditAgg[0]?.total ?? 0,
        totalGranted: grantAgg[0]?.total ?? 0,
        totalCharged: chargeAgg[0]?.total ?? 0,
        totalRefunded: refundAgg[0]?.total ?? 0,
      },
      projects: {
        total: totalProjects,
        building: buildingProjects,
        ready: readyProjects,
        failed: failedProjects,
        byMode: {
          website: websiteProjects,
          scratch: scratchProjects,
        },
      },
      builds: {
        total: totalBuilds,
        running: runningBuilds,
        succeeded: succeededBuilds,
        failed: failedBuilds,
      },
      topUps: {
        pending: pendingTopUps,
        approved: approvedTopUps,
        rejected: rejectedTopUps,
        totalAmount: topUpAmountAgg[0]?.total ?? 0,
      },
      onboarding: {
        completed: onboardingCompleted,
        bySource: onboardingSourceAgg.map((d) => ({ label: d._id ?? "Unknown", count: d.count })),
        byRole: onboardingRoleAgg.map((d) => ({ label: d._id ?? "Unknown", count: d.count })),
        bySignalType: onboardingSignalAgg.map((d) => ({ label: d._id ?? "Unknown", count: d.count })),
      },
      publishing: {
        total: publishTotal,
        succeeded: publishSucceeded,
        failed: publishFailed,
        creditsSpent: publishCreditsAgg[0]?.total ?? 0,
        avgDurationMs: Math.round(publishAvgDurationAgg[0]?.avg ?? 0),
        byDay: publishByDayAgg.map((d) => ({ date: d._id, count: d.count, succeeded: d.succeeded })),
        recentEvents: recentPublishEvents.map((e) => ({
          id: e.id,
          projectName: e.projectName,
          status: e.status,
          createdAt: e.createdAt,
          durationMs: e.durationMs,
        })),
      },
      referrals: {
        total: referralsAgg[0]?.total ?? 0,
        verificationRewards: referralsAgg[0]?.verificationRewards ?? 0,
        milestoneRewards: referralsAgg[0]?.milestoneRewards ?? 0,
        totalCreditsAwarded: referralsAgg[0]?.totalCreditsAwarded ?? 0,
      },
      infrastructure: {
        totalManaged,
        byPlan: planDistribution,
        totalStorageUsed,
        totalStorageCapacity,
        totalInfraUsed,
        totalInfraCap,
        projectsNearStorageLimit: projectsNearLimit,
        projectsOverStorageLimit,
        projectsNearInfraLimit: projectsNearLimit,
        expiredSubscriptions,
        syncFailures,
        totalInfraRevenue,
        estimatedInfraCost,
        estimatedGrossProfit,
      },
    }

    // ── Store in cache, then respond ───────────────────────────────────────
    statsCache.set(cacheKey, { data: stats, expiresAt: Date.now() + ttl })

    return ok(stats)
  } catch (e) {
    return handleRouteError("api.admin.stats", e)
  }
}

/** POST /api/admin/stats — bust the stats cache immediately. */
export async function POST() {
  try {
    await requireAdmin()
    statsCache.clear()
    return NextResponse.json({ ok: true, data: { cleared: true } })
  } catch (e) {
    return handleRouteError("api.admin.stats.bust", e)
  }
}
