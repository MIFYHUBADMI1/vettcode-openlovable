import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { autoLaunchBuild } from "@/lib/analysis/pipeline"

/**
 * POST /api/projects/[id]/launch
 *
 * Transitions a project from "plan_ready" → build.
 * Called when the founder clicks "Submit Plan & Start Building" on the
 * Collaborate page. No credits are reserved here — autoLaunchBuild()
 * handles the full credit reservation + Totalum launch flow.
 *
 * AC 9, 10, 12 (Requirement 2).
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser()
    const { id } = await params

    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) {
      return fail("UNAUTHORIZED_PROJECT_ACCESS", "Project not found.", 404)
    }

    // AC 12: 409 if not in plan_ready state
    if (project.state !== "plan_ready") {
      return fail(
        "INVALID_STATE",
        `This project cannot be launched from its current state (${project.state}). It must be in 'plan_ready' state.`,
        409,
      )
    }

    if (!project.specification) {
      return fail("VALIDATION", "This project has no application plan yet.", 409)
    }

    // Transition to awaiting_build_confirmation while autoLaunchBuild runs.
    // autoLaunchBuild will move it to "building" (or keep at plan_ready on failure).
    await store.updateProject(id, { state: "awaiting_build_confirmation" })

    // Fire-and-forget — autoLaunchBuild handles credit reservation, Totalum
    // launch, and all state transitions from awaiting_build_confirmation onward.
    void autoLaunchBuild(id)

    return ok({ state: "awaiting_build_confirmation" })
  } catch (e) {
    return handleRouteError("api.projects.launch", e)
  }
}
