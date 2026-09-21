import type { Project, ProjectMode, ProjectState } from "@/lib/types/project"

export type JourneyPhase = "understand" | "plan" | "build" | "validate" | "launch"
export type TeamRole = "cofounder" | "product" | "engineering" | "launch"
export type NextActionKind =
  | "review_plan"
  | "start_build"
  | "open_preview"
  | "launch"
  | "retry_build"
  | "retry_launch"
  | "wait"
  | "grow"

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

export function journeyTeamStatus(
  phase: JourneyPhase,
  current: JourneyPhase,
  state: ProjectState,
): JourneyTeamStatus {
  const order: JourneyPhase[] = ["understand", "plan", "build", "validate", "launch"]
  const index = order.indexOf(phase)
  const here = order.indexOf(current)
  if (index < here) return "completed"
  if (index > here) return "upcoming"
  if (state === "build_failed" || state === "deployment_failed") return "needs_attention"
  if (workspaceIsLive(state)) return "at_work"
  if (state === "created" || state === "pending_plan") return "getting_ready"
  return "completed"
}

const LIVE: ReadonlySet<ProjectState> = new Set(["analyzing", "building", "deploying"])

export function workspaceIsLive(state: ProjectState): boolean {
  return LIVE.has(state)
}

export function journeyPhase(state: ProjectState): JourneyPhase {
  switch (state) {
    case "created":
    case "pending_plan":
    case "analyzing":
    case "analysis_complete":
      return "understand"
    case "specification_ready":
    case "plan_ready":
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
}

export function teamRoleForState(state: ProjectState): TeamRole {
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
  mutation: "build" | "deploy" | "retry_build" | "retry_launch" | null
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
    case "pending_plan":
      return {
        role: "cofounder",
        headline: `We're getting ${product} ready to shape.`,
        support: "Your co-founder is preparing to understand what you want to build.",
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
        role: "cofounder",
        headline: "The first look is done.",
        support: "Next, your co-founder and product team will turn this into a plan you can review.",
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
}

export function workspaceNextStep(state: ProjectState, projectId: string, hasPreview: boolean): WorkspaceNextStep {
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
  const productionUrl =
    [...(project.deploymentHistory ?? [])].reverse().find((d) => d.status === "success")?.productionUrl ?? null
  const isBuilt = Boolean(project.totalumProjectId)
  const hasSpec = Boolean(project.specification)
  let next = workspaceNextStep(state, project.id, Boolean(previewUrl))
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
    phase: journeyPhase(state),
    brief: workspaceBrief(state, project.mode, project.name),
    next,
    capabilities: workspaceCapabilities({ ...project, githubConnected }),
    canPreview: Boolean(previewUrl),
    canBuild: hasSpec && !LIVE.has(state) && state !== "ready" && state !== "deployed" && state !== "build_complete",
    canInstruct: isBuilt && !LIVE.has(state),
    canLaunch: isBuilt && (state === "ready" || state === "build_complete"),
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
