import { requireUser } from "@/lib/auth/session"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { ok, handleRouteError } from "@/lib/api/respond"
import { setVote } from "@/lib/feature-requests/service"

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    await checkRateLimit({ action: "feature-request-vote", identifier: user.id, limit: 60, windowMs: 60 * 60 * 1000 })
    const { id } = await params
    const data = await setVote(id, user.id, true)
    return ok(data)
  } catch (e) {
    return handleRouteError("api.feature-requests.vote", e)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    await checkRateLimit({ action: "feature-request-vote", identifier: user.id, limit: 60, windowMs: 60 * 60 * 1000 })
    const { id } = await params
    const data = await setVote(id, user.id, false)
    return ok(data)
  } catch (e) {
    return handleRouteError("api.feature-requests.unvote", e)
  }
}
