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

export type CreditTransactionType = "grant" | "reserve" | "consume" | "refund" | "deduction"

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

export interface DeploymentHistoryEntry {
  id: string
  startedAt: number
  completedAt?: number
  status: "deploying" | "success" | "failed"
  productionUrl?: string
  customDomain?: string
  creditsCharged?: number
  error?: string
}

/** The AI agent's post-build summary — critical info like credentials,
 * what's included, and next steps. Extracted from Totalum's
 * realtimeConversation "finished" messages when a build completes. */
export interface BuildSummary {
  /** The AI's summary message text (may contain markdown). */
  message: string
  /** When this summary was captured. */
  createdAt: number
  /** Version ID created by this build, if any. */
  versionId?: string
  /** Any secrets the agent says are needed. */
  secretKeysNeeded?: Record<string, { isProvided: boolean; description: string }>
}

export type InfrastructureSubscriptionStatus = "active" | "pending" | "expired" | "cancelled" | "past_due"

export interface InfrastructureSubscription {
  /** Current infrastructure plan ID. */
  planId: string
  /** Display name of the current plan. */
  planName: string
  /** Storage limit in bytes. */
  storageLimitBytes: number
  /** Totalum infrastructure credit cap per month. */
  totalumInfrastructureCreditLimit: number
  /** Subscription status. */
  status: InfrastructureSubscriptionStatus
  /** When the subscription was started. */
  startedAt: number
  /** When the subscription expires. */
  expiresAt: number
  /** Whether to auto-renew (for paid plans). */
  autoRenew: boolean
  /** Last time usage was synced from Totalum. */
  lastUsageSyncAt?: number
  /** Totalum infrastructure credits used this period. */
  totalumCreditsUsed?: number
  /** Storage used in bytes (approximate). */
  storageUsedBytes?: number
  /** Whether the project is over its storage quota. */
  overQuota?: boolean
  /** Synchronization status with Totalum. */
  syncStatus?: "synced" | "pending" | "failed"
}

export type StackType = "fullstack" | "backend" | "frontend" | "unknown"
export type AuthProviderChoice = "google" | "github" | "both" | "none" | "unknown"
export type DatabaseChoice = "builtin" | "custom"

export interface ProjectPreferences {
  /** User-chosen app name/brand. */
  appName?: string
  /** Stack type preference. */
  stackType?: StackType
  /** Database choice: built-in (Totalum) or custom provider. */
  databaseChoice?: DatabaseChoice
  /** Custom DB provider name (if databaseChoice === 'custom'). */
  customDbProvider?: string
  /** Custom DB provider detail (if databaseChoice === 'custom'). */
  customDbProviderDetail?: string
  /** Auth provider preference. */
  authProviders?: AuthProviderChoice
  /** Any additional notes from the user. */
  additionalNotes?: string
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
  deploymentHistory: DeploymentHistoryEntry[]
  createdAt: number
  updatedAt: number
  error?: string
  specSanitized?: boolean
  /** AI's post-build summary with important instructions for the user. */
  buildSummary?: BuildSummary
  /** Infrastructure subscription for this project. */
  infrastructure?: InfrastructureSubscription
  /** User preferences collected during project creation. */
  preferences?: ProjectPreferences
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
