import { requireUser } from "@/lib/auth/session"
import { store, cryptoId } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { estimateInitialBuild, reserveCredits, refundReservation } from "@/lib/credits/credits"
import { launchProject, isTotalumConfigured } from "@/lib/integrations/totalum/service"
import { buildInitialBuildPrompt } from "@/lib/analysis/prompt-builder"
import { ApplicationSpecificationSchema } from "@/lib/types/specification"
import type { BuildRun, ProjectEvent } from "@/lib/types/project"

function event(stage: string, message: string, level: ProjectEvent["level"] = "info"): ProjectEvent {
  return { id: cryptoId(), at: Date.now(), level, stage, message }
}

/**
 * Launches the initial full-stack build (spec sections 7–12).
 * Flow: validate ownership + spec -> reserve MirrorSite credits -> launch
 * Totalum project -> persist totalumProjectId -> set state building. On any
 * provider failure the reservation is fully refunded.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const userId = user.id
    const { id } = await params
    const project = await store.getProject(id)
    if (!project || project.userId !== userId) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)

    // Fast-path check for a friendlier error; the actual guard against a
    // duplicate concurrent build is the atomic `claimBuildSlot` call below.
    if (project.state === "building" || project.state === "deploying") {
      return fail("AGENT_RUNNING", "This project is already being built.", 409)
    }

    // Allow the client to submit edited spec + additional instructions.
    const body = (await req.json().catch(() => ({}))) as { specification?: unknown }
    if (body.specification) {
      const parsed = ApplicationSpecificationSchema.safeParse(body.specification)
      if (!parsed.success) return fail("VALIDATION", "The application plan is invalid.", 422)
      await store.updateProject(id, { specification: parsed.data })
      project.specification = parsed.data
    }
    if (!project.specification) return fail("VALIDATION", "This project has no application plan yet.", 409)

    if (!isTotalumConfigured()) {
      return fail(
        "PROVIDER_NOT_CONFIGURED",
        "The application builder isn't connected yet. Add your Totalum API key to enable building.",
        503,
      )
    }

    // 1. Reserve credits.
    const estimate = estimateInitialBuild()
    const run: BuildRun = {
      id: cryptoId(),
      userId,
      mirrorProjectId: id,
      kind: "initial",
      prompt: buildInitialBuildPrompt(project.specification, project.understanding),
      status: "reserved",
      startedAt: Date.now(),
      creditsReserved: estimate.reserve,
    }
    await store.createBuildRun(run)

    // 1b. Atomically claim the build slot. This is the real guard against a
    // duplicate concurrent build — it can only succeed once per project
    // while state is outside {building, deploying} (see claimBuildSlot),
    // closing the check-then-act window the earlier state check above left
    // open between two simultaneous requests.
    const claimed = await store.claimBuildSlot(id, { state: "building" })
    if (!claimed) {
      await store.updateBuildRun(run.id, { status: "failed", error: "build already in progress" })
      return fail("AGENT_RUNNING", "This project is already being built.", 409)
    }

    const reserved = await reserveCredits(userId, estimate.reserve, run.id, "Initial application build")
    if (!reserved) {
      await store.updateBuildRun(run.id, { status: "failed", error: "insufficient credits" })
      await store.updateProject(id, { state: project.state })
      return fail("INSUFFICIENT_CREDITS", "You don't have enough credits for this build.", 402)
    }

    // 2. Launch the Totalum project.
    const previousState = project.state
    try {
      const launch = await launchProject({
        projectId: `mirror-${id.slice(0, 12)}`,
        prompt: run.prompt,
      })
      await store.updateBuildRun(run.id, { status: "running", totalumProjectId: launch.projectId })
      await store.updateProject(id, {
        state: "building",
        totalumProjectId: launch.projectId,
      })
      await store.appendEvent(id, event("build", "Build started"))
      return ok({ buildRunId: run.id, totalumProjectId: launch.projectId, state: "building" })
    } catch (providerError) {
      // 3. Refund on provider failure.
      await refundReservation(userId, estimate.reserve, run.id)
      await store.updateBuildRun(run.id, { status: "failed", error: (providerError as Error).message })
      await store.updateProject(id, { state: previousState })
      await store.appendEvent(id, event("build", "Build could not be started. Credits were refunded.", "error"))
      throw providerError
    }
  } catch (e) {
    return handleRouteError("api.projects.build", e)
  }
}
