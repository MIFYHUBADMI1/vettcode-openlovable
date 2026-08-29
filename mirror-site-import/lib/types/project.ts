import type { ProjectUnderstanding } from "./understanding"
import type { ApplicationSpecification } from "./specification"

/** Explicit MirrorSite project lifecycle (spec section 30). State is always
 * persisted server-side and never inferred from frontend state alone. */
export type ProjectState =
  | "created"
  | "analyzing"
  | "analysis_complete"
  | "specification_ready"
  | "awaiting_build_confirmation"
  | "building"
  | "build_complete"
  | "build_failed"
  | "ready"
  | "deploying"
  | "deployed"
  | "deployment_failed"

export type ProjectMode = "website" | "scratch"

export type BuildRunStatus = "reserved" | "running" | "succeeded" | "failed" | "stopped"

export interface BuildRun {
  id: string
  userId: string
  mirrorProjectId: string
  totalumProjectId?: string
  kind: "initial" | "followup"
  prompt: string
  status: BuildRunStatus
  startedAt: number
  completedAt?: number
  creditsReserved: number
  creditsConsumed?: number
  firecrawlUsage?: Record<string, unknown>
  totalumUsage?: Record<string, unknown>
  error?: string
  providerMetadata?: Record<string, unknown>
}

export type CreditTransactionType = "grant" | "reserve" | "consume" | "refund"

export interface CreditTransaction {
  id: string
  userId: string
  type: CreditTransactionType
  amount: number // positive = credited to user, negative = debited
  reason: string
  buildRunId?: string
  createdAt: number
}

export interface ProjectEvent {
  id: string
  at: number
  level: "info" | "warn" | "error"
  stage: string
  message: string
}

export interface ConversationMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  at: number
}

export interface DeploymentRecord {
  id: string
  status: "idle" | "building" | "deploying" | "success" | "failed"
  productionUrl?: string
  updatedAt: number
  error?: string
}

export interface MirrorProject {
  id: string
  userId: string
  mode: ProjectMode
  name: string
  state: ProjectState
  sourceUrl?: string
  idea?: string
  understanding?: ProjectUnderstanding
  specification?: ApplicationSpecification
  totalumProjectId?: string
  developmentUrl?: string
  events: ProjectEvent[]
  conversation: ConversationMessage[]
  deployment: DeploymentRecord
  createdAt: number
  updatedAt: number
  error?: string
}

/** Alias used throughout the frontend; kept distinct from `MirrorProject` so
 * call sites read naturally while the server-side type name stays explicit. */
export type Project = MirrorProject

/** Lightweight shape returned by the project list endpoint. */
export interface ProjectSummary {
  id: string
  name: string
  mode: ProjectMode
  state: ProjectState
  sourceUrl?: string
  updatedAt: number
}

/** User-facing labels for lifecycle states. */
export const STATE_LABELS: Record<ProjectState, string> = {
  created: "Created",
  analyzing: "Analyzing website",
  analysis_complete: "Analysis complete",
  specification_ready: "Application plan ready",
  awaiting_build_confirmation: "Awaiting build confirmation",
  building: "Building application",
  build_complete: "Build complete",
  build_failed: "Build failed",
  ready: "Ready",
  deploying: "Deploying",
  deployed: "Deployed",
  deployment_failed: "Deployment failed",
}
