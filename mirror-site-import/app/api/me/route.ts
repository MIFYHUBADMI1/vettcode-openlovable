import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { getBalance } from "@/lib/credits/credits"
import { isTotalumConfigured } from "@/lib/integrations/totalum/client"
import { isFirecrawlConfigured } from "@/lib/integrations/firecrawl/service"
import { ok, handleRouteError } from "@/lib/api/respond"
import { toPublicUser } from "@/lib/auth/users"

export async function GET() {
  try {
    const user = await requireUser()
    const [balance, transactions] = await Promise.all([getBalance(user.id), store.listTransactions(user.id)])
    return ok({
      user: toPublicUser(user),
      userId: user.id,
      // `reserve` transactions already debit the balance immediately (see
      // lib/credits/credits.ts), so there is no separate "held" pool to
      // subtract — the full balance is available.
      credits: { balance, reserved: 0, available: balance },
      transactions: transactions.slice(0, 20),
      providers: {
        totalum: isTotalumConfigured(),
        firecrawl: isFirecrawlConfigured(),
      },
    })
  } catch (e) {
    return handleRouteError("api.me", e)
  }
}
