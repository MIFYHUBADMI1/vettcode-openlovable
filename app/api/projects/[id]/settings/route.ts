import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { updateProject as totalumUpdateProject, isTotalumConfigured } from "@/lib/integrations/totalum/service"

/**
 * PATCH /api/projects/:id/settings
 * Update project metadata (label, description) on Totalum and locally.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)

    const body = (await req.json().catch(() => ({}))) as { label?: string | null; description?: string | null; name?: string }
    const patch: Record<string, unknown> = {}

    // Update name locally
    if (body.name !== undefined && body.name.trim().length > 0) {
      patch.name = body.name.trim()
    }

    // Update Totalum project metadata if connected
    if (project.totalumProjectId && isTotalumConfigured()) {
      const totalumPatch: { label?: string | null; description?: string | null } = {}
      if (body.label !== undefined) totalumPatch.label = body.label
      if (body.description !== undefined) totalumPatch.description = body.description

      if (Object.keys(totalumPatch).length > 0) {
        try {
          await totalumUpdateProject(project.totalumProjectId, totalumPatch)
        } catch (err) {
          // Non-fatal: local update still goes through
          console.error("[settings] Totalum update failed (non-fatal)", err)
        }
      }
    }

    if (Object.keys(patch).length === 0) return fail("VALIDATION", "No changes provided.", 422)

    const updated = await store.updateProject(id, patch)
    return ok({ project: updated })
  } catch (e) {
    return handleRouteError("api.projects.settings", e)
  }
}
