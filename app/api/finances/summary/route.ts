import { ok, handleRouteError } from "@/lib/api/respond"
import { requireUser } from "@/lib/auth/session"
import { getPortfolioSpendTrend } from "@/lib/finances/platform-finances"

/**
 * Portfolio spending trend for the home dashboard mini-card (server
 * -authoritative): one bounded aggregation over all of the signed-in user's
 * owned projects — UTC day buckets, zero-filled, plus the week-over-window
 * comparison. The browser only renders these numbers; it never computes a
 * total or a trend itself.
 */
export async function GET() {
  try {
    const user = await requireUser()
    const trend = await getPortfolioSpendTrend(user.id)
    return ok(trend)
  } catch (e) {
    return handleRouteError("api.finances.summary", e)
  }
}
