import { requireUser } from "@/lib/auth/session"
import { store, cryptoId } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { generateText } from "ai"
import { MODEL } from "@/lib/analysis/model"
import {
  buildPlanBrief,
  buildSectionFocusBlock,
  COFOUNDER_AUTOCOMPLETE_SYSTEM,
  parseDraftResponse,
} from "@/lib/analysis/cofounder"
import {
  PLAN_SECTIONS,
  GENERATOR_MANAGED_SECTIONS,
  getPlanSection,
  computePlanHealth,
  validatePlanSectionValue,
  applySectionUpdate,
  clearSectionUpdate,
  isPlaceholderValue,
  type PlanSectionId,
} from "@/lib/analysis/plan-sections"
import { decisionForProposal } from "@/lib/analysis/cofounder"
import {
  chargeAutoCompleteCredits,
  refundCollaboration,
} from "@/lib/analysis/collaborate-credits"
import { getCollaborateCosts } from "@/lib/billing/runtime-config"
import { getAvailableCredits } from "@/lib/billing/credit-service"
import { ApplicationSpecificationSchema, type ApplicationSpecification } from "@/lib/types/specification"
import type { PlanProposal, PlanFinding } from "@/lib/types/plan-analysis"
import type { ProjectEvent } from "@/lib/types/project"

/**
 * AI Co-Founder auto-complete.
 *
 * GET  /api/projects/[id]/auto-complete
 *   → estimate: which sections are missing, the exact credit cost, and
 *     whether the founder can afford the run. No AI call, no charge.
 *
 * POST /api/projects/[id]/auto-complete   body: { section: string }
 *   → drafts ONE missing section. The client drives the run section by
 *     section (request per section, as designed) and re-reads the fresh
 *     spec every time, so earlier drafts feed later ones. Each request is
 *     authenticated, authorized, charged up-front, refunded on AI failure,
 *     and persisted through the same validated plan-section pipeline as a
 *     founder-approved change. Nothing is ever applied silently: every
 *     auto-completed section is recorded and can be undone per-section
 *     from the workspace.
 *
 * POST body: { section, action: "clear" }
 *   → undo: resets that section to empty ("not defined"). No AI call,
 *     no charge — it removes the co-founder's draft, it doesn't create one.
 *
 * POST body: { action: "suggestions" }
 *   → suggestions-first phase: returns the cached analysis proposals that
 *     target currently-missing sections. No AI call, no charge — these
 *     drafts already exist in the project's analysis. The client applies
 *     each through the standard PATCH sectionUpdate (identical to clicking
 *     Add on an insight card), then asks the AI only for sections that are
 *     STILL missing afterwards.
 */

function missingSectionIds(spec: ApplicationSpecification): PlanSectionId[] {
  return PLAN_SECTIONS.filter((def) => {
    // Generator-managed structures (features/flows/data) are drafted by the
    // generator after the plan is approved — auto-complete never touches them.
    if (GENERATOR_MANAGED_SECTIONS.has(def.id)) return false
    const value = def.read(spec)
    return !value || isPlaceholderValue(value)
  }).map((d) => d.id)
}

interface AutoCompleteEstimate {
  missingSections: Array<{ id: string; label: string }>
  sectionCost: number
  totalCost: number
  availableCredits: number
  canAfford: boolean
  affordableSections: number
  /** Cached analysis proposals targeting still-missing sections. */
  suggestionsAvailable: number
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) {
      return fail("UNAUTHORIZED_PROJECT_ACCESS", "Project not found.", 404)
    }
    if (!project.specification) {
      return fail("VALIDATION", "This project has no plan to complete yet.", 409)
    }

    const [costs, available] = await Promise.all([
      getCollaborateCosts(),
      getAvailableCredits(user.id),
    ])
    const missing = missingSectionIds(project.specification)
    const totalCost = missing.length * costs.autoCompleteSectionCost
    const missingSet = new Set(missing)
    const suggestionsAvailable = (project.planAnalysis?.proposals ?? []).filter((p) =>
      missingSet.has(p.section as PlanSectionId),
    ).length

    const estimate: AutoCompleteEstimate = {
      missingSections: missing
        .map((sid) => ({ id: sid, label: getPlanSection(sid)?.label ?? sid })),
      sectionCost: costs.autoCompleteSectionCost,
      totalCost,
      availableCredits: available,
      canAfford: available >= totalCost || costs.autoCompleteSectionCost === 0,
      affordableSections:
        costs.autoCompleteSectionCost > 0 ? Math.floor(available / costs.autoCompleteSectionCost) : missing.length,
      suggestionsAvailable,
    }
    return ok(estimate)
  } catch (e) {
    return handleRouteError("api.projects.auto-complete.get", e)
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params

    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) {
      return fail("UNAUTHORIZED_PROJECT_ACCESS", "Project not found.", 404)
    }
    const spec = project.specification
    if (!spec) {
      return fail("VALIDATION", "This project has no plan to complete yet.", 409)
    }

    const body = (await req.json().catch(() => ({}))) as { section?: unknown; action?: unknown }
    const section = typeof body.section === "string" ? body.section : ""
    const def = getPlanSection(section)
    if (!def) return fail("VALIDATION", "Unknown plan section.", 422)

    // Suggestions-first phase: hand back every cached analysis proposal that
    // targets a section still missing. Free — no AI, no credits.
    if (body.action === "suggestions") {
      const proposals = project.planAnalysis?.proposals ?? []
      const suggestions = proposals
        .filter((p) => {
          const pd = getPlanSection(p.section)
          if (!pd || GENERATOR_MANAGED_SECTIONS.has(p.section)) return false
          const v = pd.read(spec)
          return !v || isPlaceholderValue(v)
        })
        .map((p) => ({
          id: p.id,
          section: p.section,
          label: getPlanSection(p.section)?.label ?? p.section,
          proposedValue: p.proposedValue,
        }))
      return ok({ suggestions, hasCachedAnalysis: Boolean(project.planAnalysis) })
    }

    // Undo path: reset the section to "not defined". No AI call, no charge.
    if (body.action === "clear") {
      if (GENERATOR_MANAGED_SECTIONS.has(section)) {
        return fail("VALIDATION", "This section can't be cleared.", 422)
      }
      const cleared = clearSectionUpdate(spec, section as PlanSectionId)
      const reparsed = ApplicationSpecificationSchema.safeParse(cleared)
      if (!reparsed.success) {
        return fail("VALIDATION", "Could not clear this section.", 422)
      }
      const decisionNote = `Undid auto-completed ${def.label}`
      await store.updateProject(id, {
        specification: reparsed.data,
        specSanitized: false,
        planUpdateNotes: [...(project.planUpdateNotes ?? []), decisionNote].slice(-50),
      })
      await store.appendEvent(id, {
        id: cryptoId(),
        at: Date.now(),
        level: "info",
        stage: "plan",
        message: `↩️ Undid co-founder draft for ${def.label}`,
      })
      const remaining = missingSectionIds(reparsed.data)
      return ok({
        section,
        label: def.label,
        cleared: true,
        remainingSections: remaining.map((sid) => ({ id: sid, label: getPlanSection(sid)?.label ?? sid })),
      })
    }

    // Only genuinely missing sections may be auto-completed — the co-founder
    // fills gaps, it never overwrites what the founder already wrote. The
    // generator-managed structures are likewise out of scope for drafts.
    if (GENERATOR_MANAGED_SECTIONS.has(section)) {
      return fail("VALIDATION", "This section is generated later in the build — auto-complete doesn't draft it.", 422)
    }
    const currentValue = def.read(spec)
    if (currentValue && !isPlaceholderValue(currentValue)) {
      return fail("VALIDATION", `"${def.label}" already has content — it won't be overwritten.`, 409)
    }

    // Charge before the model call; refunded below if the AI work fails.
    const charged = await chargeAutoCompleteCredits(user.id, id)
    if (!charged) {
      return fail("INSUFFICIENT_CREDITS", "You don't have enough credits to continue auto-completing.", 402)
    }

    let text: string
    try {
      const { text: reply } = await generateText({
        model: MODEL,
        system: COFOUNDER_AUTOCOMPLETE_SYSTEM,
        prompt: [
          buildPlanBrief(spec),
          "",
          buildSectionFocusBlock(section, spec),
          "",
          `Draft the "${def.label}" section now. Return ONLY the JSON object with {"value": ...}.`,
        ].join("\n"),
        maxOutputTokens: 2048,
      })
      text = reply
    } catch (aiError) {
      await refundCollaboration(user.id, id, "auto-complete")
      throw aiError
    }

    const parsed = parseDraftResponse(text)
    if (!parsed) {
      await refundCollaboration(user.id, id, "auto-complete")
      return fail("UNKNOWN", "The co-founder's draft came back unreadable. You can retry — no credits were kept.", 502)
    }

    const validated = validatePlanSectionValue(section, parsed.value)
    if (!validated.ok) {
      await refundCollaboration(user.id, id, "auto-complete")
      return fail("VALIDATION", validated.error, 422)
    }

    // Persist through the same pipeline as an approved proposal.
    const nextSpec = applySectionUpdate(spec, section as PlanSectionId, validated.value)
    const reparsed = ApplicationSpecificationSchema.safeParse(nextSpec)
    if (!reparsed.success) {
      await refundCollaboration(user.id, id, "auto-complete")
      return fail("VALIDATION", "The draft was invalid for this section. No credits were kept.", 422)
    }

    const decisionNote = `Auto-completed ${def.label}: ${validated.value.slice(0, 200)}`
    const patch: Record<string, unknown> = {
      specification: reparsed.data,
      specSanitized: false,
      planUpdateNotes: [...(project.planUpdateNotes ?? []), decisionNote].slice(-50),
    }

    // Keep the cached analysis consistent (same bookkeeping as PATCH).
    if (project.planAnalysis) {
      const health = computePlanHealth(reparsed.data)
      patch.planAnalysis = {
        ...project.planAnalysis,
        healthPercent: health.percent,
        proposals: (project.planAnalysis.proposals ?? []).filter(
          (p: PlanProposal) => p.section !== section,
        ),
        findings: (project.planAnalysis.findings ?? []).filter(
          (f: PlanFinding) => f.section !== section,
        ),
      }
    }

    const updated = await store.updateProject(id, patch)
    const evt: ProjectEvent = {
      id: cryptoId(),
      at: Date.now(),
      level: "info",
      stage: "plan",
      message: `🤖 Co-founder drafted ${def.label}`,
    }
    await store.appendEvent(id, evt)

    const remaining = updated?.specification ? missingSectionIds(updated.specification) : []
    return ok({
      section,
      label: def.label,
      value: validated.value,
      remainingSections: remaining.map((sid) => ({ id: sid, label: getPlanSection(sid)?.label ?? sid })),
    })
  } catch (e) {
    return handleRouteError("api.projects.auto-complete.post", e)
  }
}
