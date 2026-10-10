import "server-only"

/**
 * run_seo_audit CONFIRM-tier tool (Phase 3 — W2).
 *
 * A credit-charging action, so it runs through the existing pending-action
 * flow: prepare() validates + prices + creates a reviewable card and changes
 * NOTHING; executeApproved() performs the crawl + audit + charge, refunding on
 * failure. The audited URL is always the project's own recorded production URL
 * — never a model- or client-supplied URL — and ownership is re-derived from
 * the session at every step. Unrelated logic is untouched; all capabilities
 * come from lib/marketing/seo + the shared credit service.
 */

import { createPendingAction } from "../pending-actions"
import { toToolOutcome } from "../errors"
import type { ToolDefinition, PrepareOutcome, ToolOutcome, ToolContext } from "../types"
import { runSeoAuditSchema } from "../schemas"
import { ownedProject } from "./projects"
import { isSeoAuditEnabledForUser } from "@/lib/marketing/feature-flags"
import { getSeoAuditCost, getSeoAuditAffordability, chargeSeoAuditCredits, refundSeoAuditCredits } from "@/lib/marketing/seo/credits"
import { runSeoAudit } from "@/lib/marketing/seo/service"
import { isFirecrawlConfigured } from "@/lib/integrations/firecrawl/client"
import { AppError } from "@/lib/errors"
import { logger } from "@/lib/logging/logger"

/** A project only has an auditable URL once it has a recorded successful
 * deployment. Returns the URL or null. */
function deployedUrl(project: { deployment?: { status?: string; productionUrl?: string } } | null): string | null {
  if (!project?.deployment?.productionUrl) return null
  if (project.deployment.status !== "success") return null
  return project.deployment.productionUrl
}

function requireDeployedProject(ctx: ToolContext, projectId: string) {
  return (async () => {
    const project = await ownedProject(ctx, projectId)
    if (!project) return { ok: false as const, code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't access that project." }
    const url = deployedUrl(project)
    if (!url) return { ok: false as const, code: "NOT_DEPLOYED", message: "This project has no live deployment to audit yet. Deploy it first." }
    return { ok: true as const, project, url }
  })()
}

export const runSeoAuditTool: ToolDefinition = {
  name: "run_seo_audit",
  description:
    "Run a bounded, read-only SEO visibility audit of a project's OWN live deployed URL (on-page title, description, headings, links, content, HTTPS). This consumes credits and creates a confirmation card first — nothing runs or is charged until the founder approves. Use when the founder wants to check how search-engine-friendly their live site is. Cannot run on undeployed projects.",
  risk: "CONFIRM",
  requiresConfirmation: true,
  inputSchema: runSeoAuditSchema,
  async prepare(input, ctx): Promise<PrepareOutcome> {
    try {
      const parsed = runSeoAuditSchema.parse(input)
      if (!isSeoAuditEnabledForUser(ctx.user.id)) {
        return { ok: false, error: { code: "FEATURE_DISABLED", message: "SEO audits aren't available for this account yet.", fatal: true } }
      }
      if (!isFirecrawlConfigured()) {
        return { ok: false, error: { code: "FIRECRAWL_UNAVAILABLE", message: "The website analyzer isn't connected right now.", fatal: true } }
      }
      const gate = await requireDeployedProject(ctx, parsed.projectId)
      if (!gate.ok) {
        return { ok: false, error: { code: gate.code, message: gate.message, fatal: true } }
      }
      const { cost, available, affordable } = await getSeoAuditAffordability(ctx.user.id)
      if (!affordable) {
        return { ok: false, error: { code: "INSUFFICIENT_CREDITS", message: `This audit costs ${cost} credits and you have ${available}.`, fatal: true } }
      }
      const action = await createPendingAction({
        userId: ctx.user.id,
        toolName: "run_seo_audit",
        parameters: { projectId: parsed.projectId },
        risk: "CONFIRM",
        description: `Run an SEO visibility audit of ${gate.project.name}'s live site (${cost} credits).`,
        cost: { amount: cost, creditsAvailable: available, label: "SEO visibility audit" },
        conversationId: ctx.conversationId,
      })
      return { ok: true, pending: action }
    } catch (e) {
      logger.warn("cofounder.tool.seo", "prepare failed", { message: e instanceof Error ? e.message : String(e) })
      return { ok: false, error: { code: "VALIDATION", message: "I couldn't set up that audit." } }
    }
  },
  async executeApproved(input, ctx): Promise<ToolOutcome> {
    let charged = false
    let projectId = ""
    try {
      const parsed = runSeoAuditSchema.parse(input)
      projectId = parsed.projectId
      if (!isSeoAuditEnabledForUser(ctx.user.id)) {
        return { success: false, error: { code: "FEATURE_DISABLED", message: "SEO audits aren't available for this account.", fatal: true } }
      }
      const gate = await requireDeployedProject(ctx, parsed.projectId)
      if (!gate.ok) {
        return { success: false, error: { code: gate.code, message: gate.message, fatal: true } }
      }

      charged = await chargeSeoAuditCredits(ctx.user.id, parsed.projectId)
      if (!charged) {
        return { success: false, error: { code: "INSUFFICIENT_CREDITS", message: "You don't have enough credits for this audit.", fatal: true } }
      }

      const outcome = await runSeoAudit({ userId: ctx.user.id, projectId: parsed.projectId, url: gate.url, creditsCharged: getSeoAuditCost() })

      return {
        success: true,
        type: "seo_audit",
        data: {
          auditId: outcome.auditId,
          projectId: parsed.projectId,
          url: outcome.url,
          score: outcome.score,
          pagesCrawled: outcome.pagesCrawled,
          findings: outcome.findings.map((f) => ({ id: f.id, label: f.label, status: f.status, ...(f.observed ? { observed: f.observed } : {}), ...(f.note ? { note: f.note } : {}) })),
          note: "Deterministic on-page findings from a bounded crawl. No rankings, traffic, or conversion are measured or implied.",
        },
        navigation: { target: "market", projectId: parsed.projectId },
        ...(ctx.pendingActionId ? { pendingActionId: ctx.pendingActionId } : {}),
      }
    } catch (e) {
      if (charged && projectId) {
        await refundSeoAuditCredits(ctx.user.id, projectId)
      }
      if (e instanceof AppError && e.code === "FIRECRAWL_UNAVAILABLE") {
        return { success: false, error: { code: "FIRECRAWL_UNAVAILABLE", message: "The website analyzer couldn't reach that site. Credits were refunded." } }
      }
      logger.warn("cofounder.tool.seo", "executeApproved failed", { message: e instanceof Error ? e.message : String(e) })
      return toToolOutcome(e, "The audit failed. Any credits were refunded.")
    }
  },
}
