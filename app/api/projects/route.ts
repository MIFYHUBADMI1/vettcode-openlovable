import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, handleRouteError } from "@/lib/api/respond"
import { createUserProject, type CreateProjectInput } from "@/lib/projects/create-project"
import { singleFlight } from "@/lib/cache/single-flight"

/**
 * Returns the list of projects for the authenticated user.
 *
 * Single-flight deduplication prevents thundering herds when many SWR clients
 * revalidate simultaneously.
 */
export async function GET() {
  try {
    const user = await requireUser()

    const fetcher = singleFlight<Response>(`api.projects:${user.id}`)
    return fetcher(async () => {
      const projects = await store.listProjects(user.id)
      // Return lightweight summaries for the list view.
      return ok({
        projects: projects.map((p) => ({
          id: p.id,
          name: p.name,
          mode: p.mode,
          state: p.state,
          sourceUrl: p.sourceUrl,
          updatedAt: p.updatedAt,
          thumbnailUrl: p.understanding?.screenshots?.[0] ?? null,
        })),
      })
    })
  } catch (e) {
    return handleRouteError("api.projects.list", e)
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const body = (await req.json().catch(() => ({}))) as CreateProjectInput
    const result = await createUserProject(user.id, body)
    if ("error" in result && result.error) return result.error
    return ok({ project: result.project, reused: result.reused }, { status: result.reused ? 200 : 201 })
  } catch (e) {
    return handleRouteError("api.projects.create", e)
  }
}
