import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/auth/session"
import { ok, handleRouteError } from "@/lib/api/respond"
import { creditTransactionsCol, topupsCol, usersCol } from "@/lib/db/collections"

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = request.nextUrl
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500)
    const offset = parseInt(searchParams.get("offset") ?? "0", 10)
    const type = searchParams.get("type") ?? ""
    const userId = searchParams.get("userId") ?? ""
    const search = searchParams.get("search") ?? ""

    const txCol = await creditTransactionsCol()

    // Build query
    const query: Record<string, unknown> = {}
    if (type) query.type = type
    if (userId) query.userId = userId

    // Get total count
    const total = await txCol.countDocuments(query)

    // Get transactions
    const transactions = await txCol
      .find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray()

    // Enrich with user info
    const userIds = [...new Set(transactions.map((tx) => tx.userId))]
    const users = await usersCol()
    const userDocs = userIds.length > 0
      ? await users.find({ id: { $in: userIds } }).project({ id: 1, name: 1, email: 1 }).toArray()
      : []
    const userMap = new Map(userDocs.map((u) => [u.id, u]))

    // Get top-up details for purchase transactions
    const topUpIds = transactions
      .filter((tx) => tx.type === "grant" && tx.reason.includes("purchase"))
      .map((tx) => tx.id)
    const topUps = topUpIds.length > 0
      ? await (await topupsCol()).find({ id: { $in: topUpIds } }).toArray()
      : []
    const topUpMap = new Map(topUps.map((t) => [t.id, t]))

    let enriched = transactions.map((tx) => {
      const u = userMap.get(tx.userId)
      const topUp = topUpMap.get(tx.id)
      return {
        id: tx.id,
        userId: tx.userId,
        userName: u?.name,
        userEmail: u?.email,
        type: tx.type,
        amount: tx.amount,
        reason: tx.reason,
        buildRunId: tx.buildRunId,
        createdAt: tx.createdAt,
        topUp: topUp ? {
          id: topUp.id,
          packageId: topUp.packageId,
          credits: topUp.credits,
          expectedAmount: topUp.expectedAmount,
          paymentNetwork: topUp.paymentNetwork,
          status: topUp.status,
        } : undefined,
      }
    })

    // Apply search filter
    if (search) {
      const q = search.toLowerCase()
      enriched = enriched.filter((tx) =>
        tx.userName?.toLowerCase().includes(q) ||
        tx.userEmail?.toLowerCase().includes(q) ||
        tx.reason.toLowerCase().includes(q) ||
        tx.type.toLowerCase().includes(q) ||
        tx.id.toLowerCase().includes(q)
      )
    }

    return ok({
      transactions: enriched,
      total,
      offset,
      limit,
      hasMore: offset + limit < total,
    })
  } catch (e) {
    return handleRouteError("api.admin.billing.audit-log", e)
  }
}
