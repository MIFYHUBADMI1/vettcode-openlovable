import "server-only"

/**
 * Campaign tools (Phase 6 — W5).
 *
 * `propose_campaign` is a CONFIRM-tier write: it turns an AI suggestion (or a
 * founder's request) into a durable campaign PLAN — but ONLY after the founder
 * approves a reviewable card. prepare() validates and gates (flag + ownership)
 * and creates the pending action WITHOUT persisting anything; executeApproved()
 * re-gates and creates the campaign. Campaigns are FREE — there is no
 * charge/refund path, and NOTHING here sends email, posts to social, spends ad
 * budget, or runs on a timer. The job substrate (Phase 0) does not exist and is
 * not faked; email needs a consent layer, social/ad posting needs per-platform
 * approvals. A campaign records only what the founder plans. Ownership is
 * re-derived from the session (ctx.user.id) on every step.
 *
 * `list_campaigns` is READ: it returns the founder's own campaign plans
 * (bounded projection) through the same ownedProject gate.
 */

import { createPendingAction } from "../pending-actions"
import { toToolOutcome } from "../errors"
import type { ToolDefinition, PrepareOutcome, ToolOutcome } from "../types"
import { proposeCampaignSchema, listCampaignsSchema } from "../schemas"
import { ownedProject } from "./projects"
import { isCampaignsEnabledForUser } from "@/lib/marketing/feature-flags"
import { createCampaign, listCampaigns } from "@/lib/marketing/campaigns/service"
import { logger } from "@/lib/logging/logger"

export const proposeCampaignTool: ToolDefinition = {
  name: "propose_campaign",
  description:
    "Suggest a marketing campaign PLAN for one of the founder's own projects and add it to their campaign list. This creates a confirmation card first — nothing is saved until the founder approves. Use when the founder wants a plan captured for a launch, promotion, or channel push. A campaign is a free, manual PLAN only: it does NOT send email, post to social, spend any budget, or run on a schedule (that infrastructure does not exist), it is an AI proposal the founder can edit or dismiss, and never a measured result. A short name and optional objective/channels are enough.",
  risk: "CONFIRM",
  requiresConfirmation: true,
  inputSchema: proposeCampaignSchema,
  async prepare(input, ctx): Promise<PrepareOutcome> {
    try {
      const parsed = proposeCampaignSchema.parse(input)
      if (!isCampaignsEnabledForUser(ctx.user.id)) {
        return { ok: false, error: { code: "FEATURE_DISABLED", message: "Campaigns aren't available for this account yet.", fatal: true } }
      }
      const project = await ownedProject(ctx, parsed.projectId)
      if (!project) {
        return { ok: false, error: { code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't access that project.", fatal: true } }
      }
      const action = await createPendingAction({
        userId: ctx.user.id,
        toolName: "propose_campaign",
        parameters: {
          projectId: parsed.projectId,
          name: parsed.name,
          ...(parsed.objective ? { objective: parsed.objective } : {}),
          ...(parsed.channels && parsed.channels.length ? { channels: parsed.channels } : {}),
        },
        risk: "CONFIRM",
        description: `Add campaign "${parsed.name.trim()}" to ${project.name}'s plans.`,
        conversationId: ctx.conversationId,
      })
      return { ok: true, pending: action }
    } catch (e) {
      logger.warn("cofounder.tool.campaigns", "prepare failed", { message: e instanceof Error ? e.message : String(e) })
      return { ok: false, error: { code: "VALIDATION", message: "I couldn't set up that campaign." } }
    }
  },
  async executeApproved(input, ctx): Promise<ToolOutcome> {
    try {
      // The approval endpoint re-passes the ORIGINAL stored parameters.
      const parsed = proposeCampaignSchema.parse(input)
      if (!isCampaignsEnabledForUser(ctx.user.id)) {
        return { success: false, error: { code: "FEATURE_DISABLED", message: "Campaigns aren't available for this account.", fatal: true } }
      }
      const project = await ownedProject(ctx, parsed.projectId)
      if (!project) {
        return { success: false, error: { code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't access that project.", fatal: true } }
      }

      const campaign = await createCampaign({
        userId: ctx.user.id,
        projectId: parsed.projectId,
        name: parsed.name,
        objective: parsed.objective,
        channels: parsed.channels,
        origin: "ai_generated",
      })

      return {
        success: true,
        type: "campaign",
        data: {
          campaignId: campaign.id,
          projectId: campaign.projectId,
          name: campaign.name,
          status: campaign.status,
          channels: campaign.channels,
          note: "AI-proposed campaign plan added as a draft. It plans and tracks only — nothing is sent, posted, spent, or scheduled.",
        },
        navigation: { target: "campaigns", projectId: parsed.projectId },
        ...(ctx.pendingActionId ? { pendingActionId: ctx.pendingActionId } : {}),
      }
    } catch (e) {
      logger.warn("cofounder.tool.campaigns", "executeApproved failed", { message: e instanceof Error ? e.message : String(e) })
      return toToolOutcome(e, "The campaign couldn't be added. Please try again.")
    }
  },
}

export const listCampaignsTool: ToolDefinition = {
  name: "list_campaigns",
  description:
    "Read the founder's own campaign plans for one project — name, objective, channels, and lifecycle status. Strictly read-only: it never creates, edits, activates, pauses, or runs anything. Use when the founder asks what campaigns exist or what's planned. Campaigns are plans the founder manages manually, not measured outcomes.",
  risk: "READ",
  requiresConfirmation: false,
  inputSchema: listCampaignsSchema,
  async execute(input, ctx) {
    try {
      const parsed = listCampaignsSchema.parse(input)
      if (!isCampaignsEnabledForUser(ctx.user.id)) {
        return { success: false, error: { code: "FEATURE_DISABLED", message: "Campaigns aren't available for this account yet.", fatal: true } }
      }
      const project = await ownedProject(ctx, parsed.projectId)
      if (!project) {
        return { success: false, error: { code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't access that project.", fatal: true } }
      }
      const campaigns = await listCampaigns(parsed.projectId, {
        ...(parsed.status ? { status: parsed.status } : {}),
        limit: parsed.limit ?? 20,
      })
      return {
        success: true,
        type: "campaigns_list",
        data: {
          projectId: parsed.projectId,
          projectName: project.name,
          count: campaigns.length,
          campaigns: campaigns.slice(0, 20).map((c) => ({
            id: c.id,
            name: c.name,
            status: c.status,
            channels: c.channels,
            origin: c.origin,
          })),
        },
        navigation: { target: "campaigns", projectId: parsed.projectId },
      }
    } catch (e) {
      logger.warn("cofounder.tool.campaigns", "list failed", { message: e instanceof Error ? e.message : String(e) })
      return toToolOutcome(e, "I couldn't read the campaign list right now.")
    }
  },
}
