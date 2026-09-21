import "server-only"
import { store, cryptoId } from "@/lib/store/store"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { logger } from "@/lib/logging/logger"
import { reserveCredits, releaseReservation, getAvailableCredits } from "@/lib/billing/credit-service"
import { classifyComplexity } from "@/lib/credits/credits"
import { launchProject, runAgent, deployProject, getDeploymentStatus, isTotalumConfigured } from "@/lib/integrations/totalum/service"
import { initializeProjectInfrastructure } from "@/lib/infrastructure/service"
import { getInfrastructurePlan } from "@/lib/infrastructure/plans"
import { buildInitialBuildPrompt } from "@/lib/analysis/prompt-builder"
import { getBuildCost } from "@/lib/billing/build-auth"
import { getDeploymentCosts } from "@/lib/billing/runtime-config"
import {
  getPlanSection,
  validatePlanSectionValue,
  applySectionUpdate,
  computePlanHealth,
  type PlanSectionId,
} from "@/lib/analysis/plan-sections"
import { decisionForProposal } from "@/lib/analysis/cofounder"
import { ApplicationSpecificationSchema } from "@/lib/types/specification"
import type { MirrorProject, BuildRun, ProjectEvent } from "@/lib/types/project"
import type { PlanProposal } from "@/lib/types/plan-analysis"

/**
 * Shared project mutation services — the ONE implementation of build /
 * follow-up / deploy / plan-section-update, used by BOTH the REST routes and
 * the Co-founder tools (spec sections 1, 3, 86). The REST routes are being
 * rewired to delegate here; behavior is preserved exactly.
 */

function event(stage: string, message: string, level: ProjectEvent["level"] = "info"): ProjectEvent {
  return { id: cryptoId(), at: Date.now(), level, stage, message }
}

// ─── Build (initial) ─────────────────────────────────────────────────────────

export interface StartBuildResult {
  ok: boolean
  status: number
  code: string
  message?: string
  buildRunId?: string
  totalumProjectId?: string
  tier?: string
  creditsCharged?: number
}

export async function startProjectBuild(userId: string, projectId: string): Promise<StartBuildResult> {
  // Rate-limit build initiation: 5 builds per hour per user (unchanged).
  await checkRateLimit({ action: "project_build", identifier: userId, limit: 5, windowMs: 60 * 60 * 1000 })

  const project = await store.getProject(projectId)
  if (!project || project.userId !== userId) {
    return { ok: false, status: 404, code: "UNAUTHORIZED_PROJECT_ACCESS", message: "We couldn't find this project." }
  }
  if (project.state === "building" || project.state === "deploying") {
    return { ok: false, status: 409, code: "AGENT_RUNNING", message: "This project is already being built." }
  }
  if (!project.specification) {
    return { ok: false, status: 409, code: "VALIDATION", message: "This project has no application plan yet." }
  }
  if (!isTotalumConfigured()) {
    return { ok: false, status: 503, code: "PROVIDER_NOT_CONFIGURED", message: "The application builder isn't connected yet. Add your Totalum API key to enable building." }
  }

  const tier = project.specification.complexity ?? classifyComplexity(project.specification)
  const creditsNeeded = await getBuildCost(tier)
  const run: BuildRun = {
    id: cryptoId(),
    userId,
    mirrorProjectId: projectId,
    kind: "initial",
    prompt: buildInitialBuildPrompt(project.specification, project.understanding, project.preferences),
    status: "reserved",
    startedAt: Date.now(),
    creditsReserved: creditsNeeded,
  }
  await store.createBuildRun(run)

  // Atomic build-slot claim — the real guard against duplicate concurrent builds.
  const claimed = await store.claimBuildSlot(projectId, { state: "building" })
  if (!claimed) {
    await store.updateBuildRun(run.id, { status: "failed", error: "build already in progress" })
    return { ok: false, status: 409, code: "AGENT_RUNNING", message: "This project is already being built." }
  }

  const available = await getAvailableCredits(userId)
  if (available < creditsNeeded) {
    await store.updateBuildRun(run.id, { status: "failed", error: "insufficient credits" })
    await store.updateProject(projectId, { state: project.state })
    return { ok: false, status: 402, code: "INSUFFICIENT_CREDITS", message: `You don't have enough credits for this build. Required: ${creditsNeeded.toLocaleString()}, Available: ${available.toLocaleString()}.` }
  }

  const reserved = await reserveCredits({ userId, amount: creditsNeeded, buildId: run.id, reason: `${tier.charAt(0).toUpperCase() + tier.slice(1)} application build` })
  if (!reserved) {
    await store.updateBuildRun(run.id, { status: "failed", error: "insufficient credits" })
    await store.updateProject(projectId, { state: project.state })
    return { ok: false, status: 402, code: "INSUFFICIENT_CREDITS", message: "You don't have enough credits for this build." }
  }

  const previousState = project.state
  try {
    const defaultPlan = getInfrastructurePlan(project.infrastructure?.planId ?? "testing")
    const infraCap = defaultPlan?.totalumInfrastructureCredits ?? 5

    const sanitizedName = project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 20)
    const shortId = projectId.replace(/-/g, "").slice(0, 6)
    const totalumProjectName = `mirror-${sanitizedName}-${shortId}`

    const launch = await launchProject({
      projectId: totalumProjectName,
      prompt: run.prompt,
      maxInfrastructureCreditsPerMonth: infraCap,
    })
    await store.updateBuildRun(run.id, { status: "running", totalumProjectId: launch.projectId })
    await store.updateProject(projectId, { state: "building", totalumProjectId: launch.projectId })

    if (!project.infrastructure) {
      await initializeProjectInfrastructure(projectId, launch.projectId).catch((e) => {
        logger.error("api.projects.build", "infrastructure init failed", { projectId, error: (e as Error).message })
      })
    }

    await store.appendEvent(projectId, event("build", "Build started"))
    return { ok: true, status: 200, code: "OK", buildRunId: run.id, totalumProjectId: launch.projectId, tier, creditsCharged: creditsNeeded }
  } catch (providerError) {
    await releaseReservation({ userId, amount: creditsNeeded, buildId: run.id, reason: "Build provider failure" })
    await store.updateBuildRun(run.id, { status: "failed", error: (providerError as Error).message })
    await store.updateProject(projectId, { state: previousState })
    await store.appendEvent(projectId, event("build", "Build could not be started. Credits were refunded.", "error"))
    throw providerError
  }
}

// ─── Follow-up edit ──────────────────────────────────────────────────────────

export interface SendFollowupResult {
  ok: boolean
  status: number
  code: string
  message?: string
  buildRunId?: string
  tier?: string
  creditsCharged?: number
}

export async function sendProjectFollowup(userId: string, projectId: string, prompt: string): Promise<SendFollowupResult> {
  await checkRateLimit({ action: "project_agent", identifier: userId, limit: 20, windowMs: 60 * 60 * 1000 })

  const project = await store.getProject(projectId)
  if (!project || project.userId !== userId) {
    return { ok: false, status: 404, code: "UNAUTHORIZED_PROJECT_ACCESS", message: "We couldn't find this project." }
  }
  if (!project.totalumProjectId) {
    return { ok: false, status: 409, code: "VALIDATION", message: "This project hasn't been built yet." }
  }
  if (project.state === "building" || project.state === "deploying") {
    return { ok: false, status: 409, code: "AGENT_RUNNING", message: "Please wait for the current change to finish." }
  }

  const trimmed = prompt.trim()
  if (trimmed.length < 2) {
    return { ok: false, status: 422, code: "VALIDATION", message: "Please describe the change you want." }
  }
  if (!isTotalumConfigured()) {
    return { ok: false, status: 503, code: "PROVIDER_NOT_CONFIGURED", message: "The application builder isn't connected yet." }
  }

  const userMsg = { id: cryptoId(), role: "user" as const, content: trimmed, at: Date.now() }
  await store.appendMessage(projectId, userMsg)

  const tier = project.specification?.complexity ?? classifyComplexity(project.specification!)
  const creditsNeeded = await getBuildCost(tier)

  const run: BuildRun = {
    id: cryptoId(),
    userId,
    mirrorProjectId: projectId,
    totalumProjectId: project.totalumProjectId,
    kind: "followup",
    prompt: trimmed,
    status: "reserved",
    startedAt: Date.now(),
    creditsReserved: creditsNeeded,
  }
  await store.createBuildRun(run)

  const claimed = await store.claimBuildSlot(projectId, { state: "building" })
  if (!claimed) {
    await store.updateBuildRun(run.id, { status: "failed", error: "build already in progress" })
    return { ok: false, status: 409, code: "AGENT_RUNNING", message: "Please wait for the current change to finish." }
  }

  const available = await getAvailableCredits(userId)
  if (available < creditsNeeded) {
    await store.updateBuildRun(run.id, { status: "failed", error: "insufficient credits" })
    await store.updateProject(projectId, { state: project.state })
    return { ok: false, status: 402, code: "INSUFFICIENT_CREDITS", message: `You need ${creditsNeeded.toLocaleString()} credits for this edit (${tier} tier). Available: ${available.toLocaleString()}.` }
  }

  const reserved = await reserveCredits({
    userId,
    amount: creditsNeeded,
    buildId: run.id,
    reason: `${tier.charAt(0).toUpperCase() + tier.slice(1)} application follow-up`,
  })
  if (!reserved) {
    await store.updateBuildRun(run.id, { status: "failed", error: "insufficient credits" })
    await store.updateProject(projectId, { state: project.state })
    return { ok: false, status: 402, code: "INSUFFICIENT_CREDITS", message: `You need ${creditsNeeded.toLocaleString()} credits for this edit (${tier} tier). Please top up and try again.` }
  }

  const previousState = project.state
  try {
    await runAgent(project.totalumProjectId, trimmed)
    await store.updateBuildRun(run.id, { status: "running" })
    await store.updateProject(projectId, { state: "building" })
    return { ok: true, status: 200, code: "OK", buildRunId: run.id, tier, creditsCharged: creditsNeeded }
  } catch (providerError) {
    await releaseReservation({ userId, amount: creditsNeeded, buildId: run.id, reason: "Agent provider failure" })
    await store.updateBuildRun(run.id, { status: "failed", error: (providerError as Error).message })
    await store.updateProject(projectId, { state: previousState })
    throw providerError
  }
}

// ─── Deploy ──────────────────────────────────────────────────────────────────

export interface StartDeployResult {
  ok: boolean
  status: number
  code: string
  message?: string
  deployRunId?: string
  creditsCharged?: number
}

export async function startProjectDeploy(userId: string, projectId: string): Promise<StartDeployResult> {
  await checkRateLimit({ action: "project_deploy", identifier: userId, limit: 10, windowMs: 24 * 60 * 60 * 1000 })

  const project = await store.getProject(projectId)
  if (!project || project.userId !== userId) {
    return { ok: false, status: 404, code: "UNAUTHORIZED_PROJECT_ACCESS", message: "We couldn't find this project." }
  }
  if (!project.totalumProjectId) {
    return { ok: false, status: 400, code: "NO_TOTALUM_PROJECT", message: "This project hasn't been built yet." }
  }
  if (project.state === "building" || project.state === "deploying") {
    return { ok: false, status: 409, code: "BUSY", message: "Please wait for the current operation to finish." }
  }
  if (!isTotalumConfigured()) {
    return { ok: false, status: 503, code: "PROVIDER_NOT_CONFIGURED", message: "Deployment service is not connected." }
  }

  const deployCost = (await getDeploymentCosts()).deployCost
  const available = await getAvailableCredits(userId)
  if (available < deployCost) {
    return { ok: false, status: 402, code: "INSUFFICIENT_CREDITS", message: `Deploying requires ${deployCost.toLocaleString()} credits. Available: ${available.toLocaleString()}.` }
  }

  // Already-deployed check via provider status (same as the REST route).
  try {
    const deployStatus = await getDeploymentStatus(project.totalumProjectId)
    if (deployStatus.status === "deploying") {
      return { ok: false, status: 409, code: "DEPLOYMENT_RUNNING", message: "A deployment is already in progress." }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("PROJECT_NOT_FOUND")) {
      return { ok: false, status: 404, code: "TOTALUM_PROJECT_NOT_FOUND", message: "This project wasn't found in the deployment service. Try rebuilding the project first." }
    }
    // Other status-check failures proceed with deploy (same as the route).
  }

  const runId = cryptoId()
  const reserved = await reserveCredits({ userId, amount: deployCost, buildId: runId, reason: "Production deployment" })
  if (!reserved) {
    return { ok: false, status: 402, code: "INSUFFICIENT_CREDITS", message: "Could not reserve credits for deployment." }
  }

  const deployStartTime = Date.now()
  try {
    await store.updateProject(projectId, { state: "deploying" })
    await store.appendEvent(projectId, event("deploy", "Starting production deployment..."))

    const result = await deployProject(project.totalumProjectId)
    void result

    try {
      await store.appendDeploymentRecord(projectId, {
        id: runId,
        startedAt: deployStartTime,
        status: "deploying",
        creditsCharged: deployCost,
      })
    } catch (err) {
      logger.warn("service.project-actions", "failed to record deployment history (non-fatal)", { projectId })
    }

    try {
      const peCol = await publishEventsColSafe()
      await peCol.insertOne({
        _id: new (await import("mongodb")).ObjectId(),
        id: runId,
        userId,
        projectId,
        projectName: project.name,
        eventType: "subdomain" as const,
        status: "started" as const,
        creditsCharged: deployCost,
        createdAt: deployStartTime,
      })
    } catch (err) {
      logger.warn("service.project-actions", "failed to record publish analytics (non-fatal)", { projectId })
    }

    await store.appendEvent(projectId, event("deploy", "Deployment started — publishing to production (typically 3–5 minutes)."))
    return { ok: true, status: 200, code: "OK", deployRunId: runId, creditsCharged: deployCost, message: "Deployment started. This typically takes 3-5 minutes." }
  } catch (providerError) {
    await releaseReservation({ userId, amount: deployCost, buildId: runId, reason: "Deployment failure" })
    const errorMessage = providerError instanceof Error ? providerError.message : "Deployment failed"
    const isProjectNotFound = errorMessage.includes("PROJECT_NOT_FOUND") || errorMessage.includes("404")
    const userMessage = isProjectNotFound
      ? "This project wasn't found in the deployment service. The build may have failed or been deleted. Try rebuilding the project first."
      : errorMessage

    try {
      await store.updateDeploymentRecord(projectId, runId, { status: "failed", completedAt: Date.now(), error: userMessage })
    } catch {
      // non-fatal
    }
    try {
      const peCol = await publishEventsColSafe()
      await peCol.updateOne({ id: runId }, { $set: { status: "failed", error: userMessage, durationMs: Date.now() - deployStartTime } })
    } catch {
      // non-fatal
    }
    await store.updateProject(projectId, { state: "ready" })
    await store.appendEvent(projectId, event("deploy", `Deployment failed: ${userMessage}`, "error"))
    throw providerError
  }
}

async function publishEventsColSafe() {
  const { publishEventsCol } = await import("@/lib/db/collections")
  return publishEventsCol()
}

// ─── Plan section update (accepted proposal or direct section edit) ─────────

export interface ApplySectionUpdateResult {
  ok: boolean
  status: number
  code: string
  message?: string
  section?: string
  label?: string
  value?: string
}

/** Generalizes the PATCH sectionUpdate path: validated, section-level plan
 * mutation with decision notes and cached-analysis bookkeeping. Used by the
 * REST PATCH route AND the Co-founder apply_plan_update tool. */
export async function applyPlanSectionUpdate(
  userId: string,
  projectId: string,
  params: {
    section: string
    value: unknown
    acceptedProposal?: { id: string } | null
    /** Co-founder provenance is recorded on the audit event. */
    viaCofounder?: boolean
  },
): Promise<ApplySectionUpdateResult> {
  const project = await store.getProject(projectId)
  if (!project || project.userId !== userId) {
    return { ok: false, status: 404, code: "UNAUTHORIZED_PROJECT_ACCESS", message: "We couldn't find this project." }
  }
  const section = typeof params.section === "string" ? params.section : ""
  if (!getPlanSection(section)) {
    return { ok: false, status: 422, code: "VALIDATION", message: "Unknown plan section." }
  }
  const validated = validatePlanSectionValue(section, params.value)
  if (!validated.ok) {
    return { ok: false, status: 422, code: "VALIDATION", message: validated.error }
  }
  const current = project.specification
  if (!current) {
    return { ok: false, status: 409, code: "VALIDATION", message: "This project has no plan yet." }
  }

  const nextSpec = applySectionUpdate(current, section as PlanSectionId, validated.value)
  const reparsed = ApplicationSpecificationSchema.safeParse(nextSpec)
  if (!reparsed.success) {
    return { ok: false, status: 422, code: "VALIDATION", message: "The proposed value is invalid for this section." }
  }

  let decisionNote: string | null = null
  let acceptedProposal: PlanProposal | null = null
  if (params.acceptedProposal) {
    acceptedProposal = (project.planAnalysis?.proposals ?? []).find((p) => p.id === params.acceptedProposal?.id) ?? null
    decisionNote = acceptedProposal
      ? decisionForProposal(acceptedProposal)
      : `Updated ${getPlanSection(section)?.label ?? section}`
  }

  const patch: Record<string, unknown> = {
    specification: reparsed.data,
    specSanitized: false,
  }
  if (decisionNote) {
    patch.planUpdateNotes = [...(project.planUpdateNotes ?? []), decisionNote].slice(-50)
  }
  if (project.planAnalysis) {
    const health = computePlanHealth(reparsed.data)
    patch.planAnalysis = {
      ...project.planAnalysis,
      healthPercent: health.percent,
      proposals: (project.planAnalysis.proposals ?? []).filter(
        (p: PlanProposal) => !(acceptedProposal && p.id === acceptedProposal.id) && p.section !== section,
      ),
      findings: (project.planAnalysis.findings ?? []).filter((f: { section: string }) => f.section !== section),
    }
  }

  await store.updateProject(projectId, patch)
  const label = getPlanSection(section)?.label ?? section
  const evt: ProjectEvent = {
    id: cryptoId(),
    at: Date.now(),
    level: "info",
    stage: params.viaCofounder ? "cofounder" : "plan",
    message: decisionNote ?? `📝 Plan section updated: ${section}`,
  }
  await store.appendEvent(projectId, evt)
  return { ok: true, status: 200, code: "OK", section, label, value: validated.value }
}

/** Stop the build agent (LOW_RISK_WRITE). Same checks as the stop route. */
export async function stopProjectBuild(userId: string, projectId: string): Promise<{ ok: boolean; status: number; code: string; message?: string }> {
  const { stopAgent } = await import("@/lib/integrations/totalum/service")
  const project = await store.getProject(projectId)
  if (!project || project.userId !== userId) {
    return { ok: false, status: 404, code: "UNAUTHORIZED_PROJECT_ACCESS", message: "We couldn't find this project." }
  }
  if (!project.totalumProjectId) {
    return { ok: false, status: 400, code: "NO_TOTALUM_PROJECT", message: "This project hasn't been built yet." }
  }
  if (!isTotalumConfigured()) {
    return { ok: false, status: 503, code: "PROVIDER_NOT_CONFIGURED", message: "Build service is not connected." }
  }
  const result = await stopAgent(project.totalumProjectId)
  await store.appendEvent(projectId, event("cofounder", "Build stopped via Co-founder"))
  return { ok: true, status: 200, code: "OK", message: result.message }
}
