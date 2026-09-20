import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { requireOwnedProject } from "@/lib/runtime/control/owner"
import { getProjectRequestEvents } from "@/lib/runtime/control/analytics"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; requestId: string }> },
) {
  try {
    const { id, requestId } = await params
    const gate = await requireOwnedProject(id)
    if (!gate.ok) return gate.response

    if (!requestId || requestId.length > 200) {
      return fail("VALIDATION", "Invalid request id.", 422)
    }

    const events = await getProjectRequestEvents(id, requestId)
    if (events.length === 0) {
      return fail("NOT_FOUND", "Request not found.", 404)
    }

    return ok({ requestId, events })
  } catch (e) {
    return handleRouteError("api.projects.runtime.request", e)
  }
}
