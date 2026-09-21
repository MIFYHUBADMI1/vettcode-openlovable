import "server-only"
import { store } from "@/lib/store/store"
import { toToolOutcome } from "../errors"
import { createPendingAction } from "../pending-actions"
import { ownedProject, pendingActionMessage } from "./projects"
import { buildPlanSummaryFromSpec } from "../plan-summary"
import { runPlanAnalysis, estimateAutoComplete, autoCompleteSection } from "@/lib/analysis/plan-analysis-service"
import { applyPlanSectionUpdate } from "@/lib/projects/project-actions"
import {
  getPlanSection,
  validatePlanSectionValue,
  GENERATOR_MANAGED_SECTIONS,
  isPlaceholderValue,
} from "@/lib/analysis/plan-sections"
import type { ToolDefinition, ToolContext } from "../types"
import {
  getPlanSchema,
  proposePlanUpdateSchema,
  applyPlanUpdateSchema,
  analyzePlanSchema,
  autoCompletePlanSchema,
} from "../schemas"

/**
 * Plan tools (spec sections 15–21). The Collaborate system is the precedent:
 * proposals are reviewable, section-level, validated through the SAME
 * pipeline as the PATCH route, and never applied without explicit approval.
 * No second plan mutation mechanism exists — everything funnels through
 * applyPlanSectionUpdate (shared with the REST route).
 */

function isUndefined(v: string | undefined): boolean {
  return !v || isPlaceholderValue(v)
}

async function buildProposalItems(
  ctx: ToolContext,
  projectId: string,
  changes: Array<{ section: string; proposedValue: string; reason?: string }>,
): Promise<{ ok: true; items: NonNullable<import("../types").PendingActionRecord["items"]> } | { ok: false; code: string; message: string }> {
  const project = await ownedProject(ctx, projectId)
  if (!project) return { ok: false, code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't access that project." }
  if (!project.specification) return { ok: false, code: "VALIDATION", message: "This project has no plan yet — proposals need a plan to build on." }
  const items: NonNullable<import("../types").PendingActionRecord["items"]> = []
  for (const change of changes) {
    const def = getPlanSection(change.section)
    if (!def) return { ok: false, code: "VALIDATION", message: `Unknown plan section "${change.section}".` }
    if (GENERATOR_MANAGED_SECTIONS.has(change.section)) {
      return { ok: false, code: "VALIDATION", message: `"${def.label}" is generated later in the build and can't be proposed here.` }
    }
    const validated = validatePlanSectionValue(change.section, change.proposedValue)
    if (!validated.ok) return { ok: false, code: "VALIDATION", message: `Proposed value for "${def.label}" is invalid: ${validated.error}` }
    const current = def.read(project.specification)
    items.push({
      section: change.section,
      label: def.label,
      currentValue: isUndefined(current) ? "(not defined yet)" : (current ?? "").slice(0, 400),
      proposedValue: validated.value,
      ...(change.reason ? { reason: change.reason } : {}),
    })
  }
  return { ok: true, items }
}

function describeProposal(items: NonNullable<import("../types").PendingActionRecord["items"]>): string {
  if (items.length === 1) {
    return `Plan change proposed for "${items[0].label}".`
  }
  return `${items.length} plan changes proposed: ${items.map((i) => i.label).join(", ")}.`
}

/** Shared prepare for propose_plan_update / apply_plan_update — both create a
 * reviewable pending action; execution applies through the shared section
 * update service. */
async function preparePlanChange(
  ctx: ToolContext,
  toolName: string,
  input: unknown,
  changes: Array<{ section: string; proposedValue: string; reason?: string }>,
) {
  const parsed = proposePlanUpdateSchema.pick({ projectId: true }).parse({ projectId: (input as { projectId?: string }).projectId })
  const itemsResult = await buildProposalItems(ctx, parsed.projectId, changes)
  if (!itemsResult.ok) {
    return { ok: false as const, error: { code: itemsResult.code, message: itemsResult.message, ...(itemsResult.code === "UNAUTHORIZED_PROJECT_ACCESS" ? { fatal: true } : {}) } }
  }
  const action = await createPendingAction({
    userId: ctx.user.id,
    toolName,
    parameters: input as Record<string, unknown>,
    risk: "CONFIRM",
    description: describeProposal(itemsResult.items),
    items: itemsResult.items,
  })
  return { ok: true as const, pending: action }
}

export const getPlanTool: ToolDefinition = {
  name: "get_plan",
  description:
    "Read a project's business plan as a compact summary: plan health percent, which sections are defined, which are missing, and recent accepted decisions. Use this before advising on strategy or proposing changes.",
  risk: "READ",
  requiresConfirmation: false,
  inputSchema: getPlanSchema,
  async execute(input, ctx) {
    try {
      const parsed = getPlanSchema.parse(input)
      const project = await ownedProject(ctx, parsed.projectId)
      if (!project) {
        return { success: false, error: { code: "UNAUTHORIZED_PROJECT_ACCESS", message: "I couldn't access that project.", fatal: true } }
      }
      if (!project.specification) {
        return {
          success: true,
          type: "plan_summary",
          data: { projectId: project.id, name: project.name, plan: { hasPlan: false, completedSections: [], missingSections: [], recentDecisions: [] } },
        }
      }
      return {
        success: true,
        type: "plan_summary",
        data: {
          projectId: project.id,
          name: project.name,
          plan: buildPlanSummaryFromSpec(project.specification, project.planUpdateNotes ?? []),
          cachedAnalysisAvailable: Boolean(project.planAnalysis),
        },
      }
    } catch (e) {
      return toToolOutcome(e, "I couldn't read that plan right now.")
    }
  },
}

export const proposePlanUpdateTool: ToolDefinition = {
  name: "propose_plan_update",
  description:
    "Propose improvements to one or more plan sections. Creates a reviewable proposal card — NOTHING changes until the founder approves it. Show current vs proposed values in your reply. Use when you have a concrete, well-founded improvement.",
  risk: "CONFIRM",
  requiresConfirmation: true,
  inputSchema: proposePlanUpdateSchema,
  async prepare(input, ctx) {
    try {
      const parsed = proposePlanUpdateSchema.parse(input)
      return preparePlanChange(ctx, "propose_plan_update", parsed, parsed.changes)
    } catch (e) {
      return { ok: false as const, error: { code: "VALIDATION", message: e instanceof Error ? e.message : "Invalid proposal." } }
    }
  },
  async executeApproved(input, ctx) {
    try {
      const parsed = proposePlanUpdateSchema.parse(input)
      const results: Array<{ section: string; label: string }> = []
      for (const change of parsed.changes) {
        const r = await applyPlanSectionUpdate(ctx.user.id, parsed.projectId, {
          section: change.section,
          value: change.proposedValue,
          viaCofounder: true,
        })
        if (!r.ok) {
          return { success: false, error: { code: r.code, message: r.message ?? "The plan update failed." } }
        }
        results.push({ section: r.section ?? change.section, label: r.label ?? change.section })
      }
      return {
        success: true,
        type: "plan_updated",
        data: { projectId: parsed.projectId, updated: results },
        navigation: { target: "plan", projectId: parsed.projectId },
        ...(ctx.pendingActionId ? { pendingActionId: ctx.pendingActionId } : {}),
      }
    } catch (e) {
      return toToolOutcome(e, "I couldn't apply the plan update.")
    }
  },
}

export const applyPlanUpdateTool: ToolDefinition = {
  name: "apply_plan_update",
  description:
    "Apply a plan change the founder has ALREADY explicitly stated and confirmed (for example they said 'change target users to X' and you are confirming the exact value). Creates a confirmation card showing current vs new; the change applies only after approval.",
  risk: "CONFIRM",
  requiresConfirmation: true,
  inputSchema: applyPlanUpdateSchema,
  async prepare(input, ctx) {
    try {
      const parsed = applyPlanUpdateSchema.parse(input)
      return preparePlanChange(
        ctx,
        "apply_plan_update",
        parsed,
        parsed.changes.map((c) => ({ section: c.section, proposedValue: c.value })),
      )
    } catch (e) {
      return { ok: false as const, error: { code: "VALIDATION", message: e instanceof Error ? e.message : "Invalid plan update." } }
    }
  },
  async executeApproved(input, ctx) {
    try {
      const parsed = applyPlanUpdateSchema.parse(input)
      const results: Array<{ section: string; label: string }> = []
      for (const [i, change] of parsed.changes.entries()) {
        const r = await applyPlanSectionUpdate(ctx.user.id, parsed.projectId, {
          section: change.section,
          value: change.value,
          acceptedProposal:
            parsed.changes.length === 1 && parsed.acceptedProposalId
              ? { id: parsed.acceptedProposalId }
              : null,
          viaCofounder: true,
        })
        if (!r.ok) {
          return { success: false, error: { code: r.code, message: r.message ?? "The plan update failed." } }
        }
        results.push({ section: r.section ?? change.section, label: r.label ?? change.section })
      }
      return {
        success: true,
        type: "plan_updated",
        data: { projectId: parsed.projectId, updated: results },
        navigation: { target: "plan", projectId: parsed.projectId },
        ...(ctx.pendingActionId ? { pendingActionId: ctx.pendingActionId } : {}),
      }
    } catch (e) {
      return toToolOutcome(e, "I couldn't apply the plan update.")
    }
  },
}

export const analyzePlanTool: ToolDefinition = {
  name: "analyze_plan",
  description:
    "Run the structured plan analysis (the same one the Collaborate workspace uses): findings, strengths, gaps, and ready-made proposals. Uses the cached analysis when fresh (free); a fresh run costs the configured plan-analysis credits from the founder's balance. Use get_plan first — only run a fresh analysis when the founder asks for a deep review.",
  risk: "READ",
  requiresConfirmation: false,
  inputSchema: analyzePlanSchema,
  async execute(input, ctx) {
    try {
      const parsed = analyzePlanSchema.parse(input)
      const result = await runPlanAnalysis(ctx.user.id, parsed.projectId, { refresh: parsed.refresh })
      if (!result.ok) {
        return {
          success: false,
          error: { code: result.code, message: result.message, ...(result.code === "UNAUTHORIZED_PROJECT_ACCESS" ? { fatal: true } : {}) },
        }
      }
      const a = result.data.analysis
      return {
        success: true,
        type: "plan_analysis",
        data: {
          projectId: parsed.projectId,
          cached: result.data.cached,
          creditsCharged: a.creditsCharged ?? 0,
          summary: a.summary,
          findings: a.findings.slice(0, 6).map((f) => ({ section: f.section, severity: f.severity, title: f.title, why: f.why, recommendation: f.recommendation })),
          proposals: a.proposals.slice(0, 3).map((p) => ({ section: p.section, proposedValue: p.proposedValue.slice(0, 400), reason: p.reason })),
          nextBestAction: a.nextBestAction ?? null,
        },
      }
    } catch (e) {
      return toToolOutcome(e, "The plan analysis failed. No charge was kept.")
    }
  },
}

export const autoCompletePlanTool: ToolDefinition = {
  name: "autocomplete_plan",
  description:
    "Prepare drafting ONE missing plan section with AI (the existing auto-complete engine). Costs the configured per-section credits — the confirmation card shows the exact cost. Drafts are reviewable afterwards and never overwrite existing content.",
  risk: "CONFIRM",
  requiresConfirmation: true,
  inputSchema: autoCompletePlanSchema,
  async prepare(input, ctx) {
    try {
      const parsed = autoCompletePlanSchema.parse(input)
      const estimate = await estimateAutoComplete(ctx.user.id, parsed.projectId)
      if (!estimate.ok) {
        return { ok: false as const, error: { code: estimate.code, message: estimate.message, ...(estimate.code === "UNAUTHORIZED_PROJECT_ACCESS" ? { fatal: true } : {}) } }
      }
      if (estimate.data.missingSections.length === 0) {
        return { ok: false as const, error: { code: "VALIDATION", message: "The plan has no missing sections to auto-complete." } }
      }
      const section = estimate.data.missingSections[0]
      const action = await createPendingAction({
        userId: ctx.user.id,
        toolName: "autocomplete_plan",
        parameters: { projectId: parsed.projectId, section: section.id },
        risk: "CONFIRM",
        description: `Auto-complete the missing plan section "${section.label}" (then continue with the next missing section if you approve again).`,
        cost: {
          amount: estimate.data.sectionCost,
          creditsAvailable: estimate.data.availableCredits,
          label: `Auto-complete "${section.label}"`,
        },
      })
      return { ok: true as const, pending: action }
    } catch (e) {
      return { ok: false as const, error: { code: "VALIDATION", message: "Invalid auto-complete request." } }
    }
  },
  async executeApproved(input, ctx) {
    try {
      const parsed = autoCompletePlanSchema.parse(input)
      // Resolve the section from the pending action parameters when present —
      // the approval endpoint passes the ORIGINAL stored parameters.
      const stored = (input as { section?: string }).section
      const section = typeof stored === "string" && stored ? stored : undefined
      if (!section) {
        const estimate = await estimateAutoComplete(ctx.user.id, parsed.projectId)
        if (!estimate.ok) return { success: false, error: { code: estimate.code, message: estimate.message } }
        const first = estimate.data.missingSections[0]
        if (!first) return { success: false, error: { code: "VALIDATION", message: "No missing sections." } }
        const r = await autoCompleteSection(ctx.user.id, parsed.projectId, first.id)
        if (!r.ok) return { success: false, error: { code: r.code, message: r.message } }
        return {
          success: true,
          type: "auto_completed",
          data: { projectId: parsed.projectId, section: r.data.section, label: r.data.label, remaining: r.data.remainingSections.length },
          navigation: { target: "collaborate", projectId: parsed.projectId },
          ...(ctx.pendingActionId ? { pendingActionId: ctx.pendingActionId } : {}),
        }
      }
      const r = await autoCompleteSection(ctx.user.id, parsed.projectId, section)
      if (!r.ok) return { success: false, error: { code: r.code, message: r.message } }
      return {
        success: true,
        type: "auto_completed",
        data: { projectId: parsed.projectId, section: r.data.section, label: r.data.label, remaining: r.data.remainingSections.length },
        navigation: { target: "collaborate", projectId: parsed.projectId },
        ...(ctx.pendingActionId ? { pendingActionId: ctx.pendingActionId } : {}),
      }
    } catch (e) {
      return toToolOutcome(e, "The auto-complete failed. Credits were refunded.")
    }
  },
}

// Re-export for registry wiring convenience.
export { pendingActionMessage }
