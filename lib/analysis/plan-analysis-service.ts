import "server-only"
import { store, cryptoId } from "@/lib/store/store"
import { generateText } from "ai"
import { MODEL } from "@/lib/analysis/model"
import {
  buildCollaborateContext,
  COFOUNDER_ANALYZE_SYSTEM,
  parseAnalysisResponse,
  buildProposal,
} from "@/lib/analysis/cofounder"
import { computePlanHealth } from "@/lib/analysis/plan-sections"
import { chargeAnalysisCredits, chargeAutoCompleteCredits, refundCollaboration } from "@/lib/analysis/collaborate-credits"
import { getCollaborateCosts } from "@/lib/billing/runtime-config"
import { getAvailableCredits } from "@/lib/billing/credit-service"
import {
  PLAN_SECTIONS,
  GENERATOR_MANAGED_SECTIONS,
  getPlanSection,
  validatePlanSectionValue,
  applySectionUpdate,
  isPlaceholderValue,
  type PlanSectionId,
} from "@/lib/analysis/plan-sections"
import { ApplicationSpecificationSchema } from "@/lib/types/specification"
import type { ApplicationSpecification } from "@/lib/types/specification"
import type { PlanAnalysis } from "@/lib/types/plan-analysis"
import type { PlanProposal, PlanFinding } from "@/lib/types/plan-analysis"
import type { ProjectEvent } from "@/lib/types/project"

/**
 * Shared plan AI services — the ONE implementation of plan analysis and
 * auto-complete, used by BOTH the REST routes and the Co-founder tools.
 * Credit charging, caching, and validation behavior are preserved exactly.
 */

const ANALYSIS_FRESHNESS_MS = 1000 * 60 * 30 // 30 minutes

function event(stage: string, message: string, level: ProjectEvent["level"] = "info"): ProjectEvent {
  return { id: cryptoId(), at: Date.now(), level, stage, message }
}

export type PlanServiceOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string; message: string }

export interface PlanAnalysisResult {
  analysis: PlanAnalysis
  cached: boolean
  decisions: number
}

/** Run (or read the cached) plan analysis. Mirrors the analyze-plan route. */
export async function runPlanAnalysis(
  userId: string,
  projectId: string,
  opts: { refresh?: boolean } = {},
): Promise<PlanServiceOutcome<PlanAnalysisResult>> {
  const project = await store.getProject(projectId)
  if (!project || project.userId !== userId) {
    return { ok: false, status: 404, code: "UNAUTHORIZED_PROJECT_ACCESS", message: "Project not found." }
  }
  if (!project.specification) {
    return { ok: false, status: 409, code: "VALIDATION", message: "This project has no plan to analyze yet." }
  }

  const refresh = opts.refresh === true
  const cached = project.planAnalysis
  if (!refresh && cached && Date.now() - cached.generatedAt < ANALYSIS_FRESHNESS_MS && cached.generatedAt >= project.updatedAt - 1000) {
    return { ok: true, data: { analysis: cached, cached: true, decisions: (project.planUpdateNotes ?? []).length } }
  }

  const charged = await chargeAnalysisCredits(userId, projectId)
  if (!charged) {
    return { ok: false, status: 402, code: "INSUFFICIENT_CREDITS", message: "You don't have enough credits to run an analysis." }
  }

  const spec = project.specification
  const context = buildCollaborateContext({
    spec,
    preferences: project.preferences,
    decisions: project.planUpdateNotes ?? [],
    conversation: project.conversation ?? [],
    historyLimit: 6,
    founderVision: project.idea,
    sourceUrl: project.sourceUrl,
  })

  let text: string
  try {
    const result = await generateText({
      model: MODEL,
      system: COFOUNDER_ANALYZE_SYSTEM,
      prompt: context,
      maxOutputTokens: 4096,
    })
    text = result.text
  } catch (aiError) {
    await refundCollaboration(userId, projectId, "analysis")
    throw aiError
  }

  const parsed = parseAnalysisResponse(text, spec)
  if (!parsed) {
    return { ok: false, status: 502, code: "UNKNOWN", message: "The analysis came back unreadable. Please try again." }
  }

  const costs = await getCollaborateCosts()
  const analysis: PlanAnalysis = {
    ...parsed,
    proposals: parsed.proposals.map((p) => buildProposal(spec, p, "analysis")),
    creditsCharged: costs.planAnalysisCost,
  }

  await store.updateProject(projectId, { planAnalysis: analysis })
  await store.appendEvent(projectId, event("plan", `🧠 Plan analyzed — ${analysis.findings.length} findings, ${analysis.proposals.length} suggestions`))

  return { ok: true, data: { analysis, cached: false, decisions: (project.planUpdateNotes ?? []).length } }
}

// ─── Auto-complete ───────────────────────────────────────────────────────────

export interface AutoCompleteEstimate {
  missingSections: Array<{ id: string; label: string }>
  sectionCost: number
  totalCost: number
  availableCredits: number
  canAfford: boolean
  affordableSections: number
  suggestionsAvailable: number
}

export interface AutoCompleteResult {
  section: string
  label: string
  value?: string
  cleared?: boolean
  remainingSections: Array<{ id: string; label: string }>
}

function missingSectionIds(spec: ApplicationSpecification): PlanSectionId[] {
  return PLAN_SECTIONS.filter((def) => {
    if (GENERATOR_MANAGED_SECTIONS.has(def.id)) return false
    const value = def.read(spec)
    return !value || isPlaceholderValue(value)
  }).map((d) => d.id)
}

/** Estimate (no AI, no charge) — mirrors the auto-complete GET route. */
export async function estimateAutoComplete(userId: string, projectId: string): Promise<PlanServiceOutcome<AutoCompleteEstimate>> {
  const project = await store.getProject(projectId)
  if (!project || project.userId !== userId) {
    return { ok: false, status: 404, code: "UNAUTHORIZED_PROJECT_ACCESS", message: "Project not found." }
  }
  if (!project.specification) {
    return { ok: false, status: 409, code: "VALIDATION", message: "This project has no plan to complete yet." }
  }
  const [costs, available] = await Promise.all([
    getCollaborateCosts(),
    getAvailableCredits(userId),
  ])
  const missing = missingSectionIds(project.specification)
  const totalCost = missing.length * costs.autoCompleteSectionCost
  const missingSet = new Set(missing)
  const suggestionsAvailable = (project.planAnalysis?.proposals ?? []).filter((p) => missingSet.has(p.section as PlanSectionId)).length

  return {
    ok: true,
    data: {
      missingSections: missing.map((sid) => ({ id: sid, label: getPlanSection(sid)?.label ?? sid })),
      sectionCost: costs.autoCompleteSectionCost,
      totalCost,
      availableCredits: available,
      canAfford: available >= totalCost || costs.autoCompleteSectionCost === 0,
      affordableSections: costs.autoCompleteSectionCost > 0 ? Math.floor(available / costs.autoCompleteSectionCost) : missing.length,
      suggestionsAvailable,
    },
  }
}

/** Draft ONE missing section (charged, refunded on AI failure) — mirrors the
 * auto-complete POST route. */
export async function autoCompleteSection(userId: string, projectId: string, section: string): Promise<PlanServiceOutcome<AutoCompleteResult>> {
  const project = await store.getProject(projectId)
  if (!project || project.userId !== userId) {
    return { ok: false, status: 404, code: "UNAUTHORIZED_PROJECT_ACCESS", message: "Project not found." }
  }
  const spec = project.specification
  if (!spec) {
    return { ok: false, status: 409, code: "VALIDATION", message: "This project has no plan to complete yet." }
  }
  const def = getPlanSection(section)
  if (!def) {
    return { ok: false, status: 422, code: "VALIDATION", message: "Unknown plan section." }
  }
  if (GENERATOR_MANAGED_SECTIONS.has(section)) {
    return { ok: false, status: 422, code: "VALIDATION", message: "This section is generated later in the build — auto-complete doesn't draft it." }
  }
  const currentValue = def.read(spec)
  if (currentValue && !isPlaceholderValue(currentValue)) {
    return { ok: false, status: 409, code: "VALIDATION", message: `"${def.label}" already has content — it won't be overwritten.` }
  }

  const charged = await chargeAutoCompleteCredits(userId, projectId)
  if (!charged) {
    return { ok: false, status: 402, code: "INSUFFICIENT_CREDITS", message: "You don't have enough credits to continue auto-completing." }
  }

  const { buildPlanBrief, buildSectionFocusBlock, COFOUNDER_AUTOCOMPLETE_SYSTEM, parseDraftResponse } = await import("@/lib/analysis/cofounder")
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
        `Draft the \"${def.label}\" section now. Return ONLY the JSON object with {\"value\": ...}.`,
      ].join("\n"),
      maxOutputTokens: 2048,
    })
    text = reply
  } catch (aiError) {
    await refundCollaboration(userId, projectId, "auto-complete")
    throw aiError
  }

  const parsed = parseDraftResponse(text)
  if (!parsed) {
    await refundCollaboration(userId, projectId, "auto-complete")
    return { ok: false, status: 502, code: "UNKNOWN", message: "The co-founder's draft came back unreadable. You can retry — no credits were kept." }
  }

  const validated = validatePlanSectionValue(section, parsed.value)
  if (!validated.ok) {
    await refundCollaboration(userId, projectId, "auto-complete")
    return { ok: false, status: 422, code: "VALIDATION", message: validated.error }
  }

  const nextSpec = applySectionUpdate(spec, section as PlanSectionId, validated.value)
  const reparsed = ApplicationSpecificationSchema.safeParse(nextSpec)
  if (!reparsed.success) {
    await refundCollaboration(userId, projectId, "auto-complete")
    return { ok: false, status: 422, code: "VALIDATION", message: "The draft was invalid for this section. No credits were kept." }
  }

  const decisionNote = `Auto-completed ${def.label}: ${validated.value.slice(0, 200)}`
  const patch: Record<string, unknown> = {
    specification: reparsed.data,
    specSanitized: false,
    planUpdateNotes: [...(project.planUpdateNotes ?? []), decisionNote].slice(-50),
  }
  if (project.planAnalysis) {
    const health = computePlanHealth(reparsed.data)
    patch.planAnalysis = {
      ...project.planAnalysis,
      healthPercent: health.percent,
      proposals: (project.planAnalysis.proposals ?? []).filter((p: PlanProposal) => p.section !== section),
      findings: (project.planAnalysis.findings ?? []).filter((f: PlanFinding) => f.section !== section),
    }
  }

  await store.updateProject(projectId, patch)
  await store.appendEvent(projectId, event("plan", `🤖 Co-founder drafted ${def.label}`))

  const remaining = missingSectionIds(reparsed.data)
  return {
    ok: true,
    data: {
      section,
      label: def.label,
      value: validated.value,
      remainingSections: remaining.map((sid) => ({ id: sid, label: getPlanSection(sid)?.label ?? sid })),
    },
  }
}
