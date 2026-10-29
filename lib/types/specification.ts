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
  /** Short statement of what the app does.
   * @deprecated Read through readCombinedFoundation; new drafts store the
   * whole foundation in `vision`. Still required so older plans validate. */
  purpose: z.string(),
  // ── Business-plan layer (Collaborate workspace, atai-pivot spec) ──
  // All optional with defaults so pre-existing specs validate unchanged.
  /** Combined foundation — vision, purpose, problem and solution in one
   * document. The purpose/problem/solution fields are legacy copies. */
  vision: z.string().optional(),
  /** @deprecated Legacy section. See purpose. */
  problem: z.string().optional(),
  /** @deprecated Legacy section. See purpose. */
  solution: z.string().optional(),
  valueProposition: z.string().optional(),
  businessModel: z.string().optional(),
  revenueModel: z.string().optional(),
  /** Product-facing plans, prices, limits, and upgrade paths — carried into the build. */
  pricingTiers: z.string().optional(),
  /** Comprehensive pricing structure with detailed tier breakdown */
  pricingStructure: z.string().optional(),
  /** Brand colors, logo guidance, and visual personality.
   * @deprecated Legacy field from when brand identity was a separate section.
   * Still stored so older plans validate; read through readCombinedDesignDirection. */
  brandIdentity: z.string().optional(),
  /** Theme selection, dark mode strategy, and UI style preferences.
   * @deprecated Legacy field from when theme & appearance was a separate section.
   * See brandIdentity. */
  themePreferences: z.string().optional(),
  /** Visual system: theme, color tokens, density, light/dark — carried into the build.
   * @deprecated Legacy field from when the visual system was a separate section.
   * See brandIdentity. */
  appearance: z.string().optional(),
  /** Heading, body, and mono fonts the generated app must use.
   * @deprecated Legacy field from when typography was a separate section.
   * See brandIdentity. */
  typography: z.string().optional(),
  /** Atai Runtime capabilities the generated app will consume (@atai-group/sdk) —
   * planned in the Collaborate workspace, honored by the build prompt. */
  runtimeIntegrations: z.string().optional(),
  /** SEO & search-engine plan for the generated application — drafted in the
   * Collaborate workspace, carried verbatim into the build prompt. Covers
   * metadata, sitemap/robots, structured data, and site-verification tags. */
  seoPlan: z.string().optional(),
  marketPositioning: z.string().optional(),
  /** Combined go-to-market plan — marketing, launch and growth in one document. */
  marketingPlan: z.string().optional(),
  /** @deprecated Legacy fields from when launch/growth were separate sections.
   * Still stored so older plans validate; read through readCombinedMarketingPlan. */
  launchPlan: z.string().optional(),
  /** @deprecated See launchPlan. */
  growthPlan: z.string().optional(),
  targetUsers: z.array(z.string()).default([]),
  userRoles: z.array(z.string()).default([]),
  coreFlows: z.array(CoreFlowSchema).default([]),
  suggestedFeatures: z.array(SuggestedFeatureSchema).default([]),
  dataEntities: z.array(SpecDataEntitySchema).default([]),
  authenticationRequirements: z.string().optional(),
  backendRequirements: z.array(z.string()).default([]),
  integrations: z.array(z.string()).default([]),
  /** Combined design direction — brand identity, visual system, typography,
   * theme and responsive behaviour in one document. */
  designDirection: z.string().optional(),
  /** @deprecated Legacy field from when responsive behaviour was a separate
   * section. Still stored so older plans validate; read through
   * readCombinedDesignDirection. */
  responsiveRequirements: z.string().optional(),
  additionalInstructions: z.string().default(""),
  complexity: z.enum(["simple", "medium", "complex"]).optional(),
})
export type ApplicationSpecification = z.infer<typeof ApplicationSpecificationSchema>

/** Business-plan fields displayed as plan sections in the Collaborate
 * workspace. Optional — older projects may not have them yet. */
export const BUSINESS_PLAN_FIELDS = [
  "vision",
  "valueProposition",
  "businessModel",
  "revenueModel",
  "pricingTiers",
  "runtimeIntegrations",
  "seoPlan",
  "marketPositioning",
  "marketingPlan",
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
