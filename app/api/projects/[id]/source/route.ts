import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { getSourceCode } from "@/lib/integrations/totalum/service"
import { fail, handleRouteError } from "@/lib/api/respond"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    if (!project.totalumProjectId) return fail("SOURCE_NOT_READY", "Build the project before downloading its source.", 409)

    const result = await getSourceCode(project.totalumProjectId)

    if (result.mode === "mongodb" || !result.downloadUrl) {
      return fail("SOURCE_LEGACY_PROJECT", "Source download is not available for legacy projects.", 409)
    }

    return Response.redirect(result.downloadUrl)
  } catch (error) { return handleRouteError("api.projects.source", error) }
}
