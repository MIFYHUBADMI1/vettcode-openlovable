import "server-only"
import { getGrowthOverview, type GrowthOverview, type MetricKey, type NumberMetric } from "@/lib/marketing/growth-overview"
import { isGrowthOverviewEnabledForUser } from "@/lib/marketing/feature-flags"
import { toToolOutcome } from "../errors"
import type { ToolDefinition } from "../types"
import { growthOverviewSchema } from "../schemas"
import { ownedProject } from "./projects"
import { logger } from "@/lib/logging/logger"

/**
 * Growth Overview READ tool (Phase 2, spec section 6).
 *
 * Strictly read-only: it renders the SAME trusted view model the /market page
 * uses — it never mutates, publishes, spends credits, or touches another
 * tenant. Ownership comes from ToolContext.user (session-built) via the same
 * ownedProject() gate the other project tools use; a forged projectId returns
 * the uniform "couldn't access that project" failure. When the growth
 * overview flag is off for the founder, the tool reports unavailability
 * instead of half-serving the surface.
 */

const TOOL_METRIC_KEYS: MetricKey[] = [
  "runtimeRequests",
  "checkoutCalls",
  "creditsConsumedByProject",
  "siteVisitors",
  "completedPayments",
  "appRevenue",
  "ownerAccountReferrals",
  "projectLevelReferrals",
]

function compactMetric(m: NumberMetric) {
  return {
    state: m.state,
    value: m.value,
    definition: m.definition,
    caveat: m.caveat,
    ...(m.reason ? { reason: m.reason.slice(0, 160) } : {}),
  }
}

/** Bounded model-readable projection of the overview (keeps tool payloads
 * small and never dumps full AI-plan text into the transcript). */
export function projectGrowthOverviewForTool(overview: GrowthOverview): Record<string, unknown> {
  return {
    projectId: overview.projectId,
    projectName: overview.projectName,
    projectState: overview.projectStateLabel,
    windowDays: Math.round((overview.window.to - overview.window.from) / (24 * 60 * 60 * 1000)),
    site: {
      state: overview.site.state,
      ...(overview.site.url ? { url: overview.site.url } : {}),
      caveat: overview.site.caveat,
    },
    plan: overview.whatAtaiKnows.plan.health
      ? {
          percentComplete: overview.whatAtaiKnows.plan.health.percent,
          missingSections: overview.whatAtaiKnows.plan.health.missing.map((s) => s.label),
        }
      : { hasPlan: false },
    aiPlansDrafted: overview.whatAtaiKnows.aiPlanDocuments
      .filter((d) => d.present)
      .map((d) => ({ label: d.label, note: "AI-generated planning context — not executed" })),
    metrics: Object.fromEntries(TOOL_METRIC_KEYS.map((key) => [key, compactMetric(overview.metrics[key])])),
    nextSteps: overview.nextSteps.slice(0, 3).map((s) => ({ title: s.title, detail: s.detail.slice(0, 200), executed: false })),
    trustNotes: overview.trustNotes,
  }
}

export const getGrowthOverviewTool: ToolDefinition = {
  name: "get_growth_overview",
  description:
    "Read the trusted Growth Overview for one of the founder's own projects: deployment state, what Atai knows from the plan, which AI growth plans were drafted (planning context only — never executed), and ONLY genuinely measured growth metrics with their availability state. A metric may be measured_zero, unavailable, or not_instrumented — never present an unmeasured number as zero. Use when the founder asks how their project is growing or performing.",
  risk: "READ",
  requiresConfirmation: false,
  inputSchema: growthOverviewSchema,
  async execute(input, ctx) {
    try {
      const parsed = growthOverviewSchema.parse(input)
      if (!isGrowthOverviewEnabledForUser(ctx.user.id)) {
        return {
          success: false,
          error: { code: "FEATURE_DISABLED", message: "The growth overview isn't available for this account yet.", fatal: true },
        }
      }
      const project = await ownedProject(ctx, parsed.projectId)
      if (!project) {
        return { success: false, error: { code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't access that project.", fatal: true } }
      }
      const overview = await getGrowthOverview({ user: ctx.user, project })
      return {
        success: true,
        type: "growth_overview",
        data: projectGrowthOverviewForTool(overview),
        navigation: { target: "market", projectId: project.id },
      }
    } catch (e) {
      logger.warn("cofounder.tool.growth", "growth overview failed", {
        message: e instanceof Error ? e.message : String(e),
      })
      return toToolOutcome(e, "I couldn't read the growth overview right now.")
    }
  },
}
