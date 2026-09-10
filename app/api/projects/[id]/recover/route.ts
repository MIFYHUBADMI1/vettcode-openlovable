import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { recoverVersion, isTotalumConfigured } from "@/lib/integrations/totalum/service"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    if (!project.totalumProjectId) return fail("NO_TOTALUM_PROJECT", "This project hasn't been built yet.", 400)
    if (!isTotalumConfigured()) return fail("PROVIDER_NOT_CONFIGURED", "Build service is not connected.", 503)

    const body = (await req.json().catch(() => ({}))) as { versionId?: string }
    if (!body.versionId) return fail("MISSING_VERSION_ID", "versionId is required.", 400)

    const result = await recoverVersion(project.totalumProjectId, body.versionId)
    return ok(result)
  } catch (e) {
    return handleRouteError("api.projects.recover", e)
  }
}
