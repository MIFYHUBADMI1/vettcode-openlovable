import { z } from "zod"

/**
 * ApplicationSpecification
 * ------------------------
 * Describes what the analyzed website (or scratch idea) is expected to become
 * as a working full-stack application. This is an AI-generated interpretation
 * that the user can review and edit before a build is launched (spec 6, 14, 15).
 */

/** Null-tolerant optional text: legacy AI generations sometimes stored null
 * instead of omitting the field. Accepting and normalizing null → undefined
 * here keeps every full-spec reparse (section updates, builds) working for
 * old documents instead of 422-ing all plan edits. */
const optionalText = z.string().nullish().transform((v) => v ?? undefined)

export const SuggestedFeatureSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: optionalText,
  enabled: z.boolean().default(false),
})
export type SuggestedFeature = z.infer<typeof SuggestedFeatureSchema>

export const SpecDataEntitySchema = z.object({
  name: z.string(),
  description: optionalText,
  fields: z.array(z.string()).default([]),
})
export type SpecDataEntity = z.infer<typeof SpecDataEntitySchema>

export const CoreFlowSchema = z.object({
  name: z.string(),
  description: optionalText,
})
export type CoreFlow = z.infer<typeof CoreFlowSchema>

export const ApplicationSpecificationSchema = z.object({
  applicationType: z.string(),
  title: z.string(),
  description: z.string(),
  purpose: z.string(),
  // ── Business-plan layer (Collaborate workspace, atai-pivot spec) ──
  // All optional with defaults so pre-existing specs validate unchanged.
  vision: z.string().optional(),
  problem: z.string().optional(),
  solution: z.string().optional(),
  valueProposition: z.string().optional(),
  businessModel: z.string().optional(),
  revenueModel: z.string().optional(),
  /** Atai Runtime capabilities the generated app will consume (@atai/sdk) —
   * planned in the Collaborate workspace, honored by the build prompt. */
  runtimeIntegrations: z.string().optional(),
  /** SEO & search-engine plan for the generated application — drafted in the
   * Collaborate workspace, carried verbatim into the build prompt. Covers
   * metadata, sitemap/robots, structured data, and site-verification tags. */
  seoPlan: z.string().optional(),
  marketPositioning: z.string().optional(),
  marketingPlan: z.string().optional(),
  launchPlan: z.string().optional(),
  growthPlan: z.string().optional(),
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
  complexity: z.enum(["simple", "medium", "complex"]).optional(),
})
export type ApplicationSpecification = z.infer<typeof ApplicationSpecificationSchema>

/** Business-plan fields displayed as plan sections in the Collaborate
 * workspace. Optional — older projects may not have them yet. */
export const BUSINESS_PLAN_FIELDS = [
  "vision",
  "problem",
  "solution",
  "valueProposition",
  "businessModel",
  "revenueModel",
  "runtimeIntegrations",
  "seoPlan",
  "marketPositioning",
  "marketingPlan",
  "launchPlan",
  "growthPlan",
] as const
export type BusinessPlanField = (typeof BUSINESS_PLAN_FIELDS)[number]

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
