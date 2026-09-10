/**
 * Planning Pipeline Schemas
 * -------------------------
 * Central export point for all planning pipeline type definitions and schemas.
 * 
 * This module provides comprehensive TypeScript type definitions for the
 * AI planning pipeline upgrade, including:
 * - Core types and interfaces
 * - Understanding stage schemas (IdeaUnderstanding, ProjectUnderstanding)
 * - Research stage schemas (ResearchFindings)
 * - Specification schemas (ApplicationSpecification)
 * - Critique stage schemas (CritiqueReport)
 * - Validation schemas and utilities
 * 
 * All schemas support round-trip serialization and are validated using Zod.
 * (Requirements 1.1-24.8, Design: Data Models section)
 */

// Core types and constants
export * from "./core-types"

// Understanding stage
export * from "./understanding"

// Research stage
// Note: SeverityLevel and SeverityLevelSchema are already exported from core-types
// Only export research-specific items, excluding duplicates
export {
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
  getEmptyFindings,
  mergeResearchFindings,
  filterBySeverity,
  getCriticalIssuesCount,
  hasSecurityConcerns,
  // hasStackViolations is not exported to avoid duplicate with research.ts internal function
} from "./research"

// Specification stage
export * from "./specification"

// Critique stage
export * from "./critique"

// Validation stage
export * from "./validation"

// Additional types not covered by the wildcard exports above
export type { PlanningRun } from "@/lib/types/planning-run"

// Re-export schema utilities
export {
  safeParse,
  extractAndParseJSON,
  testRoundTrip,
  formatZodErrors,
  type ParseResult,
} from "@/lib/types/schema-utils"
