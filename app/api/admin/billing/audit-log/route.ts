import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/auth/session"
import { ok, handleRouteError } from "@/lib/api/respond"
import { creditLedgerCol, topupsCol, usersCol } from "@/lib/db/collections"

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = request.nextUrl
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500)
    const offset = parseInt(searchParams.get("offset") ?? "0", 10)
    const type = searchParams.get("type") ?? ""
    const userId = searchParams.get("userId") ?? ""
    const search = searchParams.get("search") ?? ""

    const ledgerCol = await creditLedgerCol()

    // Build query - use ledger schema
    const query: Record<string, unknown> = {}
    if (type) query.transactionType = type
    if (userId) query.userId = userId

    // Get total count
    const total = await ledgerCol.countDocuments(query)

    // Get ledger entries
    const entries = await ledgerCol
      .find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray()

    // Enrich with user info
    const userIds = [...new Set(entries.map((entry) => entry.userId))]
    const users = await usersCol()
    const userDocs = userIds.length > 0
      ? await users.find({ id: { $in: userIds } }).project({ id: 1, name: 1, email: 1 }).toArray()
      : []
    const userMap = new Map(userDocs.map((u) => [u.id, u]))

    // Get top-up details for purchase transactions
    const topUpIds = entries
      .filter((entry) => entry.transactionType === "credit_purchase" && entry.referenceId)
      .map((entry) => entry.referenceId)
      .filter(Boolean) as string[]
    const topUps = topUpIds.length > 0
      ? await (await topupsCol()).find({ id: { $in: topUpIds } }).toArray()
      : []
    const topUpMap = new Map(topUps.map((t) => [t.id, t]))

    let enriched = entries.map((entry) => {
      const u = userMap.get(entry.userId)
      const topUp = entry.referenceType === "topup" ? topUpMap.get(entry.referenceId || "") : undefined
      return {
        id: entry.id,
        userId: entry.userId,
        userName: u?.name,
        userEmail: u?.email,
        type: entry.transactionType,
        amount: entry.direction === "credit" ? entry.amount : -entry.amount,
        reason: entry.metadata?.reason as string || entry.transactionType,
        buildRunId: entry.metadata?.buildId as string,
        createdAt: entry.createdAt,
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
