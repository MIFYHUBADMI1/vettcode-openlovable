import "server-only"
import { store, cryptoId } from "@/lib/store/store"
import { logger } from "@/lib/logging/logger"
import { classifyComplexity, chargePlanCredits } from "@/lib/credits/credits"
import { startProjectBuild, startProjectDeploy } from "@/lib/projects/project-actions"
import { markPipelineFailure, runDeepCrawlAnalysis, runScratchAnalysis, runWebsiteAnalysis } from "@/lib/analysis/pipeline"
import { runGitHubAnalysis } from "@/lib/analysis/github-pipeline"
import { generateSpecificationFromUnderstanding } from "@/lib/analysis/specification"
import type { MirrorProject, ProjectEvent, ProjectState } from "@/lib/types/project"

/**
 * Pipeline recovery — the single place that decides how an Understand or Plan
 * run is (re)started. It is deliberately separate from the build/deploy paths,
 * which already have their own provider-polling and retry semantics.
 *
 * Guarantees:
 * - Only one analysis/planning run can start per project (atomic store claim).
 * - A failed run is retried automatically once before it is surfaced to the
 *   founder as "needs attention".
 * - A run that died without reporting (server restart, killed process) is
 *   detected from inactivity, restarted at most once, then surfaced as failed.
 * - Every manual retry reuses what was already learned — a plan retry never
 *   re-crawls the site.
 */

const AUTO_RETRY_DELAY_MS = 4_000
const MAX_AUTO_RETRIES = 1
const MAX_STALL_RESTARTS = 1
/** Quiet time before an unfinished run is treated as stalled. Kept generous:
 * heavy planning can go several minutes between emitted events. */
const STALL_MS: Record<"created" | "pending_plan" | "analyzing" | "analysis_complete", number> = {
  created: 45_000,
  pending_plan: 15 * 60_000,
  analyzing: 20 * 60_000,
  analysis_complete: 20 * 60_000,
}

export type RetryType = "understand" | "plan" | "build" | "launch"

export interface StepRetryResult {
  ok: boolean
  status: number
  retryType?: RetryType
  message: string
  buildRunId?: string
  deployRunId?: string
}

function event(stage: string, message: string, level: ProjectEvent["level"] = "info"): ProjectEvent {
  return { id: cryptoId(), at: Date.now(), level, stage, message }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isPipelineFailure(state: ProjectState): boolean {
  return state === "analysis_failed" || state === "plan_failed"
}

export function phaseForFailure(state: ProjectState): "understand" | "plan" | null {
  if (state === "analysis_failed") return "understand"
  if (state === "plan_failed") return "plan"
  return null
}

/** Latest evidence of progress in the project — events are appended as the
 * pipeline advances and every write bumps `updatedAt`. */
export function latestActivityAt(project: Pick<MirrorProject, "events" | "updatedAt">): number {
  const latestEvent = (project.events ?? []).reduce((max, e) => (e.at > max ? e.at : max), 0)
  return Math.max(latestEvent, project.updatedAt ?? 0)
}

export function isStepStalled(
  project: Pick<MirrorProject, "state" | "events" | "updatedAt">,
  now = Date.now(),
): boolean {
  const state = project.state
  if (state !== "created" && state !== "pending_plan" && state !== "analyzing" && state !== "analysis_complete") {
    return false
  }
  return now - latestActivityAt(project) > STALL_MS[state]
}

function stageFor(phase: "understand" | "plan"): string {
  return phase === "understand" ? "analyze" : "specify"
}

function phaseLabel(phase: "understand" | "plan"): string {
  return phase === "understand" ? "Understanding" : "Planning"
}

async function dispatchFullPipeline(project: MirrorProject): Promise<void> {
  if (project.mode === "github") {
    await runGitHubAnalysis(project.id)
    return
  }
  if (project.mode === "website") {
    if (project.crawlMode === "deep") await runDeepCrawlAnalysis(project.id, project.pipelineMode)
    else await runWebsiteAnalysis(project.id, project.pipelineMode)
    return
  }
  await runScratchAnalysis(project.id, project.pipelineMode)
}

/** Evidence from Understand that Plan can reuse. GitHub and idea-only projects
 * build their plan from other inputs, so they restart the full pipeline. */
function canReuseUnderstanding(project: MirrorProject): boolean {
  return Boolean(project.understanding) && project.mode !== "scratch" && project.mode !== "github"
}

/** Re-drafts only the plan from evidence that was already gathered — no new
 * crawl and no repeated scrape charge. */
async function regeneratePlan(project: MirrorProject): Promise<void> {
  if (!project.understanding) {
    await dispatchFullPipeline(project)
    return
  }
  try {
    const specification = await generateSpecificationFromUnderstanding(
      project.understanding,
      project.userId,
      project.id,
      project.pipelineMode,
    )
    specification.complexity = classifyComplexity(specification)
    await store.updateProject(project.id, {
      state: "plan_ready",
      specification,
      name: specification.title || project.name,
      error: undefined,
      pipelineRecovery: undefined,
    })
    // Deep crawls pay for planning upfront with the crawl; everything else is
    // charged when the plan is actually produced, exactly like the pipeline.
    if (project.crawlMode !== "deep") {
      try {
        await chargePlanCredits(project.userId, project.id, project.pipelineMode)
      } catch (e) {
        logger.error("pipeline.recovery", "plan credit charge failed", {
          projectId: project.id,
          error: (e as Error).message,
        })
      }
    }
    await store.appendEvent(project.id, event("plan", "✨ Your plan is ready. Review it before building."))
  } catch (e) {
    logger.error("pipeline.recovery", "plan regeneration failed", {
      projectId: project.id,
      error: (e as Error).message,
    })
    await markPipelineFailure(project.id, "plan", "The plan could not be completed.", "We couldn't finish the plan.")
  }
}

/** Runs the phase that failed. Re-running Understand re-crawls; re-running
 * Plan reuses whatever Understand already learned. */
async function runPhase(projectId: string, phase: "understand" | "plan"): Promise<void> {
  const fresh = await store.getProject(projectId)
  if (!fresh) return
  if (phase === "plan" && canReuseUnderstanding(fresh)) {
    await regeneratePlan(fresh)
    return
  }
  await dispatchFullPipeline(fresh)
}

/** Runs a pipeline and retries it once when the pipeline itself reports a
 * failure. Each attempt is recorded on the project so the workspace can say
 * "retrying automatically" instead of looking frozen. */
async function runWithAutoRetry(projectId: string, initialPhase: "understand" | "plan"): Promise<void> {
  let attempt = 0
  while (true) {
    attempt += 1
    const current = await store.getProject(projectId)
    if (!current) return
    const phase = current.pipelineRecovery?.phase ?? initialPhase
    const autoRestarts = current.pipelineRecovery?.autoRestarts ?? 0
    await store.updateProject(projectId, {
      pipelineRecovery: { phase, attempts: attempt, lastAttemptAt: Date.now(), autoRestarts },
    })

    try {
      await runPhase(projectId, phase)
    } catch (e) {
      // Pipelines capture their own failures; this guard only covers a runner
      // that throws before persisting anything.
      logger.error("pipeline.recovery", "runner threw", { projectId, attempt, error: (e as Error).message })
      await markPipelineFailure(projectId, phase, "This step stopped unexpectedly.", "This step stopped unexpectedly.")
    }

    const after = await store.getProject(projectId)
    if (!after || !isPipelineFailure(after.state) || after.creditBlock) return
    // The pipeline knows which phase actually failed (a scratch run starts as
    // Understand but fails while planning).
    const failedPhase = after.pipelineRecovery?.phase ?? phase

    if (attempt > MAX_AUTO_RETRIES) {
      await store.appendEvent(
        projectId,
        event(
          stageFor(failedPhase),
          "Automatic retry didn't recover this step. Retry it from your workspace.",
          "error",
        ),
      )
      return
    }

    const claimed = await store.claimPipelineSlot(projectId, [after.state])
    if (!claimed) return

    await store.appendEvent(
      projectId,
      event(
        stageFor(failedPhase),
        `${phaseLabel(failedPhase)} is retrying automatically — attempt ${attempt + 1} of ${MAX_AUTO_RETRIES + 1}.`,
        "warn",
      ),
    )
    await sleep(AUTO_RETRY_DELAY_MS)
  }
}

/** Starts (or restarts) the Understand → Plan pipeline for a project that has
 * no plan yet. Returns a user-facing failure when another run holds the slot.
 * `expectUpdatedAt` pins a stalled takeover to the record the caller observed,
 * so a poller can never take over a run that restarted in the meantime. */
export async function startProjectPipeline(
  projectId: string,
  reason: "manual" | "stalled" = "manual",
  expectUpdatedAt?: number,
): Promise<StepRetryResult> {
  const project = await store.getProject(projectId)
  if (!project) return { ok: false, status: 404, message: "We couldn't find this project." }
  if (project.specification) {
    return { ok: false, status: 409, message: "This project already has a plan." }
  }

  const claimable: ProjectState[] = ["created", "pending_plan", "analysis_failed", "plan_failed"]
  if (reason === "stalled") claimable.push("analyzing")

  const claimed = await store.claimPipelineSlot(projectId, claimable, expectUpdatedAt)
  if (!claimed) {
    return { ok: false, status: 409, message: "This step is already running." }
  }

  const autoRestarts = (project.pipelineRecovery?.autoRestarts ?? 0) + (reason === "stalled" ? 1 : 0)
  const phase: "understand" | "plan" =
    project.state === "pending_plan" || (project.state === "plan_failed" && project.mode === "scratch")
      ? "plan"
      : "understand"
  await store.updateProject(projectId, {
    creditBlock: undefined,
    pipelineRecovery: { phase, attempts: 0, lastAttemptAt: Date.now(), autoRestarts },
  })
  await store.appendEvent(
    projectId,
    event(
      stageFor(phase),
      reason === "stalled"
        ? "Restarting the stalled step…"
        : project.state === "created"
          ? "Starting the understanding step…"
          : phase === "plan"
            ? "Restarting the planning step…"
            : "Restarting the understanding step…",
    ),
  )
  void runWithAutoRetry(projectId, phase)

  return {
    ok: true,
    status: 202,
    retryType: phase === "plan" ? "plan" : "understand",
    message: phase === "plan" ? "Planning restarted." : "Understanding restarted.",
  }
}

/** Regenerates only the plan from evidence that already exists — no re-crawl,
 * no repeated analysis cost. Falls back to the full pipeline when nothing was
 * learned yet (scratch ideas, GitHub failures before understanding). */
export async function startPlanRegeneration(
  projectId: string,
  extraClaimStates: ProjectState[] = [],
  expectUpdatedAt?: number,
): Promise<StepRetryResult> {
  const project = await store.getProject(projectId)
  if (!project) return { ok: false, status: 404, message: "We couldn't find this project." }
  if (project.specification) {
    return { ok: false, status: 409, message: "This project already has a plan." }
  }

  const claimed = await store.claimPipelineSlot(
    projectId,
    ["plan_failed", "analysis_failed", ...extraClaimStates],
    expectUpdatedAt,
  )
  if (!claimed) {
    return { ok: false, status: 409, message: "Planning is already running." }
  }

  const reusable = canReuseUnderstanding(project)
  await store.updateProject(projectId, {
    creditBlock: undefined,
    pipelineRecovery: {
      phase: "plan",
      attempts: 0,
      lastAttemptAt: Date.now(),
      autoRestarts: project.pipelineRecovery?.autoRestarts ?? 0,
    },
  })
  await store.appendEvent(
    projectId,
    event("specify", reusable ? "Re-drafting your plan from what we already understood…" : "Restarting the plan…"),
  )

  void runWithAutoRetry(projectId, "plan")

  return { ok: true, status: 202, retryType: "plan", message: "Planning restarted." }
}

/** Detects a project whose analysis/planning run died without reporting and
 * restarts it once. Afterwards the step is marked failed so the founder gets
 * the manual retry instead of an endless "getting ready" screen.
 *
 * Returns true when the project was changed and should be re-read. */
export async function recoverStalledPipeline(project: MirrorProject, now = Date.now()): Promise<boolean> {
  if (project.specification) return false
  if (
    project.state !== "created" &&
    project.state !== "pending_plan" &&
    project.state !== "analyzing" &&
    project.state !== "analysis_complete"
  ) {
    return false
  }
  if (now - latestActivityAt(project) <= STALL_MS[project.state]) return false

  const phase: "understand" | "plan" =
    project.state === "pending_plan" ||
    project.state === "analysis_complete" ||
    (project.state === "analyzing" && project.pipelineRecovery?.phase === "plan")
      ? "plan"
      : "understand"

  if ((project.pipelineRecovery?.autoRestarts ?? 0) >= MAX_STALL_RESTARTS) {
    await markPipelineFailure(
      project.id,
      phase,
      "This step stopped responding. Retry it from your workspace.",
      "This step stopped responding.",
    )
    return true
  }

  const claimed = await store.claimPipelineSlot(project.id, [project.state], project.updatedAt)
  if (!claimed) return false

  await store.updateProject(project.id, {
    pipelineRecovery: {
      phase,
      attempts: 0,
      lastAttemptAt: now,
      autoRestarts: (project.pipelineRecovery?.autoRestarts ?? 0) + 1,
    },
  })
  await store.appendEvent(
    project.id,
    event(stageFor(phase), `${phaseLabel(phase)} stopped responding — restarting it automatically.`, "warn"),
  )
  void runWithAutoRetry(project.id, phase)
  return true
}

/** Manual retry for any journey step. Build and launch delegate to the same
 * services the workspace buttons already use. */
export async function retryProjectStep(projectId: string): Promise<StepRetryResult> {
  const project = await store.getProject(projectId)
  if (!project) return { ok: false, status: 404, message: "We couldn't find this project." }
  const state = project.state

  if (state === "build_failed") {
    const result = await startProjectBuild(project.userId, projectId)
    if (!result.ok) return { ok: false, status: result.status, message: result.message ?? "The build could not be retried." }
    return {
      ok: true,
      status: 202,
      retryType: "build",
      message: "Build retry started.",
      buildRunId: result.buildRunId,
    }
  }

  if (state === "deployment_failed") {
    const result = await startProjectDeploy(project.userId, projectId)
    if (!result.ok) return { ok: false, status: result.status, message: result.message ?? "The launch could not be retried." }
    return {
      ok: true,
      status: 202,
      retryType: "launch",
      message: "Launch retry started.",
      deployRunId: result.deployRunId,
    }
  }

  if (state === "plan_failed") {
    if (canReuseUnderstanding(project)) return startPlanRegeneration(projectId)
    return startProjectPipeline(projectId)
  }

  if (state === "created" || state === "pending_plan" || state === "analysis_failed") {
    // `pending_plan` is set while the orchestrator is still working, so only a
    // silent run may be taken over.
    if (state === "pending_plan" && !isStepStalled(project)) {
      return { ok: false, status: 409, message: "This step is still running. Try again if it stops responding." }
    }
    const failedDuringPlan =
      state === "analysis_failed" && project.pipelineRecovery?.phase === "plan"
    if (failedDuringPlan && canReuseUnderstanding(project)) return startPlanRegeneration(projectId)
    return startProjectPipeline(
      projectId,
      "manual",
      state === "pending_plan" ? project.updatedAt : undefined,
    )
  }

  if (state === "analysis_complete") {
    if (!isStepStalled(project)) {
      return { ok: false, status: 409, message: "This step is still running. Try again if it stops responding." }
    }
    return startPlanRegeneration(projectId, ["analysis_complete"], project.updatedAt)
  }

  if (state === "analyzing") {
    if (!isStepStalled(project)) {
      return { ok: false, status: 409, message: "This step is still running. Try again if it stops responding." }
    }
    const phase = project.pipelineRecovery?.phase ?? "understand"
    return phase === "plan" && canReuseUnderstanding(project)
      ? startPlanRegeneration(projectId, ["analyzing"], project.updatedAt)
      : startProjectPipeline(projectId, "stalled", project.updatedAt)
  }

  return {
    ok: false,
    status: 409,
    message: `This project cannot be retried from its current state (${state}).`,
  }
}
