import type { Project, ProjectEvent, ProjectMode, ProjectState } from "@/lib/types/project"

export type JourneyPhase = "understand" | "plan" | "build" | "validate" | "launch"
export type TeamRole = "cofounder" | "product" | "engineering" | "launch"
export type NextActionKind =
  | "review_plan"
  | "start_build"
  | "open_preview"
  | "launch"
  | "retry_analysis"
  | "retry_plan"
  | "retry_build"
  | "retry_launch"
  | "wait"
  | "grow"

export type WorkspaceMutation =
  | "build"
  | "deploy"
  | "retry_analysis"
  | "retry_plan"
  | "retry_build"
  | "retry_launch"

export const JOURNEY: Array<{ id: JourneyPhase; label: string; sub: string }> = [
  { id: "understand", label: "Understand", sub: "Market · Idea · Research" },
  { id: "plan", label: "Plan", sub: "Strategy · Product · Technology" },
  { id: "build", label: "Build", sub: "Development · Integrations" },
  { id: "validate", label: "Validate", sub: "Testing · Feedback" },
  { id: "launch", label: "Launch", sub: "Production · Domain" },
]

export const JOURNEY_TEAMS: Record<JourneyPhase, string> = {
  understand: "AI co-founder and research team",
  plan: "AI co-founder and research team",
  build: "AI product design team and engineering team",
  validate: "AI product specialist team",
  launch: "AI launch team, product specialist team, and marketing team",
}

export type JourneyTeamStatus = "completed" | "at_work" | "needs_attention" | "getting_ready" | "upcoming"

/** Which journey step a failure belongs to. Failure states are step-specific
 * so the workspace never blames the build for a failed understanding pass. */
export function failedJourneyStep(state: ProjectState): JourneyPhase | null {
  if (state === "analysis_failed") return "understand"
  if (state === "plan_failed") return "plan"
  if (state === "build_failed") return "build"
  if (state === "deployment_failed") return "launch"
  return null
}

export function journeyTeamStatus(
  phase: JourneyPhase,
  current: JourneyPhase,
  state: ProjectState,
): JourneyTeamStatus {
  const order: JourneyPhase[] = ["understand", "plan", "build", "validate", "launch"]
  const index = order.indexOf(phase)
  const here = order.indexOf(current)
  if (failedJourneyStep(state) === phase) return "needs_attention"
  if (index < here) return "completed"
  if (index > here) return "upcoming"
  if (workspaceIsLive(state)) return "at_work"
  if (state === "created" || state === "pending_plan") return "getting_ready"
  return "completed"
}

const LIVE: ReadonlySet<ProjectState> = new Set([
  "analyzing",
  // Understanding is stored, but the same run is still drafting the plan.
  "analysis_complete",
  "building",
  "deploying",
])

export function workspaceIsLive(state: ProjectState): boolean {
  return LIVE.has(state)
}

export function journeyPhase(state: ProjectState): JourneyPhase {
  // Unknown states fall back to the first phase rather than crashing callers
  // that index journey UI from this value.
  const DEFAULT: JourneyPhase = "understand"
  switch (state) {
    case "created":
    case "analyzing":
    case "analysis_failed":
      return "understand"
    case "analysis_complete":
    case "pending_plan":
    case "specification_ready":
    case "plan_ready":
    case "plan_failed":
    case "awaiting_build_confirmation":
      return "plan"
    case "building":
    case "build_complete":
    case "build_failed":
      return "build"
    case "ready":
      return "validate"
    case "deploying":
    case "deployed":
    case "deployment_failed":
      return "launch"
  }
  return DEFAULT
}

export function teamRoleForState(state: ProjectState): TeamRole {
  if (state === "analysis_failed") return "cofounder"
  if (state === "plan_failed") return "product"
  if (state === "building" || state === "build_failed" || state === "build_complete") return "engineering"
  if (state === "deploying" || state === "deployment_failed" || state === "deployed") return "launch"
  if (state === "ready") return "product"
  return "cofounder"
}

function modeNoun(mode: ProjectMode | undefined): string {
  if (mode === "github") return "codebase"
  if (mode === "scratch") return "idea"
  return "reference"
}

export interface WorkspaceNextStep {
  kind: NextActionKind
  kicker: string
  title: string
  body: string
  actionLabel: string | null
  href: string | null
  mutation: WorkspaceMutation | null
  needsYou: boolean
}

export interface WorkspaceBrief {
  role: TeamRole
  headline: string
  support: string
  live: boolean
}

export interface CapabilityFlag {
  id: string
  label: string
  status: "ready" | "live" | "active" | "connected" | "pending" | "optional" | "attention"
  detail: string
}

export interface WorkspaceViewModel {
  state: ProjectState
  phase: JourneyPhase
  brief: WorkspaceBrief
  next: WorkspaceNextStep
  capabilities: CapabilityFlag[]
  canPreview: boolean
  canBuild: boolean
  canInstruct: boolean
  canLaunch: boolean
  isBuilt: boolean
  previewUrl: string | null
  productionUrl: string | null
}

export function workspaceBrief(state: ProjectState, mode?: ProjectMode, name?: string): WorkspaceBrief {
  const live = workspaceIsLive(state)
  const product = name?.trim() || "your product"
  const source = modeNoun(mode)

  switch (state) {
    case "created":
      return {
        role: "cofounder",
        headline: `We're getting ${product} ready to shape.`,
        support: "Your co-founder is preparing to understand what you want to build.",
        live,
      }
    case "pending_plan":
      return {
        role: "product",
        headline: `Your team is drafting the plan for ${product}.`,
        support: "What we learned is being turned into a product and technical plan.",
        live,
      }
    case "analyzing":
      return {
        role: "cofounder",
        headline:
          mode === "scratch"
            ? "Your co-founder is shaping the product from your idea."
            : mode === "github"
              ? "Your team is reading the existing codebase."
              : "Your team is learning from the reference site.",
        support: `We're turning the ${source} into a clear product direction.`,
        live,
      }
    case "analysis_complete":
      return {
        role: "product",
        headline: "The first look is done.",
        support: "Your co-founder and product team are drafting the plan from what we learned — it will be ready for you to review shortly.",
        live,
      }
    case "analysis_failed":
      return {
        role: "cofounder",
        headline: "Understanding needs attention.",
        support: "The research pass stopped before it finished. Your team can retry it from where it left off.",
        live,
      }
    case "plan_failed":
      return {
        role: "product",
        headline: "The plan needs attention.",
        support: "Planning stopped before the plan was complete. Retry it when you're ready — what we already learned is kept.",
        live,
      }
    case "specification_ready":
    case "plan_ready":
      return {
        role: "cofounder",
        headline: "Your product plan is ready.",
        support: "Your co-founder has prepared the product and technical plan. Review it, then start the build when you're ready.",
        live,
      }
    case "awaiting_build_confirmation":
      return {
        role: "cofounder",
        headline: "The plan is waiting on you.",
        support: "Everything needed for the first build is ready. Confirm when you want engineering to start.",
        live,
      }
    case "building":
      return {
        role: "engineering",
        headline: `Engineering is building ${product}.`,
        support: "Your team is turning the approved plan into a working application.",
        live,
      }
    case "build_complete":
    case "ready":
      return {
        role: "product",
        headline: "Your application is ready to preview.",
        support: "The first version is built. Open it, check it over, then launch when it feels right.",
        live,
      }
    case "build_failed":
      return {
        role: "engineering",
        headline: "Engineering could not complete this build.",
        support: "Something stopped. Review what happened, then retry or adjust the project.",
        live,
      }
    case "deploying":
      return {
        role: "launch",
        headline: "The launch team is publishing your application.",
        support: "We're preparing the production deployment.",
        live,
      }
    case "deployed":
      return {
        role: "launch",
        headline: "Your application is live.",
        support: "Your team is ready to help you improve and grow the business.",
        live,
      }
    case "deployment_failed":
      return {
        role: "launch",
        headline: "Launch needs attention.",
        support: "The application could not be deployed. Preview is still available while you retry.",
        live,
      }
  }
  return {
    role: "cofounder",
    headline: "Current status is unavailable.",
    support: "The project's current phase could not be established from its record. Reopen your workspace to refresh it.",
    live: false,
  }
}

export function workspaceProductionUrl(project: Pick<Project, "deployment" | "deploymentHistory">): string | null {
  if (project.deployment?.status === "success" && project.deployment.productionUrl) {
    return project.deployment.productionUrl
  }
  const fromHistory = [...(project.deploymentHistory ?? [])]
    .reverse()
    .find((entry) => entry.status === "success" && entry.productionUrl)
  return fromHistory?.productionUrl ?? project.deployment?.productionUrl ?? null
}

export function workspaceIsPublished(
  project: Pick<Project, "state" | "deployment" | "deploymentHistory">,
): boolean {
  return project.state === "deployed" || Boolean(workspaceProductionUrl(project))
}

export function workspaceNextStep(state: ProjectState, projectId: string, hasPreview: boolean, isPublished = false): WorkspaceNextStep {
  const collaborate = `/project/${projectId}/collaborate`
  const previewAnchor = "#product-preview"

  switch (state) {
    case "plan_ready":
      return {
        kind: "review_plan",
        kicker: "Needs you",
        title: "Your product plan is ready.",
        body: "Your co-founder has prepared the first version of the product and technical plan.",
        actionLabel: "Review plan",
        href: collaborate,
        mutation: null,
        needsYou: true,
      }
    case "specification_ready":
    case "awaiting_build_confirmation":
    case "analysis_complete":
      return {
        kind: "start_build",
        kicker: "Next step",
        title: "Everything needed for the first build is ready.",
        body: "Start building when you want engineering to turn the plan into a working application.",
        actionLabel: "Start building",
        href: null,
        mutation: "build",
        needsYou: true,
      }
    case "building":
    case "analyzing":
    case "pending_plan":
    case "deploying":
      return {
        kind: "wait",
        kicker: "You're all set",
        title: "The team is working on the product.",
        body: "Nothing is needed from you right now. Stay here and watch progress, or come back later.",
        actionLabel: null,
        href: null,
        mutation: null,
        needsYou: false,
      }
    case "build_failed":
      return {
        kind: "retry_build",
        kicker: "Needs you",
        title: "This build stopped.",
        body: "Engineering could not complete the application. Retry, or review the project and try again.",
        actionLabel: "Retry build",
        href: null,
        mutation: "retry_build",
        needsYou: true,
      }
    case "analysis_failed":
      return {
        kind: "retry_analysis",
        kicker: "Needs you",
        title: "Understanding stopped.",
        body: "The research pass could not finish. Retry it here — nothing else has started yet.",
        actionLabel: "Retry understanding",
        href: null,
        mutation: "retry_analysis",
        needsYou: true,
      }
    case "plan_failed":
      return {
        kind: "retry_plan",
        kicker: "Needs you",
        title: "The plan stopped.",
        body: "Planning could not finish. Retry it and we'll reuse what was already understood.",
        actionLabel: "Retry planning",
        href: null,
        mutation: "retry_plan",
        needsYou: true,
      }
    case "deployment_failed":
      return {
        kind: "retry_launch",
        kicker: "Needs you",
        title: "Launch needs attention.",
        body: "The application could not be deployed. Preview is still available.",
        actionLabel: "Retry launch",
        href: null,
        mutation: "retry_launch",
        needsYou: true,
      }
    case "ready":
    case "build_complete":
      if (isPublished) {
        return {
          kind: "grow",
          kicker: "You're all set",
          title: "Your application is live.",
          body: "Keep improving the product, or grow the business with your co-founder.",
          actionLabel: "Ask your co-founder",
          href: "#ask-cofounder",
          mutation: null,
          needsYou: false,
        }
      }
      if (hasPreview) {
        return {
          kind: "launch",
          kicker: "Ready to launch",
          title: "Your application is ready for production.",
          body: "Open the preview, then launch when you want it live.",
          actionLabel: "Launch",
          href: "#publish",
          mutation: null,
          needsYou: true,
        }
      }
      return {
        kind: "open_preview",
        kicker: "Next step",
        title: "Your application is ready.",
        body: "The first version has been built. Open the preview when it appears.",
        actionLabel: "Open preview",
        href: previewAnchor,
        mutation: null,
        needsYou: false,
      }
    case "deployed":
      return {
        kind: "grow",
        kicker: "You're all set",
        title: "Your application is live.",
        body: "Keep improving the product, or grow the business with your co-founder.",
        actionLabel: "Ask your co-founder",
        href: "#ask-cofounder",
        mutation: null,
        needsYou: false,
      }
    default:
      return {
        kind: "wait",
        kicker: "You're all set",
        title: "Your team is preparing the next step.",
        body: "Nothing is needed from you right now.",
        actionLabel: null,
        href: null,
        mutation: null,
        needsYou: false,
      }
  }
}

/** How long each automated step normally takes. Used only to flag a step as
 * unusually slow (never to cancel work) — the founder then gets a restart. */
export const STEP_EXPECTED_MS: Record<JourneyPhase, number> = {
  understand: 8 * 60_000,
  plan: 12 * 60_000,
  build: 35 * 60_000,
  validate: 0,
  launch: 15 * 60_000,
}

const STAGE_PHASE: Record<JourneyPhase, RegExp> = {
  understand: /analy|understand|research|crawl/i,
  plan: /specify|plan/i,
  build: /build|agent|code/i,
  validate: /validate|test|preview/i,
  launch: /deploy|launch|hosting/i,
}

const STEP_ACTION: Record<
  JourneyPhase,
  { mutation: Extract<WorkspaceMutation, "retry_analysis" | "retry_plan" | "retry_build" | "retry_launch">; label: string } | null
> = {
  understand: { mutation: "retry_analysis", label: "Retry understanding" },
  plan: { mutation: "retry_plan", label: "Retry planning" },
  build: { mutation: "retry_build", label: "Retry build" },
  validate: null,
  launch: { mutation: "retry_launch", label: "Retry launch" },
}

export interface JourneyStepAction {
  label: string
  mutation: Extract<WorkspaceMutation, "retry_analysis" | "retry_plan" | "retry_build" | "retry_launch">
  /** True when the step was still running and the founder is forcing a restart. */
  restart: boolean
}

export interface JourneyStepView {
  id: JourneyPhase
  label: string
  sub: string
  team: string
  status: JourneyTeamStatus
  statusLabel: string
  /** Latest founder-facing activity for this step, if any. */
  detail: string | null
  detailAt: number | null
  /** Time since the last activity — only set for the step that is running. */
  elapsedMs: number | null
  expectedMs: number
  /** Running past its expected window with no new activity. */
  stalled: boolean
  /** Automatic attempts made by the server for this step's current run. */
  attempts: number | null
  action: JourneyStepAction | null
}

const STEP_STATUS_LABEL: Record<JourneyTeamStatus, string> = {
  completed: "completed",
  at_work: "at work",
  needs_attention: "needs attention",
  getting_ready: "getting ready",
  upcoming: "upcoming",
}

/** Quiet time after which a running Understand/Plan step can be restarted.
 * Matches the server's stall window (lib/projects/pipeline-recovery.ts) so the
 * button is only offered when the restart can actually claim the step. */
const STEP_RESTART_MS: Partial<Record<JourneyPhase, number>> = {
  understand: 20 * 60_000,
  plan: 20 * 60_000,
}

function phaseForStage(stage: string): JourneyPhase | null {
  for (const phase of Object.keys(STAGE_PHASE) as JourneyPhase[]) {
    if (STAGE_PHASE[phase].test(stage)) return phase
  }
  return null
}

/** True once a finished plan exists that the founder can review in Collaborate,
 * regardless of whether the state record still lags behind the pipelines. */
export function planIsReviewable(project: Pick<Project, "state" | "specification">): boolean {
  if (project.state === "plan_failed" || project.state === "analysis_failed") return false
  return (
    Boolean(project.specification) ||
    project.state === "specification_ready" ||
    project.state === "plan_ready" ||
    project.state === "awaiting_build_confirmation"
  )
}

function concise(message: string): string {
  const cleaned = message.replace(/\s+/g, " ").trim()
  return cleaned.length > 160 ? `${cleaned.slice(0, 157)}…` : cleaned
}

/** Per-step view for the workspace: what each of the five steps is doing,
 * how long it has been quiet, and the one recovery action that applies. */
export function buildJourneySteps(
  project: Pick<Project, "state" | "events" | "updatedAt" | "error" | "pipelineRecovery" | "specification"> & {
    mode?: ProjectMode
  },
  now = Date.now(),
): JourneyStepView[] {
  const state = project.state
  // An idea-only project starts in Plan: there is no crawl/analysis, so the
  // work happening during `analyzing` is the plan itself.
  const current: JourneyPhase =
    project.mode === "scratch" && state === "analyzing" ? "plan" : journeyPhase(state)
  const failedStep = failedJourneyStep(state)
  // The plan artifact is the ground truth that planning finished — pipelines
  // can sit on a stale "analyzing"/failure state after a fallback retry while
  // the specification is already stored and plan events say it succeeded.
  const planArtifactReady = state !== "plan_failed" && planIsReviewable(project)
  const events = project.events ?? []
  const latestOverall = events.reduce((max, e) => (e.at > max ? e.at : max), 0)

  return JOURNEY.map((step) => {
    let status = journeyTeamStatus(step.id, current, state)
    if (step.id === "plan" && (status === "at_work" || status === "getting_ready") && planArtifactReady) {
      status = "completed"
    }
    const phaseEvents = events.filter((e) => phaseForStage(e.stage) === step.id)
    const latestPhaseEvent = phaseEvents.reduce<ProjectEvent | null>(
      (latest, e) => (!latest || e.at > latest.at ? e : latest),
      null,
    )
    const isCurrent = step.id === current
    const detailAt = latestPhaseEvent?.at ?? (isCurrent ? latestOverall || project.updatedAt || null : null)
    const elapsedMs = isCurrent && detailAt ? Math.max(0, now - detailAt) : null
    const expectedMs =
      state === "created"
        ? 90_000
        : state === "pending_plan"
          ? 2 * 60_000
          : STEP_EXPECTED_MS[step.id]
    const running = status === "at_work" || status === "getting_ready"
    const stalled = Boolean(running && expectedMs > 0 && elapsedMs !== null && elapsedMs > expectedMs)
    const restartWindow =
      state === "created" ? expectedMs : STEP_RESTART_MS[step.id] ?? Number.POSITIVE_INFINITY
    const base = STEP_ACTION[step.id]
    const action: JourneyStepAction | null = base
      ? failedStep === step.id
        ? { ...base, restart: false }
        : stalled && (elapsedMs ?? 0) >= restartWindow
          ? { ...base, label: "Restart this step", restart: true }
          : null
      : null

    return {
      id: step.id,
      label: step.label,
      sub: step.sub,
      team: JOURNEY_TEAMS[step.id],
      status,
      statusLabel: STEP_STATUS_LABEL[status],
      detail:
        failedStep === step.id && project.error
          ? concise(project.error)
          : latestPhaseEvent
            ? concise(latestPhaseEvent.message)
            : null,
      detailAt,
      elapsedMs,
      expectedMs,
      stalled,
      attempts:
        isCurrent && project.pipelineRecovery?.phase === step.id
          ? project.pipelineRecovery.attempts
          : null,
      action,
    }
  })
}

export function workspaceCapabilities(project: Pick<
  Project,
  | "state"
  | "developmentUrl"
  | "totalumProjectId"
  | "deploymentHistory"
  | "runtimeProvisioning"
> & { githubConnected?: boolean }): CapabilityFlag[] {
  const built = Boolean(project.totalumProjectId)
  const preview = Boolean(project.developmentUrl)
  const liveProd = project.deploymentHistory?.some((d) => d.status === "success") ?? false
  const runtimeReady = Boolean(project.runtimeProvisioning) || built
  const buildFailed = project.state === "build_failed"
  const launchFailed = project.state === "deployment_failed"

  return [
    {
      id: "build",
      label: "Build",
      status: buildFailed ? "attention" : built || project.state === "ready" || project.state === "build_complete" ? "ready" : project.state === "building" ? "pending" : "pending",
      detail: buildFailed ? "Needs attention" : built || project.state === "ready" || project.state === "build_complete" ? "Complete" : project.state === "building" ? "In progress" : "Not started",
    },
    {
      id: "preview",
      label: "Preview",
      status: preview ? "live" : "pending",
      detail: preview ? "Live" : "Not available yet",
    },
    {
      id: "runtime",
      label: "Runtime",
      status: runtimeReady ? "ready" : "pending",
      detail: runtimeReady ? "Healthy" : "Provisioning after the first build",
    },
    {
      id: "database",
      label: "Database",
      status: built ? "connected" : "pending",
      detail: built ? "Connected" : "Available after the first build",
    },
    {
      id: "hosting",
      label: "Hosting",
      status: launchFailed ? "attention" : liveProd ? "active" : built ? "ready" : "pending",
      detail: launchFailed ? "Needs attention" : liveProd ? "Active" : built ? "Ready to launch" : "After the application is built",
    },
    {
      id: "environment",
      label: "Environment",
      status: built ? "ready" : "pending",
      detail: built ? "Ready" : "Available after the first build",
    },
    {
      id: "github",
      label: "GitHub",
      status: project.githubConnected ? "connected" : "optional",
      detail: project.githubConnected ? "Connected" : "Not connected",
    },
  ]
}

export function buildWorkspaceView(project: Project, githubConnected?: boolean): WorkspaceViewModel {
  const state = project.state
  const previewUrl = project.developmentUrl ?? null
  const productionUrl = workspaceProductionUrl(project)
  const isPublished = workspaceIsPublished(project)
  const isBuilt = Boolean(project.totalumProjectId)
  const hasSpec = Boolean(project.specification)
  let next = workspaceNextStep(state, project.id, Boolean(previewUrl), isPublished)
  if (next.mutation === "build" && !hasSpec) {
    next = {
      kind: "wait",
      kicker: "You're all set",
      title: "Your team is still shaping the plan.",
      body: "Nothing is needed from you right now.",
      actionLabel: null,
      href: null,
      mutation: null,
      needsYou: false,
    }
  }

  return {
    state,
    phase: isPublished && (state === "ready" || state === "build_complete") ? "launch" : journeyPhase(state),
    brief: isPublished && (state === "ready" || state === "build_complete")
      ? workspaceBrief("deployed", project.mode, project.name)
      : workspaceBrief(state, project.mode, project.name),
    next,
    capabilities: workspaceCapabilities({ ...project, githubConnected }),
    canPreview: Boolean(previewUrl),
    canBuild: hasSpec && !LIVE.has(state) && state !== "ready" && state !== "deployed" && state !== "build_complete",
    canInstruct: isBuilt && !LIVE.has(state),
    canLaunch: isBuilt && (state === "ready" || state === "build_complete") && !isPublished,
    isBuilt,
    previewUrl,
    productionUrl,
  }
}

/** @deprecated Use workspaceBrief. Kept so older call sites compile during the refactor. */
export function workspaceTeam(state: ProjectState): { kicker: string; floor: string } {
  const brief = workspaceBrief(state)
  const labels: Record<TeamRole, string> = {
    cofounder: "Co-founder · Strategy",
    product: "Product · Experience",
    engineering: "Engineering · Build",
    launch: "Launch · Production",
  }
  return { kicker: labels[brief.role], floor: brief.support }
}
