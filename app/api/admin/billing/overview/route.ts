import { requireAdmin } from "@/lib/auth/session"
import { ok, handleRouteError } from "@/lib/api/respond"
import {
  usersCol,
  creditTransactionsCol,
  projectsCol,
  buildRunsCol,
  paymentRecordsCol,
  subscriptionRecordsCol,
  creditLedgerCol,
} from "@/lib/db/collections"

export async function GET() {
  try {
    await requireAdmin()

    const [usersCol_, txCol_, projectsCol_, buildRunsCol_, payCol_, subCol_, ledgerCol_] = await Promise.all([
      usersCol(),
      creditTransactionsCol(),
      projectsCol(),
      buildRunsCol(),
      paymentRecordsCol(),
      subscriptionRecordsCol(),
      creditLedgerCol(),
    ])

    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000

    // Run all counts in parallel
    const [
      totalUsers,
      totalProjects,
      totalBuilds,
      successfulBuilds,
      failedBuilds,
    ] = await Promise.all([
      usersCol_.countDocuments({ deletedAt: { $exists: false } }),
      projectsCol_.countDocuments({}),
      buildRunsCol_.countDocuments({}),
      buildRunsCol_.countDocuments({ status: "succeeded" }),
      buildRunsCol_.countDocuments({ status: "failed" }),
    ])

    // ── Revenue from Dodo Payments (USD) ──
    const [revenueAgg, revenueTodayAgg, revenueWeekAgg, revenueMonthAgg] = await Promise.all([
      payCol_.aggregate([
        { $match: { status: "succeeded" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).toArray(),
      payCol_.aggregate([
        { $match: { status: "succeeded", createdAt: { $gte: oneDayAgo } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).toArray(),
      payCol_.aggregate([
        { $match: { status: "succeeded", createdAt: { $gte: oneWeekAgo } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).toArray(),
      payCol_.aggregate([
        { $match: { status: "succeeded", createdAt: { $gte: oneMonthAgo } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).toArray(),
    ])

    // ── Payment counts ──
    const [totalPayments, successfulPayments, failedPayments, refundedPayments] = await Promise.all([
      payCol_.countDocuments({}),
      payCol_.countDocuments({ status: "succeeded" }),
      payCol_.countDocuments({ status: "failed" }),
      payCol_.countDocuments({ status: "refunded" }),
    ])

    // ── Subscription counts ──
    const [totalSubscriptions, activeSubscriptions, cancelledSubscriptions] = await Promise.all([
      subCol_.countDocuments({}),
      subCol_.countDocuments({ status: "active" }),
      subCol_.countDocuments({ status: "cancelled" }),
    ])

    // ── Credit statistics ──
    const [grantAgg, chargeAgg, refundAgg] = await Promise.all([
      txCol_.aggregate([
        { $match: { amount: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).toArray(),
      txCol_.aggregate([
        { $match: { amount: { $lt: 0 } } },
        { $group: { _id: null, total: { $sum: { $abs: "$amount" } } } },
      ]).toArray(),
      txCol_.aggregate([
        { $match: { type: "refund" } },
        { $group: { _id: null, total: { $sum: { $abs: "$amount" } } } },
      ]).toArray(),
    ])

    // Total credits held
    const creditAgg = await usersCol_.aggregate([
      { $match: { deletedAt: { $exists: false } } },
      { $group: { _id: null, total: { $sum: "$credits" } } },
    ]).toArray()

    // ── Subscription credit breakdown ──
    const [subCreditAgg, permCreditAgg] = await Promise.all([
      usersCol_.aggregate([
        { $match: { deletedAt: { $exists: false } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$subscriptionCredits", 0] } } } },
      ]).toArray(),
      usersCol_.aggregate([
        { $match: { deletedAt: { $exists: false } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$permanentCredits", 0] } } } },
      ]).toArray(),
    ])

    // ── Payment by product type ──
    const paymentTypeDistribution = await payCol_.aggregate([
      { $match: { status: "succeeded" } },
      { $group: { _id: "$paymentType", count: { $sum: 1 }, totalRevenue: { $sum: "$amount" } } },
    ]).toArray()

    // ── Revenue by day (last 30 days) ──
    const revenueByDay = await payCol_.aggregate([
      { $match: { status: "succeeded", createdAt: { $gte: oneMonthAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$createdAt" } } },
          count: { $sum: 1 },
          revenue: { $sum: "$amount" },
          credits: { $sum: { $ifNull: ["$creditsGranted", 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray()

    // ── Top users by credits ──
    const topUsers = await usersCol_.find({ deletedAt: { $exists: false } })
      .sort({ credits: -1 })
      .limit(10)
      .project({ id: 1, name: 1, email: 1, credits: 1, subscriptionCredits: 1, permanentCredits: 1 })
      .toArray()

    // ── Transaction type distribution ──
    const transactionTypes = await txCol_.aggregate([
      { $group: { _id: "$type", count: { $sum: 1 }, totalAmount: { $sum: { $abs: "$amount" } } } },
      { $sort: { count: -1 } },
    ]).toArray()

    // ── Build cost analysis ──
    const buildCosts = await txCol_.aggregate([
      { $match: { type: { $in: ["consume", "reserve"] } } },
      { $group: { _id: "$reason", count: { $sum: 1 }, totalCredits: { $sum: { $abs: "$amount" } } } },
      { $sort: { totalCredits: -1 } },
      { $limit: 10 },
    ]).toArray()

    const overview = {
      summary: {
        totalUsers,
        totalProjects,
        totalBuilds,
        successfulBuilds,
        failedBuilds,
        buildSuccessRate: totalBuilds > 0 ? Math.round((successfulBuilds / totalBuilds) * 100) : 0,
      },
      credits: {
        totalHeld: creditAgg[0]?.total ?? 0,
        totalSubscriptionCredits: subCreditAgg[0]?.total ?? 0,
        totalPermanentCredits: permCreditAgg[0]?.total ?? 0,
        totalGranted: grantAgg[0]?.total ?? 0,
        totalCharged: chargeAgg[0]?.total ?? 0,
        totalRefunded: refundAgg[0]?.total ?? 0,
        netCredits: (grantAgg[0]?.total ?? 0) - (chargeAgg[0]?.total ?? 0),
      },
      revenue: {
        total: revenueAgg[0]?.total ?? 0,
        today: revenueTodayAgg[0]?.total ?? 0,
        thisWeek: revenueWeekAgg[0]?.total ?? 0,
        thisMonth: revenueMonthAgg[0]?.total ?? 0,
        currency: "USD",
      },
      payments: {
        total: totalPayments,
        successful: successfulPayments,
        failed: failedPayments,
        refunded: refundedPayments,
      },
      subscriptions: {
        total: totalSubscriptions,
        active: activeSubscriptions,
        cancelled: cancelledSubscriptions,
      },
      paymentTypeDistribution: paymentTypeDistribution.map((p) => ({
        type: p._id ?? "unknown",
        count: p.count,
        totalRevenue: p.totalRevenue,
      })),
      topUsers: topUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        credits: u.credits,
        subscriptionCredits: u.subscriptionCredits ?? 0,
        permanentCredits: u.permanentCredits ?? 0,
      })),
      revenueByDay: revenueByDay.map((d) => ({
        date: d._id,
        count: d.count,
        revenue: d.revenue,
        credits: d.credits,
      })),
      transactionTypes: transactionTypes.map((t) => ({
        type: t._id ?? "unknown",
        count: t.count,
        totalAmount: t.totalAmount,
      })),
      buildCosts: buildCosts.map((b) => ({
        reason: b._id ?? "unknown",
        count: b.count,
        totalCredits: b.totalCredits,
      })),
    }

    return ok(overview)
  } catch (e) {
    return handleRouteError("api.admin.billing.overview", e)
  }
}
