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
import { generateMarketingCopySchema, refineMarketingContentSchema, searchMarketingContentSchema } from "../schemas"
import { ownedProject } from "./projects"
import { isStudioEnabledForUser, isStudioWorkspaceEnabled } from "@/lib/marketing/feature-flags"
import { getStudioCost, getStudioAffordability, chargeStudioCredits, refundStudioCredits } from "@/lib/marketing/studio/credits"
import { scopedIntentKey } from "@/lib/billing/operation-identity"
import { generateMarketingDraft, reviseContentItem } from "@/lib/marketing/studio/service"
import { isGenerationConfigured, studioTemplateLabel } from "@/lib/marketing/studio/generator"
import { getContentItem, searchContentItems } from "@/lib/marketing/studio/library"
import { contentKind } from "@/lib/marketing/studio/present"
import { brandContextLines, getBrandProfile } from "@/lib/marketing/studio/brand"
import { generateRefinement } from "@/lib/marketing/studio/refine"
import { REFINEMENT_LABELS } from "@/lib/marketing/studio/refinement-options"
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
    // Phase 3 (Workstream C): the approved pending-action id is the stable
    // identity for THIS execution. It is scoped by the session user and the
    // operation, and the SAME key is threaded into the refund below — so a
    // retried approval that fails again can neither double-spend nor
    // double-refund (`studio_${intentKey}` / `studio_${intentKey}_refund`).
    let intentKey: string | undefined
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

      intentKey = scopedIntentKey(ctx.pendingActionId, {
        userId: ctx.user.id,
        operation: "studio_generate",
        projectId: parsed.projectId,
      })
      charged = await chargeStudioCredits(ctx.user.id, parsed.projectId, intentKey)
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
        // Same identity as the charge → a retried failure path is a no-op
        // instead of a second refund.
        await refundStudioCredits(ctx.user.id, projectId, intentKey)
      }
      if (e instanceof AppError && e.code === "AI_UNAVAILABLE") {
        return { success: false, error: { code: "AI_UNAVAILABLE", message: "The draft couldn't be generated. Credits were refunded." } }
      }
      logger.warn("cofounder.tool.studio", "executeApproved failed", { message: e instanceof Error ? e.message : String(e) })
      return toToolOutcome(e, "The draft failed. Any credits were refunded.")
    }
  },
}

// ─── Phase 4 v2: library search + AI rewrite ────────────────────────────────

/** READ — find saved drafts in this project's Studio library. */
export const searchMarketingContentTool: ToolDefinition = {
  name: "search_marketing_content",
  description:
    "Find the founder's SAVED marketing drafts in this project's Studio library. Read-only. Filters by text and/or content type and returns a compact list with title, type, status and a short excerpt. Use when the founder asks what marketing content already exists or wants to reuse a draft. A planned date is a plan, never a publication.",
  risk: "READ",
  requiresConfirmation: false,
  inputSchema: searchMarketingContentSchema,
  async execute(input, ctx): Promise<ToolOutcome> {
    try {
      const parsed = searchMarketingContentSchema.parse(input)
      const project = await ownedProject(ctx, parsed.projectId)
      if (!project) {
        return { success: false, error: { code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't access that project.", fatal: true } }
      }
      const { items } = await searchContentItems(parsed.projectId, {
        ...(parsed.query ? { q: parsed.query } : {}),
        ...(parsed.kind ? { kind: parsed.kind } : {}),
        limit: 8,
      })
      return {
        success: true,
        type: "marketing_content_list",
        data: {
          projectId: parsed.projectId,
          count: items.length,
          items: items.map((i) => ({
            id: i.id,
            title: i.title,
            kind: contentKind(i),
            status: i.status,
            plannedAt: i.plannedAt ?? null,
            excerpt: i.body.replace(/\s+/g, " ").slice(0, 160),
          })),
          note: "Saved drafts only. Status never means published, and a planned date is a plan, not a schedule.",
        },
        navigation: { target: "studio", projectId: parsed.projectId },
      }
    } catch (e) {
      return toToolOutcome(e, "I couldn't search your marketing drafts.")
    }
  },
}

/** CONFIRM — rewrite an existing draft and append a NEW version. */
export const refineMarketingContentTool: ToolDefinition = {
  name: "refine_marketing_content",
  description:
    "Rewrite an existing SAVED marketing draft: shorten, expand, change tone, rewrite for another audience, strengthen the call to action, and more. Consumes credits and creates a confirmation card first — nothing is generated or charged until the founder approves. The result is appended as a NEW version; the previous draft is kept and nothing is published.",
  risk: "CONFIRM",
  requiresConfirmation: true,
  inputSchema: refineMarketingContentSchema,
  async prepare(input, ctx): Promise<PrepareOutcome> {
    try {
      const parsed = refineMarketingContentSchema.parse(input)
      if (!isStudioWorkspaceEnabled(ctx.user.id)) {
        return { ok: false, error: { code: "FEATURE_DISABLED", message: "The Marketing Studio isn't available for this account yet.", fatal: true } }
      }
      if (!isGenerationConfigured()) {
        return { ok: false, error: { code: "AI_UNAVAILABLE", message: "AI generation isn't connected right now.", fatal: true } }
      }
      const project = await ownedProject(ctx, parsed.projectId)
      if (!project) {
        return { ok: false, error: { code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't access that project.", fatal: true } }
      }
      const item = await getContentItem(parsed.projectId, parsed.contentId)
      if (!item) {
        return { ok: false, error: { code: "VALIDATION", message: "I couldn't find that draft.", fatal: true } }
      }
      const { cost, available, affordable } = await getStudioAffordability(ctx.user.id)
      if (!affordable) {
        return { ok: false, error: { code: "INSUFFICIENT_CREDITS", message: `This rewrite costs ${cost} credits and you have ${available}.`, fatal: true } }
      }
      const action = await createPendingAction({
        userId: ctx.user.id,
        toolName: "refine_marketing_content",
        parameters: { projectId: parsed.projectId, contentId: parsed.contentId, action: parsed.action },
        risk: "CONFIRM",
        description: `Rewrite “${item.title}” (${REFINEMENT_LABELS[parsed.action]}) — ${cost} credits.`,
        cost: { amount: cost, creditsAvailable: available, label: "AI rewrite" },
        conversationId: ctx.conversationId,
      })
      return { ok: true, pending: action }
    } catch (e) {
      logger.warn("cofounder.tool.studio", "refine prepare failed", { message: e instanceof Error ? e.message : String(e) })
      return { ok: false, error: { code: "VALIDATION", message: "I couldn't set up that rewrite." } }
    }
  },
  async executeApproved(input, ctx): Promise<ToolOutcome> {
    let charged = false
    let projectId = ""
    // Phase 3 (Workstream C): stable, user-scoped identity shared by the charge
    // and the failure refund — see generate_marketing_copy above.
    let intentKey: string | undefined
    try {
      const parsed = refineMarketingContentSchema.parse(input)
      projectId = parsed.projectId
      if (!isStudioWorkspaceEnabled(ctx.user.id)) {
        return { success: false, error: { code: "FEATURE_DISABLED", message: "The Marketing Studio isn't available for this account.", fatal: true } }
      }
      const project = await ownedProject(ctx, parsed.projectId)
      if (!project) {
        return { success: false, error: { code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't access that project.", fatal: true } }
      }
      const item = await getContentItem(parsed.projectId, parsed.contentId)
      if (!item) {
        return { success: false, error: { code: "VALIDATION", message: "I couldn't find that draft.", fatal: true } }
      }

      intentKey = scopedIntentKey(ctx.pendingActionId, {
        userId: ctx.user.id,
        operation: "studio_refine_tool",
        projectId: parsed.projectId,
      })
      charged = await chargeStudioCredits(ctx.user.id, parsed.projectId, intentKey)
      if (!charged) {
        return { success: false, error: { code: "INSUFFICIENT_CREDITS", message: "You don't have enough credits for this rewrite.", fatal: true } }
      }

      const { lines } = brandContextLines(await getBrandProfile(parsed.projectId))
      const refined = await generateRefinement({
        title: item.title,
        body: item.body,
        action: parsed.action,
        brandLines: lines,
      })
      const saved = await reviseContentItem({
        userId: ctx.user.id,
        projectId: parsed.projectId,
        contentId: item.id,
        body: refined.body,
      })

      return {
        success: true,
        type: "marketing_refined",
        data: {
          contentId: saved.id,
          sourceContentId: item.id,
          projectId: parsed.projectId,
          version: saved.version,
          action: parsed.action,
          title: saved.title,
          excerpt: saved.body.replace(/\s+/g, " ").slice(0, 240),
          note: "Saved as a new draft version. The previous version is kept and nothing was published.",
        },
        navigation: { target: "studio", projectId: parsed.projectId },
        ...(ctx.pendingActionId ? { pendingActionId: ctx.pendingActionId } : {}),
      }
    } catch (e) {
      if (charged && projectId) {
        await refundStudioCredits(ctx.user.id, projectId, intentKey)
      }
      if (e instanceof AppError && e.code === "AI_UNAVAILABLE") {
        return { success: false, error: { code: "AI_UNAVAILABLE", message: "The rewrite couldn't be generated. Credits were refunded." } }
      }
      logger.warn("cofounder.tool.studio", "refine executeApproved failed", { message: e instanceof Error ? e.message : String(e) })
      return toToolOutcome(e, "The rewrite failed. Any credits were refunded.")
    }
  },
}
