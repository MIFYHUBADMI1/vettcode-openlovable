/**
 * Research Stage Schemas
 * ----------------------
 * Type definitions for the adaptive research phase of the planning pipeline.
 * This module re-exports research finding types from lib/types.
 * 
 * The research stage analyzes understanding objects to identify:
 * - Product completeness gaps (missing features, incomplete flows)
 * - Security concerns (authentication, authorization, validation)
 * - UX gaps (error states, loading states, empty states)
 * - Technical risks (stack violations, integration conflicts)
 * 
 * (Requirements 2.1-2.8, 16.1-16.8)
 */

// Re-export ResearchFindings types
export {
  SeverityLevelSchema,
  type SeverityLevel,
  ProductGapSchema,
  type ProductGap,
  SecurityGapSchema,
  type SecurityGap,
  UXGapSchema,
  type UXGap,
  TechnicalRiskSchema,
  type TechnicalRisk,
  RecommendationSchema,
  type Recommendation,
  ResearchFindingsSchema,
  type ResearchFindings,
  calculateCompletenessScore,
} from "@/lib/types/research-findings"

/**
 * Empty Research Findings
 * -----------------------
 * Default empty findings used when research stage fails or is skipped.
 */
export function getEmptyFindings(analyzedType: "idea" | "website", modelUsed: string): import("@/lib/types/research-findings").ResearchFindings {
  return {
    missingFeatures: [],
    securityConcerns: [],
    uxGaps: [],
    technicalRisks: [],
    recommendations: [],
    completenessScore: 100, // Optimistic score when no analysis performed
    analyzedType,
    createdAt: Date.now(),
    modelUsed,
  }
}

/**
 * Merge multiple research findings
 * ---------------------------------
 * Combines multiple research passes without duplication.
 */
export function mergeResearchFindings(
  findings: import("@/lib/types/research-findings").ResearchFindings[]
): import("@/lib/types/research-findings").ResearchFindings {
  if (findings.length === 0) {
    throw new Error("Cannot merge empty findings array")
  }
  
  if (findings.length === 1) {
    return findings[0]
  }
  
  const merged: import("@/lib/types/research-findings").ResearchFindings = {
    missingFeatures: [],
    securityConcerns: [],
    uxGaps: [],
    technicalRisks: [],
    recommendations: [],
    completenessScore: 100,
    analyzedType: findings[0].analyzedType,
    createdAt: Date.now(),
    modelUsed: findings.map(f => f.modelUsed).join(", "),
  }
  
  // Collect all unique gaps and concerns
  const seenDescriptions = new Set<string>()
  
  for (const finding of findings) {
    // Merge missing features
    for (const feature of finding.missingFeatures) {
      if (!seenDescriptions.has(feature.description)) {
        merged.missingFeatures.push(feature)
        seenDescriptions.add(feature.description)
      }
    }
    
    // Merge security concerns
    for (const concern of finding.securityConcerns) {
      if (!seenDescriptions.has(concern.description)) {
        merged.securityConcerns.push(concern)
        seenDescriptions.add(concern.description)
      }
    }
    
    // Merge UX gaps
    for (const gap of finding.uxGaps) {
      if (!seenDescriptions.has(gap.description)) {
        merged.uxGaps.push(gap)
        seenDescriptions.add(gap.description)
      }
    }
    
    // Merge technical risks
    for (const risk of finding.technicalRisks) {
      if (!seenDescriptions.has(risk.description)) {
        merged.technicalRisks.push(risk)
        seenDescriptions.add(risk.description)
      }
    }
    
    // Merge recommendations
    for (const rec of finding.recommendations) {
      if (!seenDescriptions.has(rec.action)) {
        merged.recommendations.push(rec)
        seenDescriptions.add(rec.action)
      }
    }
  }
  
  // Recalculate completeness score
  const { calculateCompletenessScore } = require("@/lib/types/research-findings")
  merged.completenessScore = calculateCompletenessScore(merged)
  
  return merged
}

/**
 * Filter findings by severity
 * ---------------------------
 * Returns only findings matching the specified severity level.
 */
export function filterBySeverity(
  findings: import("@/lib/types/research-findings").ResearchFindings,
  severity: import("@/lib/types/research-findings").SeverityLevel
): Partial<import("@/lib/types/research-findings").ResearchFindings> {
  return {
    missingFeatures: findings.missingFeatures.filter(f => f.severity === severity),
    securityConcerns: findings.securityConcerns.filter(s => s.severity === severity),
    uxGaps: findings.uxGaps.filter(u => u.severity === severity),
    technicalRisks: findings.technicalRisks.filter(t => t.severity === severity),
  }
}

/**
 * Get critical issues count
 * -------------------------
 * Returns the total number of critical issues across all categories.
 */
export function getCriticalIssuesCount(findings: import("@/lib/types/research-findings").ResearchFindings): number {
  const critical = filterBySeverity(findings, "critical")
  return (
    (critical.missingFeatures?.length || 0) +
    (critical.securityConcerns?.length || 0) +
    (critical.uxGaps?.length || 0) +
    (critical.technicalRisks?.length || 0)
  )
}

/**
 * Check if findings indicate security concerns
 * --------------------------------------------
 * Returns true if any security concerns are present.
 */
export function hasSecurityConcerns(findings: import("@/lib/types/research-findings").ResearchFindings): boolean {
  return findings.securityConcerns.length > 0
}

/**
 * Check if findings indicate technology stack violations
 * ------------------------------------------------------
 * Returns true if any stack violations are detected.
 */
export function hasStackViolations(findings: import("@/lib/types/research-findings").ResearchFindings): boolean {
  return findings.technicalRisks.some(risk => risk.category === "stack_violation")
}
