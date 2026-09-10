import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { getBalance } from "@/lib/credits/credits"
import { ok, handleRouteError } from "@/lib/api/respond"

export async function GET() {
  try {
    const user = await requireUser()
    const [balance, transactions] = await Promise.all([getBalance(user.id), store.listTransactions(user.id)])
    return ok({ balance, transactions })
  } catch (error) {
    return handleRouteError("api.credits", error)
  }
}
