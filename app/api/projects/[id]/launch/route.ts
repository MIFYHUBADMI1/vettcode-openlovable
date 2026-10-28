import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { getAvailableCredits } from "@/lib/billing/credit-service"
import { ok, fail, failInsufficientCredits, handleRouteError } from "@/lib/api/respond"
import { autoLaunchBuild } from "@/lib/analysis/pipeline"
import { prepareRequestedProjectId } from "@/lib/projects/project-actions"

/**
 * POST /api/projects/[id]/launch
 *
 * Starts a build for a project whose plan is ready, waiting for the launcher
 * to acknowledge the provider handoff. No credits are reserved here —
 * autoLaunchBuild() owns the atomic build-slot claim and the reservation, so
 * this route can safely be replayed after a founder tops up.
 *
 * AC 9, 10, 12 (Requirement 2).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser()
    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as { requestedProjectId?: string }

    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) {
      return fail("UNAUTHORIZED_PROJECT_ACCESS", "Project not found.", 404)
    }

    if (project.totalumProjectId || !["plan_ready", "awaiting_build_confirmation"].includes(project.state)) {
      return fail(
        "INVALID_STATE",
        `This project cannot be launched from its current state (${project.state}). It must be in 'plan_ready' state.`,
        409,
      )
    }

    if (!project.specification) {
      return fail("VALIDATION", "This project has no application plan yet.", 409)
    }

    const preparedProjectId = await prepareRequestedProjectId(project, body.requestedProjectId)
    if (!preparedProjectId.ok) {
      return fail(preparedProjectId.code, preparedProjectId.message, preparedProjectId.status)
    }

    // The launcher claims the build slot atomically; never reopen it with an unconditional state write.
    await autoLaunchBuild(id)
    const updated = await store.getProject(id)
    if (updated?.state === "building") return ok({ state: updated.state })
    if (updated?.creditBlock) {
      const available = await getAvailableCredits(user.id)
      if (available < updated.creditBlock.required) {
        return failInsufficientCredits({ required: updated.creditBlock.required, available })
      }
    }
    return fail("BUILD_NOT_STARTED", "The build could not start. Please try again.", 409)
  } catch (e) {
    return handleRouteError("api.projects.launch", e)
  }
}
