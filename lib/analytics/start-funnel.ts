import { track } from "@vercel/analytics"
import type { StartMode } from "@/lib/start/detect-input"
import type { ProjectMode } from "@/lib/types/project"

/**
 * Client-side funnel instrumentation for the "start a business" flow:
 * /new → composer submit → /start workspace creation → plan review → build
 * approval.
 *
 * Events land in Vercel Web Analytics custom events (already mounted in
 * app/layout.tsx). Properties are flat primitives only. Nothing that could
 * identify a person or their idea is sent — no prompt text, URLs, project
 * names, emails, or project ids. A random flow id lets events be joined into
 * one funnel without exposing anything.
 *
 * Abandonment/error rates are derived from the event counts and the
 * `flow_id` join (submitted flows that never reach `workspace_created`),
 * not from a separate "abandoned" ping which would fire noisily on every
 * internal navigation.
 */

export type StartMethod = StartMode

type AnalyticsValue = string | number | boolean | null | undefined

const FLOW_STORAGE_KEY = "atai:start-flow:v1"
const FLOW_TTL_MS = 2 * 60 * 60 * 1000
/** Per-tab dedupe for plan_ready (sessionStorage can be unavailable). */
const planTracked = new Set<string>()

type StartFlow = {
  id: string
  method: StartMethod
  surface: string
  startedAt: number
  submittedAt?: number
  projectId?: string
  planReadyAt?: number
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function isStartMethod(value: unknown): value is StartMethod {
  return value === "idea" || value === "website" || value === "url" || value === "github"
}

function createId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID()
    }
  } catch {
    /* fall through */
  }
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function readFlow(): StartFlow | null {
  const store = storage()
  if (!store) return null
  try {
    const raw = store.getItem(FLOW_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StartFlow> | null
    if (!parsed || typeof parsed !== "object") return null
    if (typeof parsed.id !== "string" || typeof parsed.startedAt !== "number") return null
    if (!parsed.projectId && Date.now() - parsed.startedAt > FLOW_TTL_MS) {
      store.removeItem(FLOW_STORAGE_KEY)
      return null
    }
    return {
      id: parsed.id,
      method: isStartMethod(parsed.method) ? parsed.method : "idea",
      surface: typeof parsed.surface === "string" ? parsed.surface : "unknown",
      startedAt: parsed.startedAt,
      submittedAt: typeof parsed.submittedAt === "number" ? parsed.submittedAt : undefined,
      projectId: typeof parsed.projectId === "string" ? parsed.projectId : undefined,
      planReadyAt: typeof parsed.planReadyAt === "number" ? parsed.planReadyAt : undefined,
    }
  } catch {
    return null
  }
}

function writeFlow(flow: StartFlow): void {
  const store = storage()
  if (!store) return
  try {
    store.setItem(FLOW_STORAGE_KEY, JSON.stringify(flow))
  } catch {
    /* quota/privacy mode — analytics is best effort */
  }
}

function newFlow(method: StartMethod, surface: string): StartFlow {
  return { id: createId(), method, surface, startedAt: Date.now() }
}

function emit(name: string, properties: Record<string, AnalyticsValue>): void {
  if (typeof window === "undefined") return
  try {
    track(name, properties)
  } catch {
    /* Analytics must never break the funnel. */
  }
}

/** Start the clock for a visit to the launchpad. An in-progress, unsubmitted
 * flow is kept so navigating between /new and a specific starting point does
 * not reset time-to-submit. */
export function beginStartFlow(input: { method?: StartMethod; surface: string }): void {
  const existing = readFlow()
  if (existing && !existing.submittedAt && !existing.projectId) return
  writeFlow(newFlow(input.method ?? "idea", input.surface))
}

/** A starting method was chosen — a source card on /new or a composer tab. */
export function trackStartMethodSelected(method: StartMethod, surface: string): void {
  const flow = readFlow() ?? newFlow(method, surface)
  if (!flow.submittedAt && !flow.projectId) {
    flow.method = method
    flow.surface = surface
    writeFlow(flow)
  }
  emit("start_method_selected", { flow_id: flow.id, method, surface })
}

export function trackStartValidationFailed(
  method: StartMethod,
  surface: string,
  reason: "empty" | "invalid_input",
): void {
  const flow = readFlow()
  emit("start_validation_failed", { flow_id: flow?.id, method, surface, reason })
}

/** First valid submission. Time-to-submit is measured from the flow start. */
export function trackStartSubmitted(input: {
  method: StartMethod
  surface: string
  authenticated: boolean
}): void {
  const flow = readFlow() ?? newFlow(input.method, input.surface)
  const now = Date.now()
  flow.method = input.method
  flow.surface = input.surface
  if (!flow.submittedAt) flow.submittedAt = now
  writeFlow(flow)
  emit("start_submitted", {
    flow_id: flow.id,
    method: input.method,
    surface: input.surface,
    authenticated: input.authenticated,
    time_to_submit_ms: Math.max(0, Math.round(flow.submittedAt - flow.startedAt)),
  })
}

/** A project was created — the submission completed. */
export function trackWorkspaceCreated(input: {
  method: StartMethod
  projectId: string
  reused?: boolean
  createMs?: number
}): void {
  const flow = readFlow() ?? newFlow(input.method, "start")
  const now = Date.now()
  flow.method = input.method
  flow.projectId = input.projectId
  if (!flow.submittedAt) flow.submittedAt = now
  writeFlow(flow)
  emit("workspace_created", {
    flow_id: flow.id,
    method: input.method,
    reused: input.reused === true,
    time_to_workspace_ms: Math.max(0, Math.round(now - flow.submittedAt)),
    create_ms: typeof input.createMs === "number" ? Math.max(0, Math.round(input.createMs)) : undefined,
  })
}

export function trackWorkspaceCreateFailed(input: {
  method: StartMethod
  errorCode?: string
}): void {
  const flow = readFlow()
  emit("workspace_create_failed", {
    flow_id: flow?.id,
    method: input.method,
    error_code: input.errorCode ?? "unknown",
  })
}

/** The plan became available in the owner's workspace. */
export function trackPlanReady(input: {
  projectId: string
  projectMode: ProjectMode
  tier?: string
  /** Creation time lets us ignore old plans on repeat visits without a flow. */
  projectCreatedAt?: number
}): void {
  if (planTracked.has(input.projectId)) return

  const current = readFlow()
  // Only reuse timing when the flow belongs to this project (or is unbound).
  const flow = current && (!current.projectId || current.projectId === input.projectId) ? current : null
  // No flow and an old project = a plan we already counted earlier; don't
  // inflate plan-ready counts every time the owner reopens the workspace.
  if (!flow && typeof input.projectCreatedAt === "number" && Date.now() - input.projectCreatedAt > FLOW_TTL_MS) {
    planTracked.add(input.projectId)
    return
  }

  planTracked.add(input.projectId)
  const now = Date.now()
  if (flow) {
    if (!flow.projectId) flow.projectId = input.projectId
    if (!flow.planReadyAt) flow.planReadyAt = now
    writeFlow(flow)
  }

  emit("plan_ready", {
    flow_id: flow?.id,
    method: methodForProjectMode(input.projectMode),
    tier: input.tier ?? "unknown",
    time_to_plan_ms: flow?.submittedAt ? Math.max(0, Math.round(now - flow.submittedAt)) : undefined,
  })
}

/** The founder approved the plan and started the first build. */
export function trackPlanApproved(input: {
  projectId: string
  projectMode: ProjectMode
  tier?: string
  surface: string
}): void {
  const flow = boundFlow(input.projectId)
  const reference = flow?.planReadyAt ?? flow?.submittedAt
  emit("plan_approved", {
    flow_id: flow?.id,
    method: methodForProjectMode(input.projectMode),
    tier: input.tier ?? "unknown",
    surface: input.surface,
    time_to_approve_ms: reference ? Math.max(0, Math.round(Date.now() - reference)) : undefined,
  })
}

export function trackPlanApprovalFailed(input: {
  projectId: string
  projectMode: ProjectMode
  tier?: string
  surface: string
  errorCode?: string
}): void {
  const flow = boundFlow(input.projectId)
  emit("plan_approval_failed", {
    flow_id: flow?.id,
    method: methodForProjectMode(input.projectMode),
    tier: input.tier ?? "unknown",
    surface: input.surface,
    error_code: input.errorCode ?? "unknown",
  })
}

function boundFlow(projectId: string): StartFlow | null {
  const flow = readFlow()
  if (!flow || (flow.projectId && flow.projectId !== projectId)) return null
  if (!flow.projectId) {
    flow.projectId = projectId
    writeFlow(flow)
  }
  return flow
}

export function methodForProjectMode(mode: ProjectMode): StartMethod {
  if (mode === "github") return "github"
  if (mode === "website") return "website"
  return "idea"
}

/** API helpers attach the server error code to thrown errors. */
export function readErrorCode(error: unknown): string {
  const value = (error as { code?: unknown } | null)?.code
  return typeof value === "string" && value ? value : "unknown"
}
