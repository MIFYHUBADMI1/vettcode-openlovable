/**
 * Co-founder domain types (spec sections 9, 33–34, 64–65).
 *
 * Risk levels are explicit — never a bare boolean — and every tool returns a
 * structured result the UI can render as an action card. The model never
 * authors a raw href or a raw mutation; it produces tool calls and structured
 * targets that the server validates and executes.
 */

// ─── Risk ────────────────────────────────────────────────────────────────────

/** Explicit risk ladder (spec section 9). `NEVER` tools exist only so the
 * registry can refuse them loudly if ever referenced. */
export type ToolRisk = "READ" | "LOW_RISK_WRITE" | "CONFIRM" | "HARD_CONFIRM" | "NEVER"

// ─── Tool results (contract with the model + UI) ────────────────────────────

/** Summaries attached to results so the model can speak accurately. */
export interface CofounderProjectSummary {
  id: string
  name: string
  mode: "website" | "scratch" | "github"
  state: string
  idea?: string
  sourceUrl?: string
  updatedAt: number
  planHealthPercent?: number
}

export interface CofounderEventSummary {
  id: string
  at: number
  level: string
  stage: string
  message: string
}

export interface CofounderPlanSummary {
  hasPlan: boolean
  healthPercent?: number
  completedSections: string[]
  missingSections: string[]
  recentDecisions: string[]
}

export interface CofounderBuildSummary {
  state: string
  totalumProjectId?: string
  lastBuildRun?: { id: string; status: string; kind: string; startedAt: number; error?: string }
  developmentUrl?: string
}

export interface CofounderDeploymentSummary {
  status: string
  productionUrl?: string
  lastDeployment?: { id: string; status: string; startedAt: number; productionUrl?: string }
}

export interface CofounderAccountSummary {
  name: string
  email: string
  emailVerified: boolean
  creditsAvailable: number
  creditsBalance: number
  creditsReserved: number
}

export interface CofounderCreditCosts {
  chatMessageCost: number
  planAnalysisCost: number
  autoCompleteSectionCost: number
  buildTiers: { simple: number; medium: number; complex: number }
  deployCost: number
}

// ─── Tool result envelope ────────────────────────────────────────────────────

export type ToolResultType =
  | "workspace_overview"
  | "projects_list"
  | "project"
  | "project_activity"
  | "project_created"
  | "project_deleted"
  | "plan_summary"
  | "plan_analysis"
  | "plan_proposed"
  | "plan_updated"
  | "auto_complete_estimate"
  | "auto_completed"
  | "build_status"
  | "build_logs"
  | "build_conversation"
  | "build_started"
  | "build_stopped"
  | "deployment_started"
  | "navigation"
  | "account_summary"
  | "credit_costs"
  | "pending_action"
  | "text"

export interface ToolResult {
  success: true
  type: ToolResultType
  /** Compact, model-readable summary of what actually happened. */
  data: Record<string, unknown>
  /** Optional structured navigation the client resolves via the registry. */
  navigation?: { target: NavigationTarget; projectId?: string }
  /** Set when the result was produced via an approved pending action. */
  pendingActionId?: string
}

export interface ToolError {
  success: false
  error: {
    code: string
    message: string
    /** Set when the model should stop the tool loop (spec section 39). */
    fatal?: boolean
  }
}

export type ToolOutcome = ToolResult | ToolError

// ─── Tool definition ─────────────────────────────────────────────────────────

import type { NavigationTarget } from "@/lib/navigation/routes"
import type { z } from "zod"

/** The minimal execution environment every tool receives. Authorization is
 * NEVER part of the tool inputs — userId always comes from this context,
 * which is built from the server session only. */
export interface ToolContext {
  user: { id: string; name: string; email: string; emailVerified: boolean }
  credits: { available: number; balance: number; reserved: number }
  activeProjectId?: string
  currentRoute?: string
  currentSurface?: string
  /** Workspace conversation this turn belongs to — recorded on pending
   * actions so executed results land back in the transcript. */
  conversationId?: string
  /** Pending-action id when executing through the approval path. */
  pendingActionId?: string
}

/** Result of the prepare phase of a confirmation tool: a priced, validated
 * pending action awaiting explicit user approval. */
export type PrepareOutcome =
  | { ok: true; pending: PendingActionRecord }
  | { ok: false; error: { code: string; message: string; fatal?: boolean } }

export interface ToolDefinition {
  name: string
  description: string
  risk: ToolRisk
  /** CONFIRM/HARD_CONFIRM tools run through the pending-action flow. */
  requiresConfirmation: boolean
  /** Model-facing zod schema — converted to JSON Schema at registration and
   * revalidated on every execution path. */
  inputSchema: z.ZodObject<z.ZodRawShape>
  /** For immediate (READ / LOW_RISK_WRITE) tools: runs during the agent loop. */
  execute?: (input: unknown, ctx: ToolContext) => Promise<ToolOutcome>
  /** For confirmation tools: validate + price + create the pending action.
   * NEVER mutates anything. */
  prepare?: (input: unknown, ctx: ToolContext) => Promise<PrepareOutcome>
  /** For confirmation tools: the actual mutation, executed ONLY by the
   * approval endpoint after an atomic claim of the pending action. */
  executeApproved?: (input: unknown, ctx: ToolContext) => Promise<ToolOutcome>
}

// ─── Pending actions (spec sections 33–35) ───────────────────────────────────

export type PendingActionStatus =
  | "pending"
  | "approved"
  | "executing"
  | "executed"
  | "rejected"
  | "expired"
  | "failed"

export interface PendingActionRecord {
  id: string
  userId: string
  toolName: string
  /** Model-authored parameters, revalidated at approval time. */
  parameters: Record<string, unknown>
  risk: ToolRisk
  /** Human-readable cost summary for the confirmation card. */
  cost?: {
    amount: number
    creditsAvailable: number
    label: string
  }
  description: string
  /** For HARD_CONFIRM tools: a word the user must type to approve (e.g. "DELETE"). */
  confirmWord?: string
  /** Grouped proposal support (batch plan changes) — reviewable items. */
  items?: Array<{
    section: string
    label: string
    currentValue: string
    proposedValue: string
    reason?: string
  }>
  conversationId?: string
  status: PendingActionStatus
  /** Epoch ms. Expired actions never execute. */
  expiresAt: number
  createdAt: number
  approvedAt?: number
  executedAt?: number
  /** Set on failure — stored for the UI, never leaks internals. */
  error?: { code: string; message: string }
  /** Result payload persisted after execution (action card rendering). */
  result?: ToolResult | null
}

// ─── Conversation persistence (spec section 27) ──────────────────────────────

/** Reuses the existing `ConversationMessage` shape (role/content/at) plus an
 * optional structured payload for action cards. */
export interface CofounderConversationMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  at: number
  /** Structured action-card payloads rendered by the client. */
  action?: CofounderMessageAction
}

export type CofounderMessageAction =
  | { kind: "pending_action"; actionId: string; toolName: string; risk: ToolRisk; description: string; cost?: PendingActionRecord["cost"]; items?: PendingActionRecord["items"]; confirmWord?: string; expiresAt: number; /** Set once the approval endpoint settles the action — cards render their final state on reload. */ resolved?: "executed" | "rejected" | "failed" }
  | { kind: "action_result"; resultType: ToolResultType; data: Record<string, unknown>; success: boolean }
  | { kind: "navigation"; target: NavigationTarget; projectId?: string }
  | { kind: "project_picker"; projects: Array<Pick<CofounderProjectSummary, "id" | "name" | "state" | "updatedAt">> }

export interface CofounderConversationDoc {
  id: string
  userId: string
  messages: CofounderConversationMessage[]
  activeProjectId?: string
  projectContextReferences: string[]
  createdAt: number
  updatedAt: number
}

/** Mongo document shape (ObjectId primary + string mirror id). */
export interface CofounderConversationMongoDoc extends CofounderConversationDoc {
  _id?: unknown
}
