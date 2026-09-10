/**
 * Critique Stage Schemas
 * ----------------------
 * Type definitions for the independent critique validation stage.
 * This module re-exports critique report types from lib/types.
 * 
 * The critique stage validates ApplicationSpecifications for:
 * - Consistency (no contradictory requirements)
 * - Completeness (all references are defined)
 * - Correctness (technology stack compliance)
 * 
 * (Requirements 4.1-4.8, 17.1-17.8)
 */

// Re-export CritiqueReport types
export {
  IssueTypeSchema,
  type IssueType,
  IssueSeveritySchema,
  type IssueSeverity,
  IssueSchema,
  type Issue,
  CritiqueReportSchema,
  type CritiqueReport,
  calculateQualityScore,
} from "@/lib/types/critique-report"

/**
 * Check if critique passes validation
 * -----------------------------------
 * Returns true if no critical issues are present.
 */
export function passesValidation(report: import("@/lib/types/critique-report").CritiqueReport): boolean {
  return report.criticalIssues.length === 0
}

/**
 * Get all issues (critical + warnings + suggestions)
 * -------------------------------------------------
 * Returns flattened array of all issues.
 */
export function getAllIssues(report: import("@/lib/types/critique-report").CritiqueReport): import("@/lib/types/critique-report").Issue[] {
  return [
    ...report.criticalIssues,
    ...report.warnings,
    ...report.suggestions,
  ]
}

/**
 * Filter issues by type
 * --------------------
 * Returns only issues matching the specified issue type.
 */
export function filterIssuesByType(
  report: import("@/lib/types/critique-report").CritiqueReport,
  issueType: import("@/lib/types/critique-report").IssueType
): import("@/lib/types/critique-report").Issue[] {
  return getAllIssues(report).filter(issue => issue.issueType === issueType)
}

/**
 * Filter issues by severity
 * ------------------------
 * Returns only issues matching the specified severity level.
 */
export function filterIssuesBySeverity(
  report: import("@/lib/types/critique-report").CritiqueReport,
  severity: import("@/lib/types/critique-report").IssueSeverity
): import("@/lib/types/critique-report").Issue[] {
  if (severity === "critical") return report.criticalIssues
  if (severity === "warning") return report.warnings
  if (severity === "info") return report.suggestions
  return []
}

/**
 * Get issues requiring repair
 * --------------------------
 * Returns critical issues and warnings that should be addressed by repair service.
 */
export function getRepairableIssues(report: import("@/lib/types/critique-report").CritiqueReport): import("@/lib/types/critique-report").Issue[] {
  return [...report.criticalIssues, ...report.warnings]
}

/**
 * Check if report has stack violations
 * ------------------------------------
 * Returns true if any issues are stack_violation type.
 */
export function hasStackViolations(report: import("@/lib/types/critique-report").CritiqueReport): boolean {
  return getAllIssues(report).some(issue => issue.issueType === "stack_violation")
}

/**
 * Check if report has auth inconsistencies
 * ----------------------------------------
 * Returns true if any issues are auth_inconsistency type.
 */
export function hasAuthInconsistencies(report: import("@/lib/types/critique-report").CritiqueReport): boolean {
  return getAllIssues(report).some(issue => issue.issueType === "auth_inconsistency")
}

/**
 * Check if report has missing definitions
 * ---------------------------------------
 * Returns true if any issues are missing_definition type.
 */
export function hasMissingDefinitions(report: import("@/lib/types/critique-report").CritiqueReport): boolean {
  return getAllIssues(report).some(issue => issue.issueType === "missing_definition")
}

/**
 * Check if report has circular dependencies
 * -----------------------------------------
 * Returns true if any issues are circular_dependency type.
 */
export function hasCircularDependencies(report: import("@/lib/types/critique-report").CritiqueReport): boolean {
  return getAllIssues(report).some(issue => issue.issueType === "circular_dependency")
}

/**
 * Count issues by type
 * -------------------
 * Returns count of issues for each issue type.
 */
export function countIssuesByType(report: import("@/lib/types/critique-report").CritiqueReport): Record<import("@/lib/types/critique-report").IssueType, number> {
  const counts: Record<import("@/lib/types/critique-report").IssueType, number> = {
    missing_definition: 0,
    inconsistent_reference: 0,
    circular_dependency: 0,
    stack_violation: 0,
    role_mismatch: 0,
    auth_inconsistency: 0,
  }
  
  for (const issue of getAllIssues(report)) {
    counts[issue.issueType]++
  }
  
  return counts
}

/**
 * Count issues by severity
 * -----------------------
 * Returns count of issues for each severity level.
 */
export function countIssuesBySeverity(report: import("@/lib/types/critique-report").CritiqueReport): Record<import("@/lib/types/critique-report").IssueSeverity, number> {
  return {
    critical: report.criticalIssues.length,
    warning: report.warnings.length,
    info: report.suggestions.length,
  }
}

/**
 * Format issues for logging
 * ------------------------
 * Returns human-readable string representation of all issues.
 */
export function formatIssuesForLogging(report: import("@/lib/types/critique-report").CritiqueReport): string {
  const lines: string[] = []
  
  if (report.criticalIssues.length > 0) {
    lines.push("Critical Issues:")
    for (const issue of report.criticalIssues) {
      lines.push(`  - [${issue.issueType}] ${issue.fieldPath}: ${issue.description}`)
    }
  }
  
  if (report.warnings.length > 0) {
    lines.push("\nWarnings:")
    for (const issue of report.warnings) {
      lines.push(`  - [${issue.issueType}] ${issue.fieldPath}: ${issue.description}`)
    }
  }
  
  if (report.suggestions.length > 0) {
    lines.push("\nSuggestions:")
    for (const issue of report.suggestions) {
      lines.push(`  - [${issue.issueType}] ${issue.fieldPath}: ${issue.description}`)
    }
  }
  
  return lines.join("\n")
}
