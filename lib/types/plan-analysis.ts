import { z } from "zod"

/**
 * Structured AI-analysis types for the Collaborate workspace.
 *
 * Zod schemas because the ANALYSIS response comes from the AI and is
 * validated server-side before anything is stored or rendered (spec
 * sections 17 & 31). Findings feed the insights panel; proposals never
 * touch the plan until the user approves them.
 */

export const PlanFindingSchema = z.object({
  section: z.string(), // plan section id — re-validated against PLAN_SECTIONS at render time
  severity: z.enum(["gap", "weakness", "strength"]),
  title: z.string(),
  currentState: z.string(),
  why: z.string(),
  recommendation: z.string(),
})
export type PlanFinding = z.infer<typeof PlanFindingSchema>

export const PlanProposalSchema = z.object({
  id: z.string(),
  section: z.string(),
  currentValue: z.string(),
  proposedValue: z.string(),
  reason: z.string(),
  /** How the proposal entered the system: from chat or from analysis. */
  source: z.enum(["chat", "analysis"]).default("chat"),
  /** ISO timestamp — used for freshness display. */
  createdAt: z.string(),
})
export type PlanProposal = z.infer<typeof PlanProposalSchema>

export const PlanAnalysisSchema = z.object({
  generatedAt: z.number(),
  /** Deterministic snapshot of section statuses at generation time. */
  healthPercent: z.number().min(0).max(100),
  summary: z.string(),
  findings: z.array(PlanFindingSchema).default([]),
  proposals: z.array(PlanProposalSchema).default([]),
  /** Model-independent advice on what to do next, derived from findings. */
  nextBestAction: z
    .object({
      section: z.string(),
      title: z.string(),
      why: z.string(),
    })
    .optional(),
  /** Cost accounting for display next to cached analyses. */
  creditsCharged: z.number().optional(),
})
export type PlanAnalysis = z.infer<typeof PlanAnalysisSchema>

/** Coarse dependency hints between plan sections (spec section 11). These
 * are static product knowledge, not AI guesses — when the user accepts a
 * change to one section, related sections are surfaced for review. */
export const SECTION_DEPENDENCIES: Record<string, string[]> = {
  targetUsers: ["valueProposition", "marketPositioning", "features"],
  valueProposition: ["marketPositioning", "targetUsers"],
  marketPositioning: ["valueProposition", "targetUsers"],
  businessModel: ["revenueModel", "marketPositioning"],
  revenueModel: ["businessModel", "marketPositioning"],
  problem: ["solution", "valueProposition"],
  solution: ["features", "flows"],
  overview: ["vision", "targetUsers"],
  features: ["flows", "data"],
  flows: ["data", "features"],
  data: ["features"],
  seo: ["targetUsers", "valueProposition", "marketPositioning"],
}
