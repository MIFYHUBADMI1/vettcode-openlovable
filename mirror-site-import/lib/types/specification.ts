import { z } from "zod"

/**
 * ApplicationSpecification
 * ------------------------
 * Describes what the analyzed website (or scratch idea) is expected to become
 * as a working full-stack application. This is an AI-generated interpretation
 * that the user can review and edit before a build is launched (spec 6, 14, 15).
 */

export const SuggestedFeatureSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string().optional(),
  enabled: z.boolean().default(false),
})
export type SuggestedFeature = z.infer<typeof SuggestedFeatureSchema>

export const SpecDataEntitySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  fields: z.array(z.string()).default([]),
})
export type SpecDataEntity = z.infer<typeof SpecDataEntitySchema>

export const CoreFlowSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
})
export type CoreFlow = z.infer<typeof CoreFlowSchema>

export const ApplicationSpecificationSchema = z.object({
  applicationType: z.string(),
  title: z.string(),
  description: z.string(),
  purpose: z.string(),
  targetUsers: z.array(z.string()).default([]),
  userRoles: z.array(z.string()).default([]),
  coreFlows: z.array(CoreFlowSchema).default([]),
  suggestedFeatures: z.array(SuggestedFeatureSchema).default([]),
  dataEntities: z.array(SpecDataEntitySchema).default([]),
  authenticationRequirements: z.string().optional(),
  backendRequirements: z.array(z.string()).default([]),
  integrations: z.array(z.string()).default([]),
  designDirection: z.string().optional(),
  responsiveRequirements: z.string().optional(),
  additionalInstructions: z.string().default(""),
})
export type ApplicationSpecification = z.infer<typeof ApplicationSpecificationSchema>

/** Default feature catalog shown as checkboxes in the plan editor. */
export const DEFAULT_FEATURES: SuggestedFeature[] = [
  { key: "auth", label: "Authentication", description: "User sign up, login, sessions", enabled: true },
  { key: "database", label: "Database", description: "Persistent data storage", enabled: true },
  { key: "dashboard", label: "Dashboard", description: "Primary user dashboard", enabled: true },
  { key: "api", label: "API", description: "Backend API endpoints", enabled: true },
  { key: "payments", label: "Payments", description: "Checkout and billing", enabled: false },
  { key: "admin", label: "Admin panel", description: "Administrative management UI", enabled: false },
  { key: "uploads", label: "File uploads", description: "Upload and manage files", enabled: false },
]
