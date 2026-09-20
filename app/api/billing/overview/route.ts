import { requireUser } from "@/lib/auth/session"
import { getBalance, getCreditHistory } from "@/lib/billing/credit-service"
import { subscriptionRecordsCol } from "@/lib/db/collections"
import { ok, handleRouteError } from "@/lib/api/respond"

/**
 * GET /api/billing/overview
 *
 * Single endpoint backing the Settings → Billing page:
 * - balance: total credits split by subscription/permanent
 * - history: recent signed credit ledger entries (positive = granted,
 *   negative = consumed) with human-readable reasons
 * - subscription: the user's current (non-terminated) subscription summary,
 *   or null when on the free plan
 */
export async function GET() {
  try {
    const user = await requireUser()

    const [balance, history, subRows] = await Promise.all([
      getBalance(user.id),
      getCreditHistory(user.id, 50),
      (await subscriptionRecordsCol())
        .find({ userId: user.id })
        .sort({ createdAt: -1 })
        .limit(1)
        .toArray(),
    ])

    const sub = subRows[0]
    // Only surface subscriptions that still grant/retain access. Terminated
    // statuses fall through to null so the page renders the Free plan state.
    const ACTIVE_STATUSES = new Set(["trialing", "active", "past_due", "paused", "payment_failed"])
    const subscription =
      sub && ACTIVE_STATUSES.has(sub.status)
        ? {
            planId: sub.planId,
            planName: sub.planName,
            status: sub.status,
            currentPeriodEnd: sub.currentPeriodEnd ?? null,
            cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd),
          }
        : null

    return ok({ balance, history, subscription })
  } catch (e) {
    return handleRouteError("api.billing.overview", e)
  }
}
