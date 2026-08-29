import { z } from "zod"

/**
 * ProjectUnderstanding
 * ---------------------
 * A normalized, strongly-typed understanding of a website derived from
 * Firecrawl evidence. This is the canonical internal representation — it is
 * NEVER the raw Firecrawl response. Every field distinguishes what was
 * OBSERVED from what was INFERRED or SUGGESTED so we never present a guess
 * as a confirmed fact (spec sections 4 & 5).
 */

export const ConfidenceLevel = z.enum(["observed", "inferred", "suggested"])
export type ConfidenceLevel = z.infer<typeof ConfidenceLevel>

export const DesignSystemSchema = z.object({
  colors: z.array(z.string()).default([]),
  typography: z.array(z.string()).default([]),
  spacing: z.string().optional(),
  radius: z.string().optional(),
  visualLanguage: z.string().optional(),
  imageryStyle: z.string().optional(),
})
export type DesignSystem = z.infer<typeof DesignSystemSchema>

export const PageSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  role: z.string().optional(),
  summary: z.string().optional(),
  importance: z.enum(["primary", "secondary", "minor"]).default("secondary"),
})
export type Page = z.infer<typeof PageSchema>

export const ComponentSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  confidence: ConfidenceLevel.default("observed"),
})
export type UnderstandingComponent = z.infer<typeof ComponentSchema>

export const DataEntitySchema = z.object({
  name: z.string(),
  fields: z.array(z.string()).default([]),
  confidence: ConfidenceLevel.default("inferred"),
})
export type DataEntity = z.infer<typeof DataEntitySchema>

export const UserFlowSchema = z.object({
  name: z.string(),
  steps: z.array(z.string()).default([]),
  confidence: ConfidenceLevel.default("inferred"),
})
export type UserFlow = z.infer<typeof UserFlowSchema>

export const ProjectUnderstandingSchema = z.object({
  sourceUrl: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  applicationType: z.string().optional(),
  websiteCategory: z.string().optional(),
  purpose: z.string().optional(),
  targetUsers: z.array(z.string()).default([]),
  userRoles: z.array(z.string()).default([]),
  pages: z.array(PageSchema).default([]),
  navigation: z.array(z.string()).default([]),
  components: z.array(ComponentSchema).default([]),
  designSystem: DesignSystemSchema.default({ colors: [], typography: [] }),
  contentStructure: z.array(z.string()).default([]),
  assets: z.array(z.string()).default([]),
  interactions: z.array(z.string()).default([]),
  userFlows: z.array(UserFlowSchema).default([]),
  observedFunctionality: z.array(z.string()).default([]),
  inferredFunctionality: z.array(z.string()).default([]),
  suggestedFeatures: z.array(z.string()).default([]),
  dataEntities: z.array(DataEntitySchema).default([]),
  backendRequirements: z.array(z.string()).default([]),
  authenticationRequirements: z.array(z.string()).default([]),
  responsiveBehavior: z.string().optional(),
  screenshots: z.array(z.string()).default([]),
  rawEvidenceReferences: z.array(z.string()).default([]),
  confidenceNotes: z.string().optional(),
})
export type ProjectUnderstanding = z.infer<typeof ProjectUnderstandingSchema>

/** The AI-generation schema is a subset — evidence references and screenshots
 * are attached by our pipeline, not invented by the model. */
export const UnderstandingGenerationSchema = ProjectUnderstandingSchema.omit({
  sourceUrl: true,
  screenshots: true,
  rawEvidenceReferences: true,
})
export type UnderstandingGeneration = z.infer<typeof UnderstandingGenerationSchema>
