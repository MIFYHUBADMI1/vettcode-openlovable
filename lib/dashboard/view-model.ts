import type { ProjectState, ProjectSummary } from "@/lib/types/project"

export interface DashboardActivityEvent {
  id: string
  at: number
  level: string
  stage: string
  message: string
}

export type JourneyStage = "vision" | "plan" | "build" | "launch" | "grow"

export type ActionSeverity = "info" | "success" | "warning" | "error" | "neutral"

export interface DashboardAction {
  label: string
  href: string
}

export interface DashboardStatus {
  headline: string
  description: string
  primaryAction: DashboardAction
  secondaryAction?: DashboardAction
  severity: ActionSeverity
  journeyStage: JourneyStage
  founderLabel: string
}

export interface AttentionItem {
  id: string
  title: string
  description: string
  href: string
  actionLabel: string
  severity: ActionSeverity
  projectId?: string
}

export interface ActivityItem {
  id: string
  at: number
  title: string
  projectName?: string
  href: string
  level: "info" | "warn" | "error"
}

const ACTION_STATES = new Set<ProjectState>([
  "plan_ready",
  "awaiting_build_confirmation",
  "build_failed",
  "deployment_failed",
  "specification_ready",
])

const ACTIVE_BUILD = new Set<ProjectState>(["building", "analyzing", "deploying"])

const COMPLETED_WORK = new Set<ProjectState>([
  "build_complete",
  "ready",
  "deployed",
])

export function interpretProjectState(state: ProjectState, projectId: string): DashboardStatus {
  const workspace = `/project/${projectId}`
  const collaborate = `${workspace}/collaborate`
  const edit = `${workspace}/edit`

  switch (state) {
    case "created":
    case "pending_plan":
      return {
        headline: "Your idea is ready to shape.",
        description: "Atai is preparing to understand what you're building.",
        primaryAction: { label: "Open project", href: workspace },
        secondaryAction: { label: "Ask Atai", href: collaborate },
        severity: "info",
        journeyStage: "vision",
        founderLabel: "Getting started",
      }
    case "analyzing":
      return {
        headline: "Atai is studying your source.",
        description: "We're turning your input into a clear product direction.",
        primaryAction: { label: "Watch progress", href: workspace },
        secondaryAction: { label: "Ask Atai", href: collaborate },
        severity: "info",
        journeyStage: "vision",
        founderLabel: "Understanding",
      }
    case "analysis_complete":
      return {
        headline: "Atai finished the first look.",
        description: "Next, we'll shape this into a plan you can review.",
        primaryAction: { label: "Continue", href: workspace },
        secondaryAction: { label: "Ask Atai", href: collaborate },
        severity: "success",
        journeyStage: "plan",
        founderLabel: "Ready to plan",
      }
    case "specification_ready":
    case "plan_ready":
      return {
        headline: "Your plan is ready for your review.",
        description: "Read it in plain language, refine it with Atai, then start building when you're ready.",
        primaryAction: { label: "Review & refine", href: collaborate },
        secondaryAction: { label: "Open project", href: workspace },
        severity: "success",
        journeyStage: "plan",
        founderLabel: "Plan ready",
      }
    case "awaiting_build_confirmation":
      return {
        headline: "Your application is ready to start building.",
        description: "Confirm when you want Atai to turn the plan into a working product.",
        primaryAction: { label: "Start building", href: collaborate },
        secondaryAction: { label: "Review plan", href: `${workspace}/plan` },
        severity: "warning",
        journeyStage: "build",
        founderLabel: "Waiting for you",
      }
    case "building":
      return {
        headline: "Atai is building your product.",
        description: "This can take a while. You can watch progress or come back later.",
        primaryAction: { label: "Watch build", href: workspace },
        secondaryAction: { label: "Ask Atai", href: collaborate },
        severity: "info",
        journeyStage: "build",
        founderLabel: "Building",
      }
    case "build_complete":
    case "ready":
      return {
        headline: "Your product is ready.",
        description: "Open the application, check it over, then publish when it feels right.",
        primaryAction: { label: "Open your application", href: workspace },
        secondaryAction: { label: "Go live", href: workspace },
        severity: "success",
        journeyStage: "launch",
        founderLabel: "Product built",
      }
    case "build_failed":
      return {
        headline: "Your build needs attention.",
        description: "Atai couldn't finish the latest build. Review the details and try again.",
        primaryAction: { label: "Fix build", href: edit },
        secondaryAction: { label: "View details", href: workspace },
        severity: "error",
        journeyStage: "build",
        founderLabel: "Build needs attention",
      }
    case "deploying":
      return {
        headline: "Your application is going live.",
        description: "Atai is publishing your product.",
        primaryAction: { label: "Watch launch", href: workspace },
        secondaryAction: { label: "Open project", href: workspace },
        severity: "info",
        journeyStage: "launch",
        founderLabel: "Launching",
      }
    case "deployed":
      return {
        headline: "Your application is live.",
        description: "Keep improving the product, or start another business from Home.",
        primaryAction: { label: "Open live app", href: workspace },
        secondaryAction: { label: "Open runtime", href: `${workspace}/runtime` },
        severity: "success",
        journeyStage: "grow",
        founderLabel: "Live",
      }
    case "deployment_failed":
      return {
        headline: "Launch needs attention.",
        description: "The latest publish didn't complete. Review what happened and try again.",
        primaryAction: { label: "Fix launch", href: workspace },
        secondaryAction: { label: "View details", href: workspace },
        severity: "error",
        journeyStage: "launch",
        founderLabel: "Launch needs attention",
      }
  }
}

export function selectActiveProject(projects: ProjectSummary[]): ProjectSummary | null {
  if (projects.length === 0) return null

  const rank = (p: ProjectSummary) => {
    if (p.state === "build_failed" || p.state === "deployment_failed") return 0
    if (ACTION_STATES.has(p.state)) return 1
    if (ACTIVE_BUILD.has(p.state)) return 2
    if (COMPLETED_WORK.has(p.state)) return 3
    return 4
  }

  return [...projects].sort((a, b) => {
    const rd = rank(a) - rank(b)
    if (rd !== 0) return rd
    return b.updatedAt - a.updatedAt
  })[0]!
}

export function getJourneyProgress(state: ProjectState): JourneyStage[] {
  const order: JourneyStage[] = ["vision", "plan", "build", "launch", "grow"]
  const current = interpretProjectState(state, "_").journeyStage
  const idx = order.indexOf(current)
  return order.slice(0, idx + 1)
}

export function getDashboardAttentionItems(input: {
  projects: ProjectSummary[]
  emailVerified: boolean
  creditsAvailable?: number
}): AttentionItem[] {
  const items: AttentionItem[] = []

  if (!input.emailVerified) {
    items.push({
      id: "email",
      title: "Verify your email",
      description: "Confirm your address to unlock account features.",
      href: "/settings/profile",
      actionLabel: "Verify",
      severity: "warning",
    })
  }

  for (const project of input.projects) {
    if (project.state === "build_failed") {
      items.push({
        id: `build-fail-${project.id}`,
        title: "Build needs attention",
        description: `${project.name}: the latest build could not complete.`,
        href: `/project/${project.id}/edit`,
        actionLabel: "Fix build",
        severity: "error",
        projectId: project.id,
      })
    } else if (project.state === "deployment_failed") {
      items.push({
        id: `deploy-fail-${project.id}`,
        title: "Launch needs attention",
        description: `${project.name}: publishing didn't finish.`,
        href: `/project/${project.id}`,
        actionLabel: "Fix launch",
        severity: "error",
        projectId: project.id,
      })
    } else if (project.state === "plan_ready" || project.state === "specification_ready") {
      items.push({
        id: `plan-${project.id}`,
        title: "Plan review needed",
        description: `${project.name}: your plan is ready to review.`,
        href: `/project/${project.id}/collaborate`,
        actionLabel: "Review plan",
        severity: "info",
        projectId: project.id,
      })
    } else if (project.state === "awaiting_build_confirmation") {
      items.push({
        id: `confirm-${project.id}`,
        title: "Ready to build",
        description: `${project.name}: confirm when you want Atai to start building.`,
        href: `/project/${project.id}/collaborate`,
        actionLabel: "Start building",
        severity: "warning",
        projectId: project.id,
      })
    }
  }

  if (typeof input.creditsAvailable === "number" && input.creditsAvailable < 1000 && input.emailVerified) {
    items.push({
      id: "credits",
      title: "Credits are running low",
      description: "You can still work on plans. Manage usage when you're ready for a build.",
      href: "/settings/billing",
      actionLabel: "Manage usage",
      severity: "warning",
    })
  }

  return items
}

export type InboxKind = "action" | "progress" | "update"

export interface InboxItem {
  id: string
  at: number
  title: string
  description: string
  href: string
  actionLabel: string
  severity: ActionSeverity
  kind: InboxKind
}

const SEVERITY_RANK: Record<ActionSeverity, number> = {
  error: 0,
  warning: 1,
  success: 2,
  info: 3,
  neutral: 4,
}

const RECENT_MS = 14 * 24 * 60 * 60 * 1000

export function buildNotificationInbox(input: {
  projects: ProjectSummary[]
  emailVerified: boolean
  creditsAvailable?: number
  now?: number
  featureRequests?: { id: string; title: string; status: string; updatedAt: number }[]
}): InboxItem[] {
  const now = input.now ?? Date.now()
  const items: InboxItem[] = []
  const covered = new Set<string>()

  for (const item of getDashboardAttentionItems(input)) {
    const project = item.projectId ? input.projects.find((p) => p.id === item.projectId) : undefined
    items.push({
      id: item.id,
      at: project?.updatedAt ?? now,
      title: item.title,
      description: item.description,
      href: item.href,
      actionLabel: item.actionLabel,
      severity: item.severity,
      kind: "action",
    })
    if (item.projectId) covered.add(item.projectId)
  }

  for (const project of input.projects) {
    if (covered.has(project.id)) continue
    if (project.state === "building" || project.state === "analyzing" || project.state === "deploying") {
      const status = interpretProjectState(project.state, project.id)
      items.push({
        id: `progress-${project.id}-${project.state}`,
        at: project.updatedAt,
        title: status.headline,
        description: `${project.name}: ${status.description}`,
        href: status.primaryAction.href,
        actionLabel: status.primaryAction.label,
        severity: "info",
        kind: "progress",
      })
      covered.add(project.id)
      continue
    }
    if (
      (project.state === "ready" || project.state === "deployed" || project.state === "build_complete") &&
      now - project.updatedAt <= RECENT_MS
    ) {
      const status = interpretProjectState(project.state, project.id)
      items.push({
        id: `ready-${project.id}-${project.state}-${project.updatedAt}`,
        at: project.updatedAt,
        title: status.headline,
        description: `${project.name}: ${status.description}`,
        href: status.primaryAction.href,
        actionLabel: status.primaryAction.label,
        severity: "success",
        kind: "update",
      })
    }
  }

  const requestStatusCopy: Record<string, { title: string; action: string }> = {
    under_review: { title: "Atai is reviewing your request", action: "View request" },
    planned: { title: "Atai plans to build this", action: "View request" },
    in_progress: { title: "Atai is building your request", action: "View request" },
    shipped: { title: "Your request shipped", action: "See what's new" },
    declined: { title: "Atai decided not to pursue this", action: "View request" },
  }
  const requests = [...(input.featureRequests ?? [])]
    .filter((r) => requestStatusCopy[r.status])
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 3)
  for (const request of requests) {
    const copy = requestStatusCopy[request.status]!
    items.push({
      id: `fr-${request.id}-${request.status}-${request.updatedAt}`,
      at: request.updatedAt,
      title: copy.title,
      description: request.title,
      href: `/feature-requests/${request.id}`,
      actionLabel: copy.action,
      severity: request.status === "shipped" ? "success" : request.status === "declined" ? "neutral" : "info",
      kind: "update",
    })
  }

  return items
    .sort((a, b) => {
      const sr = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
      if (sr !== 0) return sr
      return b.at - a.at
    })
    .slice(0, 12)
}

const NOISY_STAGES = new Set(["heartbeat", "poll", "status"])

export function filterMeaningfulActivity(
  events: DashboardActivityEvent[],
  project: ProjectSummary,
  limit = 8,
): ActivityItem[] {
  return events
    .filter((event) => {
      const stage = event.stage.toLowerCase()
      if (NOISY_STAGES.has(stage)) return false
      if (!event.message?.trim()) return false
      return true
    })
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)
    .map((event) => ({
      id: event.id,
      at: event.at,
      title: event.message.trim(),
      projectName: project.name,
      href: `/project/${project.id}`,
      level: event.level === "error" || event.level === "warn" ? event.level : "info",
    }))
}

export function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}
