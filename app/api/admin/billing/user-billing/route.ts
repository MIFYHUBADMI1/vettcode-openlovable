import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/auth/session"
import { ok, handleRouteError } from "@/lib/api/respond"
import { usersCol, creditTransactionsCol, topupsCol, projectsCol, buildRunsCol } from "@/lib/db/collections"

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = request.nextUrl
    const search = searchParams.get("search") ?? ""
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200)
    const offset = parseInt(searchParams.get("offset") ?? "0", 10)

    const users = await usersCol()
    const txCol = await creditTransactionsCol()
    const topUps = await topupsCol()
    const projects = await projectsCol()
    const buildRuns = await buildRunsCol()

    // Build user query
    const userQuery: Record<string, unknown> = { deletedAt: { $exists: false } }
    if (search) {
      const q = search.toLowerCase()
      userQuery.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { id: { $regex: q, $options: "i" } },
      ]
    }

    const totalUsers = await users.countDocuments(userQuery)

    const userList = await users
      .find(userQuery)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray()

    // Enrich each user with billing data
    const enrichedUsers = await Promise.all(
      userList.map(async (user) => {
        // Credit transactions summary
        const [grantAgg, chargeAgg, refundAgg, recentTx] = await Promise.all([
          txCol.aggregate([
            { $match: { userId: user.id, amount: { $gt: 0 } } },
            { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
          ]).toArray(),
          txCol.aggregate([
            { $match: { userId: user.id, amount: { $lt: 0 } } },
            { $group: { _id: null, total: { $sum: { $abs: "$amount" } }, count: { $sum: 1 } } },
          ]).toArray(),
          txCol.aggregate([
            { $match: { userId: user.id, type: "refund" } },
            { $group: { _id: null, total: { $sum: { $abs: "$amount" } }, count: { $sum: 1 } } },
          ]).toArray(),
          txCol.find({ userId: user.id }).sort({ createdAt: -1 }).limit(5).toArray(),
        ])

        // Top-up history
        const userTopUps = await topUps
          .find({ userId: user.id })
          .sort({ createdAt: -1 })
          .limit(10)
          .toArray()

        // Project stats
        const [totalProjects, activeProjects, failedProjects] = await Promise.all([
          projects.countDocuments({ userId: user.id }),
          projects.countDocuments({ userId: user.id, state: { $in: ["building", "analyzing"] } }),
          projects.countDocuments({ userId: user.id, state: { $in: ["build_failed", "deployment_failed"] } }),
        ])

        // Build stats
        const [totalBuilds, successfulBuilds, totalBuildCredits] = await Promise.all([
          buildRuns.countDocuments({ userId: user.id }),
          buildRuns.countDocuments({ userId: user.id, status: "succeeded" }),
          buildRuns.aggregate([
            { $match: { userId: user.id } },
            { $group: { _id: null, total: { $sum: { $ifNull: ["$creditsCharged", 0] } } } },
          ]).toArray(),
        ])

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          authProvider: user.authProvider,
          emailVerified: user.emailVerified,
          credits: user.credits,
          isAdmin: user.isAdmin,
          suspended: user.suspended,
          banned: user.banned,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          billing: {
            totalGranted: grantAgg[0]?.total ?? 0,
            totalCharged: chargeAgg[0]?.total ?? 0,
            totalRefunded: refundAgg[0]?.total ?? 0,
            grantCount: grantAgg[0]?.count ?? 0,
            chargeCount: chargeAgg[0]?.count ?? 0,
            refundCount: refundAgg[0]?.count ?? 0,
            netCredits: (grantAgg[0]?.total ?? 0) - (chargeAgg[0]?.total ?? 0),
          },
          topUps: {
            total: userTopUps.length,
            approved: userTopUps.filter((t) => t.status === "approved").length,
            pending: userTopUps.filter((t) => ["payment_submitted", "analyzing", "manual_review"].includes(t.status)).length,
            totalSpent: userTopUps
              .filter((t) => t.status === "approved")
              .reduce((sum, t) => sum + t.expectedAmount, 0),
            totalCreditsPurchased: userTopUps
              .filter((t) => t.status === "approved")
              .reduce((sum, t) => sum + t.credits, 0),
            recent: userTopUps.slice(0, 5).map((t) => ({
              id: t.id,
              packageId: t.packageId,
              credits: t.credits,
              expectedAmount: t.expectedAmount,
              paymentNetwork: t.paymentNetwork,
              status: t.status,
              createdAt: t.createdAt,
            })),
          },
          projects: {
            total: totalProjects,
            active: activeProjects,
            failed: failedProjects,
          },
          builds: {
            total: totalBuilds,
            successful: successfulBuilds,
            totalCreditsSpent: totalBuildCredits[0]?.total ?? 0,
            successRate: totalBuilds > 0 ? Math.round((successfulBuilds / totalBuilds) * 100) : 0,
          },
          recentTransactions: recentTx.map((tx) => ({
            id: tx.id,
            type: tx.type,
            amount: tx.amount,
            reason: tx.reason,
            createdAt: tx.createdAt,
          })),
        }
      })
    )

    return ok({
      users: enrichedUsers,
      total: totalUsers,
      offset,
      limit,
      hasMore: offset + limit < totalUsers,
    })
  } catch (e) {
    return handleRouteError("api.admin.billing.user-billing", e)
  }
}
