import type { Project, ProjectEvent, ProjectState } from "@/lib/types/project"
import {
  JOURNEY,
  type JourneyPhase,
  type TeamRole,
  type WorkspaceNextStep,
  buildWorkspaceView,
  journeyPhase,
} from "@/lib/workspace/workspace-view-model"
import { isFounderFacingEvent, roleForStage } from "@/lib/workspace/team-roles"

/**
 * Progress view model — one consistent interpretation of project state for
 * the Team Progress page. It consumes only existing project fields and
 * existing workspace helpers; it never implies capabilities the backend does
 * not support (no staff identities, no task queues, no live agent claims).
 */

export type WorkstreamId = Extract<TeamRole, "cofounder" | "product" | "engineering" | "launch"> | "research"

/** Honest, presentable workstream status (Part 3.2 list). */
export type WorkstreamStatus =
  | "working"
  | "waiting_on_you"
  | "needs_attention"
  | "idle"
  | "completed_this_phase"
  | "not_started"
  | "status_unavailable"

/** Founder-facing labels. `working` is the display form of workspace `at_work`. */
export const WORKSTREAM_STATUS_LABEL: Record<WorkstreamStatus, string> = {
  working: "Working",
  waiting_on_you: "Waiting on you",
  needs_attention: "Needs attention",
  idle: "Idle",
  completed_this_phase: "Completed this phase",
  not_started: "Not started",
  status_unavailable: "Status unavailable",
}

export type ProgressMutation = "build" | "retry_build" | "retry_launch" | "deploy" | null

export interface WorkstreamCommand {
  kind: "mutation" | "navigate" | "brief"
  label: string
  mutation?: Exclude<ProgressMutation, null>
  href?: string
  brief?: string
}

export interface WorkstreamCard {
  id: WorkstreamId
  name: string
  responsibility: string
  status: WorkstreamStatus
  /** Most recent founder-facing note attributable to this workstream, if any. */
  latestNote: string | null
  latestAt: number | null
  /** Navigation target when the current state gives this stream a real destination. */
  action: { label: string; href: string } | null
  /** Founder command for this workstream — only real handlers or the co-founder. */
  command: WorkstreamCommand | null
}

export interface JourneyStageView {
  id: JourneyPhase
  label: string
  workstream: TeamRole
  status: "complete" | "active" | "attention" | "not_started" | "unverified"
  evidence: { label: string; href: string } | null
  note: string | null
}

export interface FounderAttentionItem {
  id: string
  title: string
  body: string
  action: { label: string; href: string; external?: boolean } | null
  secondaryAction: { label: string; href: string } | null
  /** Server mutation to invoke from this page, if the existing API supports it. */
  mutation: ProgressMutation
}

export interface HistoryEntry {
  id: string
  at: number
  kind: "outcome" | "failure" | "note"
  role: TeamRole
  message: string
}

export interface Deliverable {
  id: string
  label: string
  href: string
  external?: boolean
  context: JourneyPhase
}

export type NowState =
  | "working"
  | "waiting_on_you"
  | "needs_attention"
  | "idle"
  | "empty"
  | "unavailable"

export interface NowSection {
  state: NowState
  headline: string
  body: string
  workstream: WorkstreamId | null
  action: { label: string; href: string; external?: boolean } | null
}

export interface FounderControl {
  id: string
  label: string
  value: string
  href?: string
}

export interface ProgressViewModel {
  state: ProjectState
  stateKnown: boolean
  /** True while analyzing/building/deploying on the server. */
  live: boolean
  phase: JourneyPhase
  brief: { headline: string; support: string }
  now: NowSection
  workstreams: WorkstreamCard[]
  journey: JourneyStageView[]
  attention: FounderAttentionItem[]
  history: HistoryEntry[]
  deliverables: Deliverable[]
  handoffs: HandoffRecord[]
  /** What the founder actually set — this is what teams are supposed to follow. */
  founderControls: FounderControl[]
  /** Active build run, if the project is currently building. */
  activeBuildRun: BuildRunView | null
  /** Latest meaningful event timestamp, for the last-updated indicator. */
  lastUpdatedAt: number | null
}

/** A real workflow transition derived from project state + events. */
export interface HandoffRecord {
  id: string
  from: JourneyPhase
  to: JourneyPhase
  reason: string
  at: number
  resultingTask: string | null
  artifact: { label: string; href: string } | null
}

/** Active build run summary for the current-task section. */
export interface BuildRunView {
  id: string
  kind: "initial" | "followup"
  status: string
  startedAt: number
  totalumProjectId?: string
  error?: string
}

// ─── Internals ────────────────────────────────────────────────────────────────

const KNOWN_STATES = new Set<ProjectState>([
  "created", "analyzing", "analysis_complete", "specification_ready", "plan_ready",
  "awaiting_build_confirmation", "building", "build_complete", "build_failed",
  "ready", "deploying", "deployed", "deployment_failed", "pending_plan",
])

function isKnownState(state: ProjectState): boolean {
  return KNOWN_STATES.has(state)
}

/** Never surface secrets, stacks, or provider dumps in founder history. */
export function founderSafeMessage(raw: string | undefined): string {
  const message = raw?.trim() ?? ""
  if (!message) return "An update was recorded during this phase."
  if (/sk-[a-zA-Z0-9]|api[_-]?key|Bearer\s+|Authorization:/i.test(message)) {
    return "An update was recorded during this phase."
  }
  if (/at [\w./]+:\d+/i.test(message) || (message.length > 500 && /Error:|Exception/i.test(message))) {
    return "This operation needs attention. Open the workspace for details."
  }
  return message
}

function devUrl(value: string | undefined): string | null {
  return value ? value : null
}

/** Failure→success supersession: only surface a failed state as current if it
 * is genuinely the latest server state; historical failure events that a later
 * good state superseded stay in history, not in the "Now"/attention sections. */
function failureMessage(events: ProjectEvent[] | undefined, state: ProjectState): { at: number; message: string } | null {
  if (state !== "build_failed" && state !== "deployment_failed") return null
  const recent = [...(events ?? [])]
    .filter(
      (e) =>
        e.level === "error" &&
        (state === "build_failed"
          ? /build/i.test(e.stage) || /build/i.test(e.message)
          : /deploy|launch/i.test(e.stage) || /deploy|launch/i.test(e.message)),
    )
    .sort((a, b) => b.at - a.at)
  const latest = recent[0]
  return latest ? { at: latest.at, message: latest.message } : null
}

/** Founder-facing events, oldest→newest. */
function meaningfulEvents(events: ProjectEvent[] | undefined): ProjectEvent[] {
  return [...(events ?? [])].filter(isFounderFacingEvent).sort((a, b) => a.at - b.at)
}

// ─── Founder attention (strictly from existing next-step logic) ────────────

function attentionFromNext(next: WorkspaceNextStep, projectId: string, project: Project): FounderAttentionItem[] {
  const COLLAPSE = new Set(["wait", "grow"])
  if (COLLAPSE.has(next.kind)) {
    return []
  }
  const href = next.href
    ? next.href.startsWith("#")
      ? null // anchors only exist on the workspace page, not here
      : next.href
    : null
  const needsYou = next.needsYou
  const base = `/project/${projectId}`

  let mutation: ProgressMutation = null
  if (next.mutation === "build") mutation = "build"
  else if (next.mutation === "retry_build") mutation = "retry_build"
  else if (next.mutation === "retry_launch") mutation = "retry_launch"
  else if (next.kind === "launch" && (project.state === "ready" || project.state === "build_complete") && project.totalumProjectId) {
    mutation = "deploy"
  }

  const action =
    mutation
      ? null
      : href
        ? { label: next.actionLabel ?? "Open", href, external: false }
        : needsYou
          ? { label: "Open your workspace", href: base }
          : null

  return [
    {
      id: `step-${next.kind}`,
      title: next.title,
      body: next.body,
      action,
      secondaryAction: mutation
        ? { label: "Open workspace", href: base }
        : project.state === "build_failed" || project.state === "deployment_failed"
          ? { label: "Ask your co-founder", href: `${base}/progress` }
          : null,
      mutation,
    },
  ]
}

// ─── Workstreams ─────────────────────────────────────────────────────────────

const WORKSTREAM_META: Record<WorkstreamId, { name: string; responsibility: string }> = {
  cofounder: { name: "AI co-founder", responsibility: "Coordinates work and founder decisions" },
  research: { name: "Research", responsibility: "Understanding the idea, site, or codebase" },
  product: { name: "Product & UX", responsibility: "Planning, specifications, and experience" },
  engineering: { name: "Engineering", responsibility: "Implementation and builds" },
  launch: { name: "Launch", responsibility: "Deployment and production readiness" },
}

/** Every event stage maps to a role; unknown stages stay attributable but we
 * render them neutrally rather than inventing team activity. */
function workstreamForEvent(event: ProjectEvent): TeamRole | "research" {
  const s = event.stage.toLowerCase()
  if (s.includes("analy") || s.includes("understand") || s.includes("research")) return "research"
  return roleForStage(event.stage)
}

function workstreamStates(
  project: Project,
  _events: ProjectEvent[],
): Record<WorkstreamId, WorkstreamStatus> {
  const state = project.state
  const specExists = Boolean(project.specification)
  const planReady = state === "plan_ready" || state === "awaiting_build_confirmation"
  const understood = Boolean(project.understanding || project.idea)

  const cofounder: WorkstreamStatus = (() => {
    if (!isKnownState(state)) return "status_unavailable"
    if (state === "analyzing" || state === "pending_plan") return "working"
    if (planReady) return "waiting_on_you"
    return "idle"
  })()

  const research: WorkstreamStatus = (() => {
    if (!isKnownState(state)) return "status_unavailable"
    if (state === "analyzing" || state === "pending_plan") return "working"
    if (state === "analysis_complete") return "completed_this_phase"
    if (understood || specExists) return "completed_this_phase"
    if (state === "created") return "not_started"
    return "not_started"
  })()

  const product: WorkstreamStatus = (() => {
    if (!isKnownState(state)) return "status_unavailable"
    if (planReady || state === "specification_ready") return "waiting_on_you"
    if (state === "created") return specExists ? "waiting_on_you" : "not_started"
    if (state === "ready" || state === "build_complete") return "idle"
    return "not_started"
  })()

  const engineering: WorkstreamStatus = (() => {
    if (!isKnownState(state)) return "status_unavailable"
    if (state === "building") return "working"
    if (state === "build_failed") return "needs_attention"
    if (state === "analysis_complete") return "waiting_on_you"
    if (state === "ready" || state === "build_complete") {
      return specExists || Boolean(project.totalumProjectId) ? "completed_this_phase" : "not_started"
    }
    if (state === "deploying" || state === "deployed" || state === "deployment_failed") {
      return specExists || Boolean(project.totalumProjectId) ? "idle" : "not_started"
    }
    return "not_started"
  })()

  const launch: WorkstreamStatus = (() => {
    if (!isKnownState(state)) return "status_unavailable"
    if (state === "deploying") return "working"
    if (state === "deployment_failed") return "needs_attention"
    if (state === "deployed") return "completed_this_phase"
    if (state === "ready" || state === "build_complete") return "waiting_on_you"
    return "not_started"
  })()

  return { cofounder, research, product, engineering, launch }
}

function workstreamNote(
  id: WorkstreamId,
  events: ProjectEvent[],
): { message: string; at: number } | null {
  const owned = events.filter((e) => workstreamForEvent(e) === id)
  const latest = owned[owned.length - 1]
  return latest ? { message: latest.message, at: latest.at } : null
}

function workstreamAction(
  id: WorkstreamId,
  project: Project,
): { label: string; href: string } | null {
  const base = `/project/${project.id}`
  switch (id) {
    case "cofounder":
      return { label: "Ask your co-founder", href: `${base}/collaborate` }
    case "research":
      return project.understanding || project.idea || project.specification
        ? { label: "See what was understood", href: `${base}/plan` }
        : { label: "Ask your co-founder", href: `${base}/collaborate` }
    case "product":
      return project.specification ? { label: "Read the plan", href: `${base}/plan` } : null
    case "engineering":
      if (project.state === "building") return { label: "Watch build", href: base }
      if (project.state === "build_failed") return { label: "Review build", href: `${base}/edit` }
      if (project.specification) return { label: "Review the build", href: base }
      return null
    case "launch":
      if (project.totalumProjectId) return { label: "Open launch settings", href: `${base}/hosting` }
      return null
  }
}

function workstreamCommand(id: WorkstreamId, project: Project): WorkstreamCommand {
  const name = project.name || "this product"
  switch (id) {
    case "cofounder":
      return {
        kind: "brief",
        label: "Give an order",
        brief: `You are my AI co-founder on ${name}. Coordinate the next real step from the current project state. Do not claim work you cannot actually run.`,
      }
    case "research":
      return {
        kind: "brief",
        label: "Direct research",
        brief: `Direct the research workstream on ${name}: summarize what we already understand and what still needs to be clarified in the plan.`,
      }
    case "product":
      if (project.specification) {
        return { kind: "navigate", label: "Direct the plan", href: `/project/${project.id}/collaborate` }
      }
      return {
        kind: "brief",
        label: "Direct product",
        brief: `Direct Product & UX on ${name}: help me shape the plan I should review next.`,
      }
    case "engineering":
      if (project.state === "build_failed") {
        return { kind: "mutation", label: "Send engineering back to the build", mutation: "retry_build" }
      }
      if (
        project.specification &&
        (project.state === "specification_ready" ||
          project.state === "awaiting_build_confirmation" ||
          project.state === "analysis_complete")
      ) {
        return { kind: "mutation", label: "Tell engineering to start building", mutation: "build" }
      }
      return {
        kind: "brief",
        label: "Brief engineering",
        brief: `Brief Engineering on ${name} using the current build state. Explain what they can do next without starting a job unless I confirm.`,
      }
    case "launch":
      if (project.state === "deployment_failed") {
        return { kind: "mutation", label: "Send launch back to deploy", mutation: "retry_launch" }
      }
      if ((project.state === "ready" || project.state === "build_complete") && project.totalumProjectId) {
        return { kind: "mutation", label: "Tell launch to publish", mutation: "deploy" }
      }
      if (project.totalumProjectId) {
        return { kind: "navigate", label: "Open launch controls", href: `/project/${project.id}/hosting` }
      }
      return {
        kind: "brief",
        label: "Brief launch",
        brief: `Brief Launch on ${name}. We are not ready to publish unless a real preview exists.`,
      }
  }
}

// ─── Journey ─────────────────────────────────────────────────────────────────

const STAGE_WORKSTREAM: Record<JourneyPhase, TeamRole> = {
  understand: "cofounder",
  plan: "product", // planning/spec work: product workstream represents it
  build: "engineering",
  validate: "product",
  launch: "launch",
}

function journeyEvidence(stage: JourneyPhase, project: Project): { label: string; href: string } | null {
  const base = `/project/${project.id}`
  switch (stage) {
    case "understand":
      if (project.understanding || project.idea) return { label: "See what was understood", href: `${base}/plan` }
      return null
    case "plan":
      if (project.specification) return { label: "Read the plan", href: `${base}/plan` }
      return null
    case "build":
      if (project.developmentUrl) return { label: "Open preview", href: devUrl(project.developmentUrl)! }
      return project.totalumProjectId ? { label: "Review the build", href: `${base}/edit` } : null
    case "validate":
      if (project.developmentUrl) return { label: "Review the preview", href: devUrl(project.developmentUrl)! }
      return null
    case "launch":
      return { label: "Open launch settings", href: `${base}/hosting` }
  }
}

function buildJourney(project: Project, phase: JourneyPhase): JourneyStageView[] {
  const published = project.state === "deployed" || Boolean(
    project.deployment?.status === "success" && project.deployment.productionUrl,
  ) || Boolean((project.deploymentHistory ?? []).some((d) => d.status === "success"))

  const buildEvidence = Boolean(project.developmentUrl) || Boolean(project.totalumProjectId)
  const validationEvidence = Boolean(project.developmentUrl) // preview exists; founder review itself is unverifiable

  return JOURNEY.map((step) => {
    const workstream = STAGE_WORKSTREAM[step.id]
    const order = JOURNEY.map((s) => s.id)
    const idx = order.indexOf(step.id)
    const currentIdx = order.indexOf(phase)

    let status: JourneyStageView["status"]
    let note: string | null = null

    if (step.id === phase) {
      // The current phase is "active" even when its work is underway — except
      // when the real completion condition has already been met (a successful
      // build genuinely finishes the build stage; a successful deployment
      // genuinely finishes the launch stage).
      if (project.state === "build_failed" || project.state === "deployment_failed") {
        status = "attention"
        note = "This phase needs attention."
      } else if (step.id === "build" && (project.state === "build_complete" || project.state === "ready")) {
        status = "complete"
      } else if (step.id === "launch" && project.state === "deployed") {
        status = "complete"
      } else if (step.id === "validate" && project.developmentUrl) {
        status = "active"
        note = "Your preview is ready — this stage finishes when you review it."
      } else {
        status = "active"
      }
    } else if (idx < currentIdx) {
      // Prior stages: claim completion only with actual evidence.
      switch (step.id) {
        case "understand":
        case "plan":
          status = project.specification || project.understanding || project.idea ? "complete" : "unverified"
          break
        case "build":
          status = buildEvidence ? "complete" : "unverified"
          break
        case "validate":
          // A deployment is NOT proof of validation. Claim it only from a real preview.
          status = validationEvidence ? "complete" : "unverified"
          if (!validationEvidence) note = "Validation could not be confirmed."
          break
        case "launch":
          status = published ? "complete" : "unverified"
          break
      }
    } else {
      status = "not_started"
    }

    return {
      id: step.id,
      label: step.label,
      workstream,
      status,
      evidence: journeyEvidence(step.id, project),
      note,
    }
  })
}

// ─── History ─────────────────────────────────────────────────────────────────

function buildHistory(events: ProjectEvent[]): HistoryEntry[] {
  return events
    .map((event) => {
      const mapped = workstreamForEvent(event)
      const role: TeamRole = mapped === "research" ? "cofounder" : mapped
      const kind: HistoryEntry["kind"] =
        event.level === "error" ? "failure" : event.level === "warn" ? "note" : "outcome"
      // Neutral fallback when the raw message isn't reliably presentable.
      const message = founderSafeMessage(event.message)
      return { id: event.id, at: event.at, kind, role, message }
    })
    .sort((a, b) => b.at - a.at)
    .slice(0, 60)
}

// ─── Deliverables ────────────────────────────────────────────────────────────

function buildDeliverables(project: Project): Deliverable[] {
  const items: Deliverable[] = []
  const base = `/project/${project.id}`
  if (project.idea || project.understanding) {
    items.push({ id: "understanding", label: "What we learned about your project", href: `${base}/plan`, context: "understand" })
  }
  if (project.specification) {
    items.push({ id: "spec", label: "Your application plan", href: `${base}/plan`, context: "plan" })
  }
  if (project.developmentUrl) {
    items.push({ id: "preview", label: "Live preview", href: project.developmentUrl, external: true, context: "build" })
  }
  if (project.deploymentHistory?.some((d) => d.status === "success" && d.productionUrl)) {
    items.push({ id: "production", label: "Your live application", href: project.deploymentHistory.find((d) => d.status === "success" && d.productionUrl)!.productionUrl!, external: true, context: "launch" })
  }
  return items
}

// ─── Now section ─────────────────────────────────────────────────────────────

const FAILED_STATES: ReadonlySet<ProjectState> = new Set(["build_failed", "deployment_failed"])

function buildNow(
  project: Project,
  next: WorkspaceNextStep,
  live: boolean,
): NowSection {
  const base = `/project/${project.id}`
  // Failed states must read as needs_attention, not "waiting on you", even
  // though workspaceNextStep marks failure as needsYou (retry is a founder action).
  if (!live && FAILED_STATES.has(project.state)) {
    const nextFor = project.state === "build_failed" ? "engineering" : "launch"
    return {
      state: "needs_attention",
      headline: next.title,
      body: next.body,
      workstream: nextFor,
      action: next.href && !next.href.startsWith("#")
        ? { label: next.actionLabel ?? "Open", href: next.href }
        : { label: "Open your workspace", href: base },
    }
  }
  if (project.state === "build_complete" || project.state === "ready") {
    // A finished phase with ready artifacts gets an idle "right now" — work
    // completed; the founder is invited to the next action, not blocking it.
    const action =
      project.developmentUrl
        ? { label: "Open preview", href: project.developmentUrl, external: true }
        : { label: "Open your workspace", href: base }
    return {
      state: "idle" as NowState,
      headline:
        project.state === "build_complete"
          ? "The current build is done."
          : "Your application is built and ready.",
      body: "Open the preview when it appears, then launch when you're ready.",
      workstream: "engineering",
      action,
    }
  }
  if (live) {
    const workstream: WorkstreamId =
      project.state === "deploying" ? "launch" : project.state === "building" ? "engineering" : "cofounder"
    const headline =
      project.state === "building"
        ? "Engineering is building your application."
        : project.state === "deploying"
          ? "Your application is being published."
          : project.mode === "github"
            ? "Your team is learning from the existing codebase."
            : "Your team is learning from your input."
    const body =
      project.state === "analyzing"
        ? "Nothing is needed from you during analysis. This page updates as work moves."
        : "Nothing is needed from you right now. This page updates as work moves."
    return {
      state: "working",
      headline,
      body,
      workstream,
      action: { label: "Watch on your workspace", href: base },
    }
  }
  if (next.needsYou) {
    return {
      state: "waiting_on_you",
      headline: next.title,
      body: next.body,
      workstream: null,
      action: next.href && !next.href.startsWith("#")
        ? { label: next.actionLabel ?? "Open", href: next.href }
        : { label: "Open your workspace", href: base },
    }
  }
  if (!isKnownState(project.state)) {
    return {
      state: "unavailable",
      headline: "Current execution status is unavailable.",
      body: "The project state could not be reliably established. Refresh to try again.",
      workstream: null,
      action: { label: "Open your workspace", href: base },
    }
  }
  return {
    state: "idle" as NowState,
    headline: "Nothing is being built right now.",
    body: "The team resumes when the next phase starts from your workspace.",
    workstream: null,
    action: { label: "Open your workspace", href: base },
  }
}

// ─── Main entry ──────────────────────────────────────────────────────────────

export function buildProgressViewModel(project: Project, buildRuns?: Array<{ id: string; status: string; kind: string; startedAt: number; totalumProjectId?: string; error?: string }>): ProgressViewModel {
  const state = project.state
  const stateKnown = isKnownState(state)
  const live = stateKnown && (state === "analyzing" || state === "building" || state === "deploying")
  const events = meaningfulEvents(project.events)
  const workspaceView = buildWorkspaceView(project)

  const failure = failureMessage(project.events ?? [], state)

  const states = workstreamStates(project, events)
  const workstreams: WorkstreamCard[] = ([["cofounder", states.cofounder], ["research", states.research], ["product", states.product], ["engineering", states.engineering], ["launch", states.launch]] as Array<[WorkstreamId, WorkstreamStatus]>).map(
    ([id, status]) => {
      const note = workstreamNote(id, events)
      return {
        id,
        name: WORKSTREAM_META[id].name,
        responsibility: WORKSTREAM_META[id].responsibility,
        status,
        latestNote: note?.message ?? null,
        latestAt: note?.at ?? null,
        action: workstreamAction(id, project),
        command: workstreamCommand(id, project),
      }
    },
  )

  const phase = workspaceView.phase
  const now = buildNow(project, workspaceView.next, live)
  const attention = attentionFromNext(workspaceView.next, project.id, project)
  const journey = buildJourney(project, phase)
  const history = buildHistory(events)
  const deliverables = buildDeliverables(project)

  const lastEvent = events[events.length - 1]
  const lastUpdatedAt = lastEvent ? lastEvent.at : project.updatedAt || null

  const handoffs = buildHandoffs(project, events)
  const activeBuildRun = buildActiveBuildRun(project, buildRuns)
  const founderControls = buildFounderControls(project)

  return {
    state,
    stateKnown,
    live,
    phase,
    brief: { headline: workspaceView.brief.headline, support: workspaceView.brief.support },
    now,
    workstreams,
    journey,
    attention,
    history,
    deliverables,
    handoffs,
    founderControls,
    activeBuildRun,
    lastUpdatedAt,
  }
}

function buildFounderControls(project: Project): FounderControl[] {
  const base = `/project/${project.id}`
  const items: FounderControl[] = []
  if (project.idea?.trim()) {
    items.push({ id: "idea", label: "Your idea (this is what the teams follow)", value: project.idea.trim(), href: `${base}/collaborate` })
  }
  const prefs = project.preferences
  if (prefs?.appName?.trim()) {
    items.push({ id: "name", label: "Name you set", value: prefs.appName.trim() })
  }
  if (prefs?.stackType) {
    items.push({ id: "stack", label: "Stack you chose", value: String(prefs.stackType) })
  }
  if (prefs?.databaseChoice) {
    items.push({
      id: "db",
      label: "Database you chose",
      value: prefs.databaseChoice === "custom"
        ? (prefs.customDbProvider || prefs.customDbProviderDetail || "Custom")
        : "Built-in",
    })
  }
  if (prefs?.authProviders && prefs.authProviders !== "unknown") {
    items.push({ id: "auth", label: "Auth you chose", value: prefs.authProviders })
  }
  if (prefs?.additionalNotes?.trim()) {
    items.push({ id: "notes", label: "Notes you gave the teams", value: prefs.additionalNotes.trim() })
  }
  if (project.planUpdateNotes?.length) {
    items.push({
      id: "plan-notes",
      label: "Plan changes you accepted",
      value: project.planUpdateNotes.slice(-3).join(" · "),
      href: `${base}/collaborate`,
    })
  }
  const lastUser = [...(project.conversation ?? [])].reverse().find((m) => m.role === "user" && m.content.trim())
  if (lastUser) {
    items.push({
      id: "last-order",
      label: "Last thing you told the co-founder",
      value: lastUser.content.trim(),
      href: `${base}/collaborate`,
    })
  }
  if (project.specification) {
    items.push({
      id: "plan",
      label: "Plan you can change",
      value: project.specification.title?.trim() || "Your application plan",
      href: `${base}/plan`,
    })
  }
  return items
}

// ─── Active build run (current task) ──────────────────────────────────────────

function buildActiveBuildRun(project: Project, buildRuns?: Array<{ id: string; status: string; kind: string; startedAt: number; totalumProjectId?: string; error?: string }>): BuildRunView | null {
  // Only surface a build run when the project is actively building.
  if (project.state !== "building") return null
  // Prefer the most recent build run that's still active.
  const runs = buildRuns ?? []
  const active = runs.find((r) => r.status === "running" || r.status === "reserved")
  if (!active) return null
  return {
    id: active.id,
    kind: active.kind === "followup" ? "followup" : "initial",
    status: active.status,
    startedAt: active.startedAt,
    totalumProjectId: active.totalumProjectId,
    error: active.error,
  }
}

// ─── Handoffs from real workflow transitions ──────────────────────────────────

/** Derive handoffs from the project's state transitions and events.
 * We look for state-change markers in events and pair them with the
 * journey phases they represent. No new collection — derived from existing
 * persisted data. Idempotent: same events produce the same handoffs.
 */
function buildHandoffs(project: Project, events: ProjectEvent[]): HandoffRecord[] {
  const base = `/project/${project.id}`
  const records: HandoffRecord[] = []
  const seen = new Set<string>()

  // Walk events in chronological order and emit a handoff when we detect
  // a phase transition.
  const ordered = [...events].sort((a, b) => a.at - b.at)
  let previousPhase: JourneyPhase | null = null

  for (const evt of ordered) {
    const phase = phaseFromEvent(evt, project.state)
    if (!phase) continue

    if (previousPhase && phase !== previousPhase) {
      const key = `${previousPhase}→${phase}`
      if (!seen.has(key)) {
        seen.add(key)
        records.push({
          id: `handoff-${previousPhase}-${phase}-${evt.id}`,
          from: previousPhase,
          to: phase,
          reason: handoffReason(previousPhase, phase, project.state),
          at: evt.at,
          resultingTask: handoffResultingTask(phase, project),
          artifact: handoffArtifact(phase, project, base),
        })
      }
    }
    previousPhase = phase
  }

  // Also emit a handoff for the current phase if it's different from the
  // last event-detected phase (the state itself represents a transition).
  const currentPhase = journeyPhase(project.state)
  if (previousPhase && currentPhase !== previousPhase) {
    const key = `${previousPhase}→${currentPhase}`
    if (!seen.has(key)) {
      seen.add(key)
      records.push({
        id: `handoff-${previousPhase}-${currentPhase}-state`,
        from: previousPhase,
        to: currentPhase,
        reason: handoffReason(previousPhase, currentPhase, project.state),
        at: project.updatedAt || Date.now(),
        resultingTask: handoffResultingTask(currentPhase, project),
        artifact: handoffArtifact(currentPhase, project, base),
      })
    }
  }

  // Return newest first.
  return records.sort((a, b) => b.at - a.at)
}

function phaseFromEvent(evt: ProjectEvent, currentState: ProjectState): JourneyPhase | null {
  const stage = evt.stage.toLowerCase()
  // Map event stages to journey phases using the same logic as journeyPhase
  // but keyed off event semantics rather than the current project state.
  if (/build|agent|code/i.test(stage)) {
    if (/fail/i.test(evt.message) || /error/i.test(evt.level)) return "build"
    return "build"
  }
  if (/deploy|launch/i.test(stage)) {
    if (/fail/i.test(evt.message) || /error/i.test(evt.level)) return "launch"
    return "launch"
  }
  if (/plan|spec|analy|cofounder/i.test(stage)) {
    return "plan"
  }
  // Fallback: use the event's relationship to the current state.
  return null
}

function handoffReason(from: JourneyPhase, to: JourneyPhase, state: ProjectState): string {
  if (state === "build_failed" && to === "build") return "The build needs attention."
  if (state === "deployment_failed" && to === "launch") return "The launch needs attention."
  if (from === "understand" && to === "plan") return "Planning is underway."
  if (from === "plan" && to === "build") return "The build was initiated."
  if (from === "build" && to === "validate") return "The build completed and a preview is available."
  if (from === "validate" && to === "launch") return "Launch was initiated."
  if (to === "launch" && state === "deployed") return "Deployment completed."
  if (from === "build" && to === "validate" && state === "ready") return "The application is built and ready."
  return `Moved from ${from} to ${to}.`
}

function handoffResultingTask(phase: JourneyPhase, project: Project): string | null {
  if (phase === "build" && project.state === "building") return "Engineering is building the application."
  if (phase === "launch" && project.state === "deploying") return "The launch team is publishing the application."
  if (phase === "plan" && (project.state === "plan_ready" || project.state === "awaiting_build_confirmation")) return "Review the plan and start the build."
  if (phase === "validate" && project.state === "ready") return "Review the preview and launch when ready."
  return null
}

function handoffArtifact(phase: JourneyPhase, project: Project, base: string): { label: string; href: string } | null {
  switch (phase) {
    case "plan":
      if (project.specification) return { label: "Read the plan", href: `${base}/plan` }
      return null
    case "build":
      if (project.developmentUrl) return { label: "Open preview", href: project.developmentUrl }
      if (project.totalumProjectId) return { label: "Review the build", href: `${base}/edit` }
      return null
    case "validate":
      if (project.developmentUrl) return { label: "Review the preview", href: project.developmentUrl }
      return null
    case "launch":
      return { label: "Open launch settings", href: `${base}/hosting` }
    default:
      return null
  }
}


export { failureMessage }
