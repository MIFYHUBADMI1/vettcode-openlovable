import "server-only"
import {
  getWorkspaceOverviewTool,
  listProjectsTool,
} from "./tools/workspace"
import {
  getProjectTool,
  getProjectActivityTool,
  createProjectTool,
  deleteProjectTool,
} from "./tools/projects"
import {
  getPlanTool,
  proposePlanUpdateTool,
  applyPlanUpdateTool,
  analyzePlanTool,
  autoCompletePlanTool,
} from "./tools/plans"
import {
  getBuildStatusTool,
  getBuildLogsTool,
  getBuildConversationTool,
  stopBuildTool,
  requestBuildTool,
  requestFollowupEditTool,
  requestDeployTool,
} from "./tools/applications"
import {
  navigateTool,
  getAccountSummaryTool,
  getCreditCostsTool,
} from "./tools/navigation"
import type { ToolDefinition, ToolRisk } from "./types"

/**
 * CLOSED tool registry (spec section 10). This list is the explicit
 * allow-list of everything the Co-founder can ever do. Only registered tools
 * are exposed to the model; an unregistered tool name can never execute —
 * the registry lookup IS the authorization for tool existence.
 *
 * v1 deliberately excludes (spec section 51): runtime API key lifecycle,
 * api_keys, runtime/v1 invocation, Totalum secrets, provider credentials,
 * billing mutations, checkout, top-ups, subscriptions, webhooks, admin APIs,
 * self-credit manipulation, ledger reconciliation, password/session
 * management, email verification, and direct generated-app database writes.
 */

const REGISTRY: readonly ToolDefinition[] = [
  // READ — workspace
  getWorkspaceOverviewTool,
  listProjectsTool,
  getProjectTool,
  getProjectActivityTool,
  getPlanTool,
  analyzePlanTool,
  getBuildStatusTool,
  getBuildLogsTool,
  getBuildConversationTool,
  navigateTool,
  getAccountSummaryTool,
  getCreditCostsTool,
  // LOW_RISK_WRITE
  stopBuildTool,
  // CONFIRM
  proposePlanUpdateTool,
  applyPlanUpdateTool,
  autoCompletePlanTool,
  createProjectTool,
  // HARD_CONFIRM
  requestBuildTool,
  requestFollowupEditTool,
  requestDeployTool,
  deleteProjectTool,
]

const BY_NAME = new Map(REGISTRY.map((t) => [t.name, t]))

export function getTool(name: string): ToolDefinition | undefined {
  return BY_NAME.get(name)
}

export function listTools(): readonly ToolDefinition[] {
  return REGISTRY
}

/** Tools the model may call immediately (READ / LOW_RISK_WRITE). */
export function immediateTools(): ToolDefinition[] {
  return REGISTRY.filter((t) => !t.requiresConfirmation)
}

/** Tools requiring confirmation — prepared during the loop, executed only via
 * the approval endpoint. */
export function confirmationTools(): ToolDefinition[] {
  return REGISTRY.filter((t) => t.requiresConfirmation)
}

/** Risk check helper for tests and the approval path. */
export function riskOf(name: string): ToolRisk | undefined {
  return BY_NAME.get(name)?.risk
}
