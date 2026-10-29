import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, failInsufficientCredits, handleRouteError } from "@/lib/api/respond"
import { retryProjectStep } from "@/lib/projects/pipeline-recovery"
import { logger } from "@/lib/logging/logger"
import { getAvailableCredits } from "@/lib/billing/credit-service"
import { checkAiQuota } from "@/lib/api/ai-quota"

/** States whose manual retry restarts an Understand/Plan AI run. Build and
 * launch retries are provider work and stay on their own quotas. */
const AI_RESTART_STATES = new Set(["created", "analysis_failed", "plan_failed"])

/**
 * POST /api/projects/[id]/retry
 * Manual retry for whichever journey step is stuck or failed:
 * - analysis_failed / created / pending_plan / stalled analyzing → Understand
 * - plan_failed → Plan (reuses the existing understanding, no re-crawl)
 * - build_failed → Build
 * - deployment_failed → Launch
 *
 * The actual work lives in retryProjectStep; this route only authenticates and
 * checks ownership.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params

    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) {
      return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    }

    if (project.creditBlock) {
      const available = await getAvailableCredits(user.id)
      if (available < project.creditBlock.required) return failInsufficientCredits({ required: project.creditBlock.required, available })
    }
    // A manual restart of Understand/Plan costs real provider and model work;
    // it draws from the same per-account quota as a fresh analysis request.
    if (AI_RESTART_STATES.has(project.state)) await checkAiQuota("analysis", user.id)
    const result = await retryProjectStep(id)
    if (!result.ok) {
      logger.warn("api.projects.retry", "retry rejected", {
        projectId: id,
        state: project.state,
        status: result.status,
        message: result.message,
      })
      return fail("RETRY_NOT_STARTED", result.message, result.status)
    }

    logger.info("api.projects.retry", "retry started", {
      projectId: id,
      retryType: result.retryType,
      buildRunId: result.buildRunId,
      deployRunId: result.deployRunId,
    })
    return ok({
      retryType: result.retryType,
      buildRunId: result.buildRunId,
      deployRunId: result.deployRunId,
      message: result.message,
    })
  } catch (e) {
    return handleRouteError("api.projects.retry", e)
  }
}
