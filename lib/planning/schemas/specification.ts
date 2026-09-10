/**
 * Specification Stage Schemas
 * ---------------------------
 * Type definitions for application specifications produced by the planning stage.
 * This module re-exports specification types from lib/types.
 * 
 * The ApplicationSpecification is the canonical output of the planning pipeline,
 * consumed by the Totalum builder to generate full-stack applications.
 * 
 * (Requirements 3.1-3.8, 9.1-9.8, 10.1-10.8)
 */

// Re-export ApplicationSpecification types
export {
  SuggestedFeatureSchema,
  type SuggestedFeature,
  SpecDataEntitySchema,
  type SpecDataEntity,
  CoreFlowSchema,
  type CoreFlow,
  ApplicationSpecificationSchema,
  type ApplicationSpecification,
  DEFAULT_FEATURES,
} from "@/lib/types/specification"

/**
 * Planning Input
 * --------------
 * Combined input for the primary planner stage.
 */
export interface PlanningInput {
  understanding: import("@/lib/planning/schemas/understanding").UnderstandingBase
  research: import("@/lib/types/research-findings").ResearchFindings
}

/**
 * Planning Context
 * ----------------
 * Merged context constructed from understanding and research for planning.
 */
export interface PlanningContext {
  // From Understanding
  purpose: string
  targetUsers: string[]
  userRoles: string[]
  coreFeatures: string[]
  dataEntities: Array<{
    name: string
    fields: string[]
    description?: string
  }>

  // From Research
  missingFeatures: string[]
  securityRequirements: string[]
  uxConsiderations: string[]

  // Stack constraints
  allowedTechnologies: typeof import("./core-types").TOTALUM_STACK
}

/**
 * Build planning context from understanding and research
 * ------------------------------------------------------
 * Merges understanding and research findings into a unified planning context.
 */
export function buildPlanningContext(
  understanding: import("@/lib/planning/schemas/understanding").UnderstandingBase,
  research: import("@/lib/types/research-findings").ResearchFindings
): PlanningContext {
  const { extractCommonFields } = require("@/lib/planning/schemas/understanding")
  const { TOTALUM_STACK } = require("./core-types")
  const common = extractCommonFields(understanding)

  // Extract core features from understanding
  const coreFeatures: string[] = []
  if ("coreFeatures" in understanding) {
    // IdeaUnderstanding
    coreFeatures.push(...understanding.coreFeatures.map((f: { name: string }) => f.name))
  } else {
    // ProjectUnderstanding
    coreFeatures.push(...understanding.observedFunctionality)
    coreFeatures.push(...understanding.inferredFunctionality)
  }

  // Extract missing features from research
  const missingFeatures = research.missingFeatures.map(gap => gap.description)

  // Extract security requirements from research
  const securityRequirements = research.securityConcerns.map(concern => concern.description)

  // Extract UX considerations from research
  const uxConsiderations = research.uxGaps.map(gap => gap.description)

  return {
    purpose: common.purpose,
    targetUsers: common.targetUsers,
    userRoles: common.userRoles,
    coreFeatures,
    dataEntities: common.dataEntities,
    missingFeatures,
    securityRequirements,
    uxConsiderations,
    allowedTechnologies: TOTALUM_STACK,
  }
}

/**
 * Validate specification completeness
 * -----------------------------------
 * Checks if a specification has all required fields populated.
 */
export function validateSpecificationCompleteness(
  spec: import("@/lib/types/specification").ApplicationSpecification
): { complete: boolean; missingFields: string[] } {
  const missingFields: string[] = []

  if (!spec.title || spec.title.trim() === "") {
    missingFields.push("title")
  }

  if (!spec.description || spec.description.trim() === "") {
    missingFields.push("description")
  }

  if (!spec.purpose || spec.purpose.trim() === "") {
    missingFields.push("purpose")
  }

  if (spec.targetUsers.length === 0) {
    missingFields.push("targetUsers")
  }

  if (spec.dataEntities.length === 0) {
    missingFields.push("dataEntities")
  }

  if (spec.coreFlows.length === 0) {
    missingFields.push("coreFlows")
  }

  return {
    complete: missingFields.length === 0,
    missingFields,
  }
}

/**
 * Check if specification references authentication
 * ------------------------------------------------
 * Returns true if auth features are enabled or auth requirements exist.
 */
export function hasAuthenticationRequirements(
  spec: import("@/lib/types/specification").ApplicationSpecification
): boolean {
  const authFeatureEnabled = spec.suggestedFeatures.some(
    f => f.key === "auth" && f.enabled
  )

  const hasAuthRequirements =
    spec.authenticationRequirements !== undefined &&
    spec.authenticationRequirements.trim() !== ""

  return authFeatureEnabled || hasAuthRequirements
}

/**
 * Get enabled features
 * -------------------
 * Returns list of enabled feature keys from specification.
 */
export function getEnabledFeatures(
  spec: import("@/lib/types/specification").ApplicationSpecification
): string[] {
  return spec.suggestedFeatures
    .filter(f => f.enabled)
    .map(f => f.key)
}

/**
 * Count data entities
 * ------------------
 * Returns the total number of data entities in the specification.
 */
export function countDataEntities(
  spec: import("@/lib/types/specification").ApplicationSpecification
): number {
  return spec.dataEntities.length
}

/**
 * Count core flows
 * ---------------
 * Returns the total number of core flows in the specification.
 */
export function countCoreFlows(
  spec: import("@/lib/types/specification").ApplicationSpecification
): number {
  return spec.coreFlows.length
}

/**
 * Get specification complexity estimate
 * -------------------------------------
 * Estimates complexity based on entities, flows, and features.
 */
export function estimateComplexity(
  spec: import("@/lib/types/specification").ApplicationSpecification
): "simple" | "medium" | "complex" {
  const entityCount = countDataEntities(spec)
  const flowCount = countCoreFlows(spec)
  const enabledFeatureCount = getEnabledFeatures(spec).length

  const complexityScore = entityCount * 2 + flowCount * 1.5 + enabledFeatureCount * 1

  if (complexityScore < 10) return "simple"
  if (complexityScore < 25) return "medium"
  return "complex"
}
