import { getCurrentUser } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import {
  savePendingStartServer,
  readPendingStartServer,
  clearPendingStartServer,
} from "@/lib/start/pending-store"
import type { PendingStart } from "@/lib/auth/client-intent"

export async function GET() {
  try {
    const user = await getCurrentUser()
    const pending = await readPendingStartServer(user?.id)
    return ok({ pending })
  } catch (e) {
    return handleRouteError("api.start.pending.get", e)
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    const body = (await req.json().catch(() => ({}))) as PendingStart
    if (!body?.prompt?.trim() || !body.href?.startsWith("/") || body.href.startsWith("//")) {
      return fail("VALIDATION", "A valid pending start is required.", 422)
    }
    await savePendingStartServer(body, user?.id)
    return ok({ saved: true })
  } catch (e) {
    return handleRouteError("api.start.pending.save", e)
  }
}

export async function DELETE() {
  try {
    await clearPendingStartServer()
    return ok({ cleared: true })
  } catch (e) {
    return handleRouteError("api.start.pending.clear", e)
  }
}
