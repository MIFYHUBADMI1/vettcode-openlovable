import { z } from "zod"

/**
 * ResearchFindings
 * ----------------
 * Output of the adaptive research phase that identifies product completeness
 * gaps, security concerns, UX gaps, and technical risks in an Understanding
 * object (Requirements 16.1-16.8).
 */

export const SeverityLevelSchema = z.enum(["critical", "warning", "info"])
export type SeverityLevel = z.infer<typeof SeverityLevelSchema>

export const ProductGapSchema = z.object({
  category: z.enum(["missing_feature", "incomplete_flow", "undefined_state", "edge_case", "missing_essential_page"]),
  description: z.string(),
  severity: SeverityLevelSchema,
  recommendation: z.string(),
  affectedAreas: z.array(z.string()).default([]),
  pageType: z.enum(["admin", "user", "ecommerce", "social", "data"]).optional(),
  totalumFeature: z.enum(["Email", "PDF", "AI images", "ChatGPT", "Auth", "Doc scan", "Speech", "Video", "Scraping", "Database", "Hosting", "Domains", "Storage", "Stripe", "Custom email"]).optional(),
})
export type ProductGap = z.infer<typeof ProductGapSchema>

export const SecurityGapSchema = z.object({
  category: z.enum(["authentication", "authorization", "data_validation", "injection_risk"]),
  description: z.string(),
  severity: SeverityLevelSchema,
  recommendation: z.string(),
  affectedFeatures: z.array(z.string()).default([]),
  totalumFeature: z.enum(["Auth"]).optional(),
})
export type SecurityGap = z.infer<typeof SecurityGapSchema>

export const UXGapSchema = z.object({
  category: z.enum(["error_handling", "loading_state", "empty_state", "navigation", "feedback"]),
  description: z.string(),
  severity: SeverityLevelSchema,
  recommendation: z.string(),
  affectedFlows: z.array(z.string()).default([]),
  totalumFeature: z.enum(["Email", "Storage"]).optional(),
})
export type UXGap = z.infer<typeof UXGapSchema>

export const TechnicalRiskSchema = z.object({
  category: z.enum(["stack_violation", "integration_conflict", "scalability", "performance"]),
  description: z.string(),
  severity: SeverityLevelSchema,
  mitigation: z.string().optional().default("No mitigation specified"),
})
export type TechnicalRisk = z.infer<typeof TechnicalRiskSchema>

export const RecommendationSchema = z.object({
  priority: z.enum(["high", "medium", "low"]),
  action: z.string(),
  rationale: z.string(),
  totalumFeature: z.string().optional(),
})
export type Recommendation = z.infer<typeof RecommendationSchema>

export const ResearchFindingsSchema = z.object({
  missingFeatures: z.array(ProductGapSchema).default([]),
  securityConcerns: z.array(SecurityGapSchema).default([]),
  uxGaps: z.array(UXGapSchema).default([]),
  technicalRisks: z.array(TechnicalRiskSchema).default([]),

  recommendations: z.array(RecommendationSchema).default([]),

  completenessScore: z.number().min(0).max(100),

  // Metadata
  analyzedType: z.enum(["idea", "website"]),
  createdAt: z.number(),
  modelUsed: z.string(),
})
export type ResearchFindings = z.infer<typeof ResearchFindingsSchema>

/**
 * Calculate completeness score based on the severity and count of identified gaps.
 * Start at 100 and deduct points for each issue based on severity.
 */
export function calculateCompletenessScore(findings: ResearchFindings): number {
  let score = 100

  // Deduct for critical issues
  score -= (findings.missingFeatures ?? []).filter(f => f.severity === "critical").length * 15
  score -= (findings.securityConcerns ?? []).filter(s => s.severity === "critical").length * 20
  score -= (findings.uxGaps ?? []).filter(u => u.severity === "critical").length * 10
  score -= (findings.technicalRisks ?? []).filter(t => t.severity === "critical").length * 15

  // Deduct for warnings
  score -= (findings.missingFeatures ?? []).filter(f => f.severity === "warning").length * 5
  score -= (findings.securityConcerns ?? []).filter(s => s.severity === "warning").length * 7
  score -= (findings.uxGaps ?? []).filter(u => u.severity === "warning").length * 3

  return Math.max(0, score)
}
