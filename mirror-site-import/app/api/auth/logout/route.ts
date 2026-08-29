import { destroyCurrentSession } from "@/lib/auth/session"
import { ok, handleRouteError } from "@/lib/api/respond"

export async function POST() {
  try {
    await destroyCurrentSession()
    return ok({ success: true })
  } catch (e) {
    return handleRouteError("api.auth.logout", e)
  }
}
