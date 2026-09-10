import { z } from "zod"

/**
 * IdeaUnderstanding
 * -----------------
 * A structured representation of a user's raw idea, distinguishing between
 * explicit user statements and AI inferences. This serves as the input to
 * the research and planning stages (Requirements 15.1-15.8).
 */

export const ConfidenceLevelSchema = z.enum(["explicit", "inferred"])
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>

export const IdeaDataEntitySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  fields: z.array(z.string()).default([]),
  confidence: ConfidenceLevelSchema,
})
export type IdeaDataEntity = z.infer<typeof IdeaDataEntitySchema>

export const IdeaUserFlowSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  steps: z.array(z.string()),
  confidence: ConfidenceLevelSchema,
})
export type IdeaUserFlow = z.infer<typeof IdeaUserFlowSchema>

export const IdeaCoreFeatureSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  confidence: ConfidenceLevelSchema,
})
export type IdeaCoreFeature = z.infer<typeof IdeaCoreFeatureSchema>

export const IdeaTechnicalRequirementSchema = z.object({
  category: z.string(), // e.g., "authentication", "data storage", "integrations"
  requirement: z.string(),
  confidence: ConfidenceLevelSchema,
})
export type IdeaTechnicalRequirement = z.infer<typeof IdeaTechnicalRequirementSchema>

export const IdeaAuthenticationNeedsSchema = z.object({
  required: z.boolean(),
  description: z.string().optional(),
  suggestedProviders: z.array(z.string()).default([]),
})
export type IdeaAuthenticationNeeds = z.infer<typeof IdeaAuthenticationNeedsSchema>

export const IdeaSuggestedFeatureSchema = z.object({
  key: z.string(),
  reason: z.string(),
})
export type IdeaSuggestedFeature = z.infer<typeof IdeaSuggestedFeatureSchema>

export const IdeaUnderstandingSchema = z.object({
  purpose: z.string(),
  description: z.string(),
  targetUsers: z.array(z.string()).default([]),
  userRoles: z.array(z.string()).default([]),
  
  coreFeatures: z.array(IdeaCoreFeatureSchema).default([]),
  
  dataEntities: z.array(IdeaDataEntitySchema).default([]),
  
  userFlows: z.array(IdeaUserFlowSchema).default([]),
  
  technicalRequirements: z.array(IdeaTechnicalRequirementSchema).default([]),
  
  authenticationNeeds: IdeaAuthenticationNeedsSchema.optional(),
  
  suggestedFeatures: z.array(IdeaSuggestedFeatureSchema).default([]),
  
  // Metadata
  createdAt: z.number(),
  modelUsed: z.string(),
})
export type IdeaUnderstanding = z.infer<typeof IdeaUnderstandingSchema>
