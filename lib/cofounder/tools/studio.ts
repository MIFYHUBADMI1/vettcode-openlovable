import "server-only"

/**
 * generate_marketing_copy CONFIRM-tier tool (Phase 4 — W3).
 *
 * A credit-charging, AI-generating action, so it runs through the existing
 * pending-action flow: prepare() validates + flag/provider/ownership-gates +
 * prices a reviewable card and generates/charges NOTHING; executeApproved()
 * charges, generates ONE draft through the shared generator, persists it, and
 * refunds on failure. The charge is idempotent on the approved pending-action id
 * so a retried approval can't double-spend. Ownership is re-derived from the
 * session at every step (ctx.user.id), and the output is a DRAFT — this tool can
 * never publish or schedule (that capability does not exist yet). All AI/credit
 * capabilities come from lib/marketing/studio + the shared credit service.
 */

import { createPendingAction } from "../pending-actions"
import { toToolOutcome } from "../errors"
import type { ToolDefinition, PrepareOutcome, ToolOutcome } from "../types"
import { generateMarketingCopySchema } from "../schemas"
import { ownedProject } from "./projects"
import { isStudioEnabledForUser } from "@/lib/marketing/feature-flags"
import { getStudioCost, getStudioAffordability, chargeStudioCredits, refundStudioCredits } from "@/lib/marketing/studio/credits"
import { generateMarketingDraft } from "@/lib/marketing/studio/service"
import { isGenerationConfigured, studioTemplateLabel } from "@/lib/marketing/studio/generator"
import { AppError } from "@/lib/errors"
import { logger } from "@/lib/logging/logger"

export const generateMarketingCopyTool: ToolDefinition = {
  name: "generate_marketing_copy",
  description:
    "Draft marketing copy for a project in the founder's own brand voice using a fixed template (landing_hero, feature_blurb, email_welcome, or ad_headline). This consumes credits and creates a confirmation card first — nothing is generated or charged until the founder approves. The result is a saved DRAFT in the Marketing Studio, never published. Use when the founder asks for help writing marketing copy. Brand voice is derived from the project's plan.",
  risk: "CONFIRM",
  requiresConfirmation: true,
  inputSchema: generateMarketingCopySchema,
  async prepare(input, ctx): Promise<PrepareOutcome> {
    try {
      const parsed = generateMarketingCopySchema.parse(input)
      if (!isStudioEnabledForUser(ctx.user.id)) {
        return { ok: false, error: { code: "FEATURE_DISABLED", message: "The Marketing Studio isn't available for this account yet.", fatal: true } }
      }
      if (!isGenerationConfigured()) {
        return { ok: false, error: { code: "AI_UNAVAILABLE", message: "AI generation isn't connected right now.", fatal: true } }
      }
      const project = await ownedProject(ctx, parsed.projectId)
      if (!project) {
        return { ok: false, error: { code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't access that project.", fatal: true } }
      }
      const { cost, available, affordable } = await getStudioAffordability(ctx.user.id)
      if (!affordable) {
        return { ok: false, error: { code: "INSUFFICIENT_CREDITS", message: `This draft costs ${cost} credits and you have ${available}.`, fatal: true } }
      }
      const action = await createPendingAction({
        userId: ctx.user.id,
        toolName: "generate_marketing_copy",
        parameters: { projectId: parsed.projectId, template: parsed.template, ...(parsed.brief ? { brief: parsed.brief } : {}) },
        risk: "CONFIRM",
        description: `Draft ${studioTemplateLabel(parsed.template)} copy for ${project.name} (${cost} credits).`,
        cost: { amount: cost, creditsAvailable: available, label: `Marketing Studio: ${studioTemplateLabel(parsed.template)}` },
        conversationId: ctx.conversationId,
      })
      return { ok: true, pending: action }
    } catch (e) {
      logger.warn("cofounder.tool.studio", "prepare failed", { message: e instanceof Error ? e.message : String(e) })
      return { ok: false, error: { code: "VALIDATION", message: "I couldn't set up that draft." } }
    }
  },
  async executeApproved(input, ctx): Promise<ToolOutcome> {
    let charged = false
    let projectId = ""
    try {
      // The approval endpoint re-passes the ORIGINAL stored parameters.
      const parsed = generateMarketingCopySchema.parse(input)
      projectId = parsed.projectId
      if (!isStudioEnabledForUser(ctx.user.id)) {
        return { success: false, error: { code: "FEATURE_DISABLED", message: "The Marketing Studio isn't available for this account.", fatal: true } }
      }
      const project = await ownedProject(ctx, parsed.projectId)
      if (!project) {
        return { success: false, error: { code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't access that project.", fatal: true } }
      }

      charged = await chargeStudioCredits(ctx.user.id, parsed.projectId, ctx.pendingActionId)
      if (!charged) {
        return { success: false, error: { code: "INSUFFICIENT_CREDITS", message: "You don't have enough credits for this draft.", fatal: true } }
      }

      const draft = await generateMarketingDraft({ userId: ctx.user.id, projectId: parsed.projectId, template: parsed.template, brief: parsed.brief })

      return {
        success: true,
        type: "marketing_content",
        data: {
          contentId: draft.contentId,
          projectId: draft.projectId,
          template: draft.template,
          title: draft.title,
          body: draft.body,
          version: draft.version,
          model: draft.model,
          brandVoiceSources: draft.brandVoiceSources,
          note: "AI-generated draft saved in the Marketing Studio. Not published, and not a measured result — review and edit before using anywhere.",
        },
        navigation: { target: "studio", projectId: parsed.projectId },
        ...(ctx.pendingActionId ? { pendingActionId: ctx.pendingActionId } : {}),
      }
    } catch (e) {
      if (charged && projectId) {
        await refundStudioCredits(ctx.user.id, projectId)
      }
      if (e instanceof AppError && e.code === "AI_UNAVAILABLE") {
        return { success: false, error: { code: "AI_UNAVAILABLE", message: "The draft couldn't be generated. Credits were refunded." } }
      }
      logger.warn("cofounder.tool.studio", "executeApproved failed", { message: e instanceof Error ? e.message : String(e) })
      return toToolOutcome(e, "The draft failed. Any credits were refunded.")
    }
  },
}
