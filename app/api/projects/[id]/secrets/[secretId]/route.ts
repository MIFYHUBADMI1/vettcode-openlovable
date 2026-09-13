import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { deleteSecret, isTotalumConfigured } from "@/lib/integrations/totalum/service"

/**
 * DELETE /api/projects/:id/secrets/:secretId
 * Removes a secret from the Totalum project.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; secretId: string }> },
) {
  try {
    const user = await requireUser()
    const { id, secretId } = await params

    const project = await store.getProject(id)
    if (!project || project.userId !== user.id)
      return fail("UNAUTHORIZED_PROJECT_ACCESS", "Project not found.", 404)

    if (!project.totalumProjectId)
      return fail("NOT_BUILT", "This project hasn't been built yet.", 400)

    if (!isTotalumConfigured())
      return fail("PROVIDER_NOT_CONFIGURED", "Build service not connected.", 503)

    await deleteSecret(project.totalumProjectId, secretId)
    return ok({ deleted: true })
  } catch (e) {
    return handleRouteError("api.projects.secrets.delete", e)
  }
}
