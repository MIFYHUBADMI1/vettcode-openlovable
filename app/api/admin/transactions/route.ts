import { requireAdmin } from "@/lib/auth/session"
import { ok, handleRouteError } from "@/lib/api/respond"
import { creditTransactionsCol, usersCol } from "@/lib/db/collections"

interface TransactionItem {
  id: string
  userId: string
  userName?: string
  userEmail?: string
  type: string
  amount: number
  reason: string
  createdAt: number
}

/** Admin endpoint: list all credit transactions across all users. */
export async function GET() {
  try {
    await requireAdmin()
    const txCol = await creditTransactionsCol()
    const transactions = await txCol
      .find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray()

    // Enrich with user info
    const userIds = [...new Set(transactions.map((tx) => tx.userId))]
    const users = await usersCol()
    const userDocs = await users.find({ id: { $in: userIds } }).toArray()
    const userMap = new Map(userDocs.map((u) => [u.id, u]))

    const items: TransactionItem[] = transactions.map((tx) => {
      const u = userMap.get(tx.userId)
      return {
        id: tx.id,
        userId: tx.userId,
        userName: u?.name,
        userEmail: u?.email,
        type: tx.type,
        amount: tx.amount,
        reason: tx.reason,
        createdAt: tx.createdAt,
      }
    })

    return ok({ transactions: items })
  } catch (e) {
    return handleRouteError("api.admin.transactions.list", e)
  }
}
