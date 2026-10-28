import type { ProjectUnderstanding } from "./understanding"
import type { ApplicationSpecification } from "./specification"
import type { PlanAnalysis } from "./plan-analysis"
import type { AIArtifact } from "./ai-artifacts"
import type { RuntimeProvisioningMap } from "@/lib/runtime/provisioning/types"

/** Explicit Atai project lifecycle (spec section 30). State is always
 * persisted server-side and never inferred from frontend state alone. */
export type ProjectState =
  | "created"
  | "analyzing"
  | "analysis_complete"
  | "analysis_failed"
  | "specification_ready"
  | "plan_ready"
  | "plan_failed"
  | "awaiting_build_confirmation"
  | "building"
  | "build_complete"
  | "build_failed"
  | "ready"
  | "deploying"
  | "deployed"
  | "deployment_failed"
  | "pending_plan"

/** Bookkeeping for an analysis/planning run — lets the workspace show how many
 * attempts have happened and detect a run that died without reporting. */
export interface ProjectPipelineRecovery {
  phase: "understand" | "plan"
  /** Attempts of the current run (first try = 1). */
  attempts: number
  lastAttemptAt: number
  lastError?: string
  /** Stall recoveries triggered for this run — capped server-side. */
  autoRestarts?: number
}

export type ProjectMode = "website" | "scratch" | "github"

/** How the website was analyzed: "relevant" (AI-interpreted) or "deep" (exact replica). */
export type CrawlMode = "relevant" | "deep"

/** User-selected pipeline quality mode: "legacy" (fast, single-stage) or "heavy" (7-stage enhanced pipeline). */
export type UserPipelineMode = "legacy" | "heavy"

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
  /** Optional metadata for webhook tracking, payment IDs, etc. */
  metadata?: Record<string, unknown>
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
  crawlMode?: CrawlMode
  pipelineMode?: UserPipelineMode
  idea?: string
  understanding?: ProjectUnderstanding
  specification?: ApplicationSpecification
  requestedProjectId?: string
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
  /** Cached AI co-founder plan analysis (Collaborate workspace). */
  planAnalysis?: PlanAnalysis
  /** Accepted plan-change decisions, fed back into the AI context. */
  planUpdateNotes?: string[]
  /** Set once the legacy `conversation` history has been imported into the
   * project-scoped chat threads, so deleting that thread cannot resurrect it. */
  collabChatHistoryImportedAt?: number
  /** GitHub mode: README content from the repository */
  githubReadme?: string
  /** GitHub mode: structured file tree string */
  githubFileTree?: string
  /** GitHub mode (extend): zip download URL for the source code */
  githubZipUrl?: string
  /** Project visibility: private (default) or public. Can only be public if deployed. */
  visibility?: "private" | "public"
  /** Phase 8: per-environment runtime credential provisioning metadata.
   * SAFE METADATA ONLY (status/keyId/prefix/timestamps) — never a plaintext
   * secret or key hash; api_keys remains the credential source of truth. */
  runtimeProvisioning?: RuntimeProvisioningMap
  /** Analysis/planning run bookkeeping (attempts, last activity, stall recovery). */
  pipelineRecovery?: ProjectPipelineRecovery
  /** Every AI stage output produced for this project — including raw model
   * text when an answer could not be parsed. Surfaced on Collaborate. */
  aiArtifacts?: AIArtifact[]
  /** Timestamp of the last status poll for builds in "building" or "deploying" state.
   * Used to distinguish stale builds (lastPolledAt > 5 minutes ago) from actively polled builds.
   * Optional - no migration needed, will populate on next poll for active builds. */
  lastPolledAt?: number
  /** Set when a background pipeline run (auto-build, website analysis, deep
   * crawl) stopped because the owner could not afford the next step. There is
   * no HTTP request to refuse in that flow, so the shortfall is recorded here
   * and the credit gate turns it into the same top-up overlay. */
  creditBlock?: ProjectCreditBlock
}

/** A credit shortfall raised by a run with no request to answer. Safe numbers
 * only — never a balance other than the owner's own. */
export interface ProjectCreditBlock {
  required: number
  available: number
  /** What the founder was trying to get done, e.g. "the website analysis". */
  action: string
  at: number
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
  thumbnailUrl?: string | null
  /** Present so the projects list can resume a build that is still running
   * after the founder left the project page (see lib/projects/build-recovery). */
  totalumProjectId?: string
  lastPolledAt?: number
  visibility?: "private" | "public"
}

/** User-facing labels for lifecycle states. */
export const STATE_LABELS: Record<ProjectState, string> = {
  created: "Created",
  analyzing: "Analyzing website",
  analysis_complete: "Analysis complete",
  analysis_failed: "Understanding needs attention",
  specification_ready: "Application plan ready",
  plan_ready: "Plan ready — review before building",
  plan_failed: "Plan needs attention",
  awaiting_build_confirmation: "Awaiting build confirmation",
  building: "Building application",
  build_complete: "Build complete",
  build_failed: "Build failed",
  ready: "Ready",
  deploying: "Deploying",
  deployed: "Deployed",
  deployment_failed: "Deployment failed",
  pending_plan: "Pending plan",
}
