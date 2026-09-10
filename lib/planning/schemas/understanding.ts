/**
 * Understanding Stage Schemas
 * ---------------------------
 * Type definitions for the understanding stage of the planning pipeline.
 * This module re-exports and extends understanding types from lib/types.
 * 
 * The understanding stage produces structured interpretations of user inputs:
 * - IdeaUnderstanding: For user-provided ideas (Idea Mode)
 * - ProjectUnderstanding: For analyzed websites (Website Mode)
 * 
 * Both understanding types serve as inputs to the research and planning stages.
 * (Requirements 1.1-1.8, 8.1-8.8, 15.1-15.8)
 */

// Re-export IdeaUnderstanding types
export {
  IdeaDataEntitySchema,
  type IdeaDataEntity,
  IdeaUserFlowSchema,
  type IdeaUserFlow,
  IdeaCoreFeatureSchema,
  type IdeaCoreFeature,
  IdeaTechnicalRequirementSchema,
  type IdeaTechnicalRequirement,
  IdeaAuthenticationNeedsSchema,
  type IdeaAuthenticationNeeds,
  IdeaSuggestedFeatureSchema,
  type IdeaSuggestedFeature,
  IdeaUnderstandingSchema,
  type IdeaUnderstanding,
} from "@/lib/types/idea-understanding"

// Re-export ProjectUnderstanding types
export {
  ConfidenceLevel as WebsiteConfidenceLevel,
  DesignSystemSchema,
  type DesignSystem,
  PageSchema,
  type Page,
  ComponentSchema,
  type UnderstandingComponent,
  DataEntitySchema as WebsiteDataEntitySchema,
  type DataEntity as WebsiteDataEntity,
  UserFlowSchema as WebsiteUserFlowSchema,
  type UserFlow as WebsiteUserFlow,
  ProjectUnderstandingSchema,
  type ProjectUnderstanding,
  UnderstandingGenerationSchema,
  type UnderstandingGeneration,
} from "@/lib/types/understanding"

/**
 * Union type for all understanding objects
 */
export type UnderstandingBase = import("@/lib/types/idea-understanding").IdeaUnderstanding | import("@/lib/types/understanding").ProjectUnderstanding

/**
 * Type guard to check if understanding is IdeaUnderstanding
 */
export function isIdeaUnderstanding(understanding: UnderstandingBase): understanding is import("@/lib/types/idea-understanding").IdeaUnderstanding {
  return "coreFeatures" in understanding && "suggestedFeatures" in understanding
}

/**
 * Type guard to check if understanding is ProjectUnderstanding
 */
export function isProjectUnderstanding(understanding: UnderstandingBase): understanding is import("@/lib/types/understanding").ProjectUnderstanding {
  return "sourceUrl" in understanding && "pages" in understanding
}

/**
 * Extract common fields from any understanding type
 */
export function extractCommonFields(understanding: UnderstandingBase) {
  if (isIdeaUnderstanding(understanding)) {
    return {
      purpose: understanding.purpose,
      description: understanding.description,
      targetUsers: understanding.targetUsers,
      userRoles: understanding.userRoles,
      dataEntities: understanding.dataEntities.map(e => ({
        name: e.name,
        fields: e.fields,
        description: e.description,
      })),
      userFlows: understanding.userFlows.map(f => ({
        name: f.name,
        steps: f.steps,
        description: f.description,
      })),
    }
  } else {
    return {
      purpose: understanding.purpose || "",
      description: understanding.description || "",
      targetUsers: understanding.targetUsers,
      userRoles: understanding.userRoles,
      dataEntities: understanding.dataEntities.map(e => ({
        name: e.name,
        fields: e.fields,
        description: undefined,
      })),
      userFlows: understanding.userFlows.map(f => ({
        name: f.name,
        steps: f.steps,
        description: undefined,
      })),
    }
  }
}

/**
 * Get type indicator for understanding object
 */
export function getUnderstandingType(understanding: UnderstandingBase): "idea" | "website" {
  return isIdeaUnderstanding(understanding) ? "idea" : "website"
}
