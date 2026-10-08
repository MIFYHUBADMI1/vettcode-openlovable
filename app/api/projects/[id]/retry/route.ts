import { requireUser } from "@/lib/auth/session"
import { store, cryptoId } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { startProjectBuild, startProjectDeploy } from "@/lib/projects/project-actions"
import { logger } from "@/lib/logging/logger"
import type { ProjectEvent } from "@/lib/types/project"

function event(stage: string, message: string, level: ProjectEvent["level"] = "info"): ProjectEvent {
  return { id: cryptoId(), at: Date.now(), level, stage, message }
}

/**
 * POST /api/projects/[id]/retry
 * Retry a failed build or deployment.
 *
 * Only handles two cases:
 * - build_failed → re-attempt the build (requires spec still present)
 * - deployment_failed → re-attempt deployment (requires totalumProjectId)
 *
 * Other states return 409. This is a thin wrapper around the existing
 * startProjectBuild / startProjectDeploy services — no second job engine.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const userId = user.id
    const { id } = await params

    const project = await store.getProject(id)
    if (!project || project.userId !== userId) {
      return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    }

    const state = project.state

    if (state === "build_failed") {
      // Retry the build. Reuses the existing startProjectBuild service which
      // enforces its own preconditions (spec present, not already building, etc.).
      const result = await startProjectBuild(userId, id)
      if (!result.ok) {
        // startProjectBuild returns structured errors; surface the user-facing one.
        return fail(result.code, result.message ?? "The build could not be retried.", result.status)
      }
      logger.info("api.projects.retry", "build retry started", { projectId: id, buildRunId: result.buildRunId })
      return ok({
        retryType: "build",
        buildRunId: result.buildRunId,
        totalumProjectId: result.totalumProjectId,
        message: "Build retry started.",
      })
    }

    if (state === "deployment_failed") {
      // Retry deployment. Reuses startProjectDeploy which enforces its own
      // preconditions (totalumProjectId present, not already deploying, etc.).
      const result = await startProjectDeploy(userId, id)
      if (!result.ok) {
        return fail(result.code, result.message ?? "The deployment could not be retried.", result.status)
      }
      logger.info("api.projects.retry", "deployment retry started", { projectId: id, deployRunId: result.deployRunId })
      return ok({
        retryType: "deploy",
        deployRunId: result.deployRunId,
        message: "Deployment retry started.",
      })
    }

    // Not a retryable state.
    return fail("NOT_RETRYABLE", `This project cannot be retried from its current state (${state}).`, 409)
  } catch (e) {
    return handleRouteError("api.projects.retry", e)
  }
}
