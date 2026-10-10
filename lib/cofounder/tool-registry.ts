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
import { getGrowthOverviewTool } from "./tools/growth"
import { runSeoAuditTool } from "./tools/seo"
import { generateMarketingCopyTool } from "./tools/studio"
import { proposeGrowthTaskTool, listGrowthTasksTool } from "./tools/tasks"
import { proposeCampaignTool, listCampaignsTool } from "./tools/campaigns"
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
  // READ — growth overview (Phase 2; read-only projection of trusted data)
  getGrowthOverviewTool,
  // READ — growth task list (Phase 5; read-only projection of the founder's own tasks)
  listGrowthTasksTool,
  // READ — campaign list (Phase 6; read-only projection of the founder's own campaign plans)
  listCampaignsTool,
  // LOW_RISK_WRITE
  stopBuildTool,
  // CONFIRM
  proposePlanUpdateTool,
  applyPlanUpdateTool,
  autoCompletePlanTool,
  createProjectTool,
  // CONFIRM — SEO visibility audit (Phase 3; credits + crawl, gated behind a
  // pending action and the SEO_AUDIT flag)
  runSeoAuditTool,
  // CONFIRM — Marketing Studio copy draft (Phase 4; credits + one-shot AI
  // generation, gated behind a pending action and the STUDIO flag; drafts only,
  // never publishes)
  generateMarketingCopyTool,
  // CONFIRM — growth task proposal (Phase 5; FREE AI-proposed task, gated behind
  // a pending action and the GROWTH_TASKS flag; the founder works through tasks
  // manually — nothing here runs on a timer)
  proposeGrowthTaskTool,
  // CONFIRM — campaign plan proposal (Phase 6; FREE AI-proposed plan, gated
  // behind a pending action and the CAMPAIGNS flag; plans/tracks only — nothing
  // is sent, posted, spent, or scheduled)
  proposeCampaignTool,
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
