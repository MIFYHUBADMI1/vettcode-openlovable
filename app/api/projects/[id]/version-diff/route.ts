import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { getVersionDiff, isTotalumConfigured } from "@/lib/integrations/totalum/service"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    if (!project.totalumProjectId) return fail("NO_TOTALUM_PROJECT", "This project hasn't been built yet.", 400)
    if (!isTotalumConfigured()) return fail("PROVIDER_NOT_CONFIGURED", "Build service is not connected.", 503)

    const url = new URL(req.url)
    const commitSha = url.searchParams.get("commitSha")
    if (!commitSha) return fail("MISSING_COMMIT_SHA", "commitSha query parameter is required.", 400)

    const result = await getVersionDiff(project.totalumProjectId, commitSha)
    return ok(result)
  } catch (e) {
    return handleRouteError("api.projects.version-diff", e)
  }
}
