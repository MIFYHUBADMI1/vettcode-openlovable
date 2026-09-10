import { requireUser } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { listUserTopUps } from "@/lib/billing/topup-service"

/**
 * @deprecated Legacy top-up API.
 * Mobile Money payments are no longer accepted.
 * All payments now go through Dodo Payments at /api/billing/webhook.
 */

/** List the authenticated user's historical top-ups (read-only). */
export async function GET() {
  try {
    const user = await requireUser()
    const topUps = await listUserTopUps(user.id)
    return ok({ topUps })
  } catch (e) {
    return handleRouteError("api.billing.topup.list", e)
  }
}

/** Create a new top-up — DISABLED. Dodo Payments is now the only payment method. */
export async function POST() {
  return fail(
    "DEPRECATED",
    "Mobile Money top-ups are no longer supported. Please use Dodo Payments to purchase credits at /settings/billing.",
    410,
  )
}
