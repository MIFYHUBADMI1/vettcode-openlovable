import { destroyCurrentSession } from "@/lib/auth/session"
import { ok, handleRouteError } from "@/lib/api/respond"

export async function POST() {
  try {
    await destroyCurrentSession()
    // Clear-Site-Data instructs the browser to wipe its HTTP cache, cookies,
    // and storage for this origin — preventing stale authenticated responses
    // from being served after the session cookie has been destroyed.
    return ok({ success: true }, {
      headers: {
        "Clear-Site-Data": '"cache", "cookies"',
        "Cache-Control": "no-store",
      },
    })
  } catch (e) {
    return handleRouteError("api.auth.logout", e)
  }
}
