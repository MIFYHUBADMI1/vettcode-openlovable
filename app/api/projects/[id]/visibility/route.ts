import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"

/**
 * PATCH /api/projects/:id/visibility
 * Toggle project visibility between public and private.
 * Projects can only be made public if they have been deployed to production.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params

    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) {
      return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    }

    const body = await req.json().catch(() => ({})) as { visibility?: "private" | "public" }

    if (!body.visibility || !["private", "public"].includes(body.visibility)) {
      return fail("VALIDATION", "Visibility must be either 'private' or 'public'.", 422)
    }

    // Check if trying to make public
    if (body.visibility === "public") {
      // Must be in a ready/built state
      const isBuilt = ["ready", "build_complete", "deploying", "deployed"].includes(project.state)

      if (!isBuilt) {
        return fail(
          "BUILD_REQUIRED",
          "You must build your project first before making it public.",
          400
        )
      }
    }

    // Update visibility
    await store.updateProject(id, { visibility: body.visibility })

    return ok({
      visibility: body.visibility,
      message: body.visibility === "public"
        ? "Project is now public and can be viewed by anyone"
        : "Project is now private and only visible to you"
    })
  } catch (e) {
    return handleRouteError("api.projects.visibility", e)
  }
}

/**
 * GET /api/projects/:id/visibility
 * Get current project visibility status.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params

    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) {
      return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    }

    const hasDeployment = project.deploymentHistory?.some(d => d.status === "success")

    return ok({
      visibility: project.visibility || "private",
      canBePublic: hasDeployment,
      reason: hasDeployment ? null : "Project must be deployed to production first"
    })
  } catch (e) {
    return handleRouteError("api.projects.visibility.get", e)
  }
}
