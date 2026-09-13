import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { singleFlight } from "@/lib/cache/single-flight"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params

    // Use single-flight to deduplicate concurrent requests for the same project
    const fetcher = singleFlight<Response>(`api.projects.activity:${id}`)
    return fetcher(async () => {
      const project = await store.getProject(id)
      if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
      return ok({ events: (project.events ?? []).slice(-100) })
    })
  } catch (error) { return handleRouteError("api.projects.activity", error) }
}
