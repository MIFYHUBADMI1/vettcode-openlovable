import { requireAdmin } from "@/lib/auth/session"
import { ok, handleRouteError } from "@/lib/api/respond"
import { creditLedgerCol, usersCol } from "@/lib/db/collections"

interface TransactionItem {
  id: string
  userId: string
  userName?: string
  userEmail?: string
  type: string
  amount: number
  reason: string
  createdAt: number
  // Additional ledger fields (Requirements 5.1-5.15)
  creditType?: string
  direction?: "credit" | "debit"
  balanceBefore?: number
  balanceAfter?: number
}

/** 
 * Admin endpoint: list all credit transactions across all users.
 * Migrated to use credit_ledger collection (Requirements 5.1-5.15)
 */
export async function GET() {
  try {
    await requireAdmin()

    // Requirement 5.1, 5.3: Query credit_ledger collection
    const ledgerCol = await creditLedgerCol()
    const ledgerEntries = await ledgerCol
      .find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray()

    // Requirement 5.13: Enrich with user info
    const userIds = [...new Set(ledgerEntries.map((entry) => entry.userId))]
    const users = await usersCol()
    const userDocs = await users.find({ id: { $in: userIds } }).toArray()
    const userMap = new Map(userDocs.map((u) => [u.id, u]))

    // Requirement 5.4-5.15: Map ledger entries to legacy response format
    const items: TransactionItem[] = ledgerEntries.map((entry) => {
      const u = userMap.get(entry.userId)

      // Requirement 5.8-5.10: Compute signed amount from direction and amount
      const signedAmount = entry.direction === "credit" ? entry.amount : -entry.amount

      // Requirement 5.6-5.7: Map metadata.reason with fallback to transactionType
      const reason = (entry.metadata?.reason as string) || entry.transactionType

      return {
        id: entry.id,
        userId: entry.userId,
        userName: u?.name,
        userEmail: u?.email,
        // Requirement 5.5: Map ledger transactionType to response type
        type: entry.transactionType,
        amount: signedAmount,
        reason: reason,
        createdAt: entry.createdAt,
        // Additional ledger fields for enhanced UI
        creditType: entry.creditType,
        direction: entry.direction,
        balanceBefore: entry.balanceBefore,
        balanceAfter: entry.balanceAfter,
      }
    })

    return ok({ transactions: items })
  } catch (e) {
    return handleRouteError("api.admin.transactions.list", e)
  }
}
