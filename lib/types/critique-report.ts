import { z } from "zod"

/**
 * CritiqueReport
 * --------------
 * Output of the Independent Critic that validates an ApplicationSpecification
 * for consistency, completeness, and correctness without modifying it.
 * (Requirements 17.1-17.8).
 */

export const IssueTypeSchema = z.enum([
  "missing_definition",
  "inconsistent_reference",
  "circular_dependency",
  "stack_violation",
  "role_mismatch",
  "auth_inconsistency",
])
export type IssueType = z.infer<typeof IssueTypeSchema>

export const IssueSeveritySchema = z.enum(["critical", "warning", "info"])
export type IssueSeverity = z.infer<typeof IssueSeveritySchema>

export const IssueSchema = z.object({
  fieldPath: z.string(), // JSONPath format: "$.dataEntities[2].name"
  issueType: IssueTypeSchema,
  severity: IssueSeveritySchema,
  description: z.string(),
  recommendation: z.string(),
  currentValue: z.string().optional(),
  suggestedValue: z.string().optional(),
})
export type Issue = z.infer<typeof IssueSchema>

export const CritiqueReportSchema = z.object({
  criticalIssues: z.array(IssueSchema).default([]),
  warnings: z.array(IssueSchema).default([]),
  suggestions: z.array(IssueSchema).default([]),

  overallAssessment: z.string(),
  passesValidation: z.boolean(),

  // Quality metrics
  qualityScore: z.number().min(0).max(100),

  // Metadata
  createdAt: z.number(),
  modelUsed: z.string(),
})
export type CritiqueReport = z.infer<typeof CritiqueReportSchema>

/**
 * Calculate quality score based on the number and severity of identified issues.
 * Start at 100 and deduct points for each issue.
 */
export function calculateQualityScore(report: CritiqueReport): number {
  let score = 100

  score -= (report.criticalIssues?.length ?? 0) * 20
  score -= (report.warnings?.length ?? 0) * 5
  score -= (report.suggestions?.length ?? 0) * 1

  return Math.max(0, Math.min(100, score))
}
