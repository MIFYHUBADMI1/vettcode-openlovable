import type { ApplicationSpecification } from "@/lib/types/specification"
import type { BusinessPlanField } from "@/lib/types/specification"
import { isRuntimeIntegrationsGrounded } from "@/lib/analysis/runtime-capabilities"

/**
 * Canonical plan sections for the Collaborate workspace.
 *
 * Every visible section maps to a REAL field on `ApplicationSpecification`
 * (spec section 12: never invent sections that don't exist). Statuses are
 * deterministic — derived from field population — so the UI never fabricates
 * a score. "Needs work" is only ever added by AI findings, never guessed.
 *
 * Marketing, Launch and Growth are intentionally NOT plan sections: their
 * data still lives on the spec (marketingPlan/launchPlan/growthPlan) for
 * later use elsewhere, but they are drafted after the build, not by the
 * Collaborate workspace, and the AI doesn't need them to generate the app.
 */

export type PlanSectionId =
  | BusinessPlanField
  | "overview"
  | "targetUsers"
  | "features"
  | "flows"
  | "data"
  | "auth"
  | "seo"
  | "brandIdentity"
  | "themePreferences"

export type PlanSectionStatus = "missing" | "complete" | "needs_work"

export interface PlanSectionDef {
  id: PlanSectionId
  label: string
  /** Lucide icon name — rendered as a component by the client. */
  icon: string
  /** Group shown in the MY PLAN nav and PLAN STATUS insight panel. */
  group: "Foundation" | "Product" | "Business" | "Market"
  /** Short empty-state copy — the path forward, per spec section 43. */
  emptyHint: string
  /** Extract the current value for display. Empty string = missing. */
  read: (spec: ApplicationSpecification) => string
}

const s = (v: string | undefined | null): string => (v ?? "").trim()

export const PLAN_SECTIONS: PlanSectionDef[] = [
  {
    id: "overview",
    label: "Overview",
    icon: "Lightbulb",
    group: "Foundation",
    emptyHint: "Let's describe what this product is and who it's for.",
    read: (spec) => s(spec.description) || s(spec.purpose),
  },
  {
    id: "problem",
    label: "Problem",
    icon: "Puzzle",
    group: "Foundation",
    emptyHint: "Let's define the specific problem this business solves.",
    read: (spec) => s(spec.problem) || s(spec.purpose),
  },
  {
    id: "solution",
    label: "Solution",
    icon: "Wrench",
    group: "Foundation",
    emptyHint: "Let's describe how the product solves the problem.",
    read: (spec) => s(spec.solution) || s(spec.description),
  },
  {
    id: "vision",
    label: "Vision",
    icon: "Telescope",
    group: "Foundation",
    emptyHint: "Let's capture the long-term vision for this business.",
    read: (spec) => s(spec.vision),
  },
  {
    id: "targetUsers",
    label: "Target Customers",
    icon: "Users",
    group: "Market",
    emptyHint: "Let's define who this business is built for.",
    read: (spec) => spec.targetUsers.filter(Boolean).join(", "),
  },
  {
    id: "valueProposition",
    label: "Value Proposition",
    icon: "Star",
    group: "Market",
    emptyHint: "Let's articulate why customers would choose you.",
    read: (spec) => s(spec.valueProposition),
  },
  {
    id: "marketPositioning",
    label: "Market Positioning",
    icon: "Compass",
    group: "Market",
    emptyHint: "Let's position this product against the alternatives.",
    read: (spec) => s(spec.marketPositioning),
  },
  {
    id: "features",
    label: "Key Features",
    icon: "Zap",
    group: "Product",
    emptyHint: "Let's pick the capabilities the product needs.",
    read: (spec) =>
      spec.suggestedFeatures
        .filter((f) => f.enabled)
        .map((f) => f.label)
        .join(", "),
  },
  {
    id: "flows",
    label: "User Flows",
    icon: "GitBranch",
    group: "Product",
    emptyHint: "Let's map how users will actually use the product.",
    read: (spec) => spec.coreFlows.map((f) => f.name).filter(Boolean).join(", "),
  },
  {
    id: "data",
    label: "Data Model",
    icon: "Database",
    group: "Product",
    emptyHint: "Let's define the information the product manages.",
    read: (spec) => spec.dataEntities.map((e) => e.name).filter(Boolean).join(", "),
  },
  {
    id: "auth",
    label: "Accounts & Access",
    icon: "KeyRound",
    group: "Product",
    emptyHint: "Let's decide how people sign in and what they can do.",
    read: (spec) => s(spec.authenticationRequirements),
  },
  {
    id: "seo",
    label: "SEO & Search",
    icon: "Search",
    group: "Product",
    emptyHint: "Let's plan how your app gets discovered — search metadata, sitemap, and Google verification.",
    read: (spec) => s(spec.seoPlan),
  },
  {
    id: "businessModel",
    label: "Business Model",
    icon: "Briefcase",
    group: "Business",
    emptyHint: "Let's work out how the business creates and delivers value.",
    read: (spec) => s(spec.businessModel),
  },
  {
    id: "revenueModel",
    label: "Revenue Model",
    icon: "Coins",
    group: "Business",
    emptyHint: "Let's work out how the business makes money.",
    read: (spec) => s(spec.revenueModel),
  },
  {
    id: "runtimeIntegrations",
    label: "Runtime & Integrations",
    icon: "PlugZap",
    group: "Business",
    emptyHint: "Plan which Atai capabilities this app will call with ATAI_API_KEY — AI, email, payments, search, and more.",
    read: (spec) => s(spec.runtimeIntegrations),
  },
  {
    id: "pricingTiers",
    label: "Pricing & Tiers",
    icon: "DollarSign",
    group: "Business",
    emptyHint: "Let's define your pricing structure — tiers, features per tier, billing cycles, and payment strategy.",
    read: (spec) => s(spec.pricingStructure),
  },
  {
    id: "brandIdentity",
    label: "Brand & Visual Identity",
    icon: "Palette",
    group: "Product",
    emptyHint: "Let's define your brand colors, logo approach, and visual personality.",
    read: (spec) => s(spec.brandIdentity),
  },
  {
    id: "themePreferences",
    label: "Theme & Appearance",
    icon: "Monitor",
    group: "Product",
    emptyHint: "Let's choose your app's color theme, typography, dark mode strategy, and UI style.",
    read: (spec) => s(spec.themePreferences),
  },
]

export const PLAN_SECTION_IDS = PLAN_SECTIONS.map((d) => d.id)

export function getPlanSection(id: string): PlanSectionDef | undefined {
  return PLAN_SECTIONS.find((d) => d.id === id)
}

/** True when a section's value still reads as the generator's explicit
 * "not defined yet" placeholder — treated as missing, never as content. */
export function isPlaceholderValue(value: string): boolean {
  return /^not defined yet:/i.test(value.trim())
}

/** Deterministic status from field population (runtime must name Atai). */
export function sectionStatus(def: PlanSectionDef, spec: ApplicationSpecification): PlanSectionStatus {
  const value = def.read(spec)
  if (!value || isPlaceholderValue(value)) return "missing"
  if (def.id === "runtimeIntegrations" && !isRuntimeIntegrationsGrounded(value)) return "needs_work"
  return "complete"
}

// ─── Plan health ──────────────────────────────────────────────────────────────
//
// Transparent calculation (spec section 47):
//   health = complete sections / total sections
// A section is "missing" when its mapped field is empty or placeholder.
// AI "needs_work" findings are tracked separately and never change the %.

export interface SectionHealth {
  id: PlanSectionId
  label: string
  status: PlanSectionStatus
}

export function computePlanHealth(spec: ApplicationSpecification): {
  percent: number
  sections: SectionHealth[]
  missing: PlanSectionId[]
} {
  const sections: SectionHealth[] = PLAN_SECTIONS.map((def) => ({
    id: def.id,
    label: def.label,
    status: sectionStatus(def, spec),
  }))
  const complete = sections.filter((x) => x.status === "complete").length
  return {
    percent: Math.round((complete / sections.length) * 100),
    sections,
    missing: sections.filter((x) => x.status !== "complete").map((x) => x.id),
  }
}

// ─── Proposal validation ──────────────────────────────────────────────────────

const MAX_SECTION_VALUE_LENGTH = 8000

/** Validate an AI-proposed (or user-edited) section update server-side.
 * The allowed section set and value shape are enforced here — the AI never
 * receives arbitrary mutation capability (spec section 31). */
export function validatePlanSectionValue(sectionId: string, value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const def = getPlanSection(sectionId)
  if (!def) return { ok: false, error: `Unknown plan section "${sectionId}".` }
  if (typeof value !== "string") return { ok: false, error: "Section value must be text." }
  const trimmed = value.trim()
  if (trimmed.length === 0) return { ok: false, error: "Section value cannot be empty." }
  if (trimmed.length > MAX_SECTION_VALUE_LENGTH) {
    return { ok: false, error: `Section text is too long (max ${MAX_SECTION_VALUE_LENGTH} characters).` }
  }
  return { ok: true, value: trimmed }
}

/** The single operation type the AI may request (spec section 31). */
export const ALLOWED_PROPOSAL_OPERATION = "update_plan_section" as const

/** Sections whose spec representation is generator-managed (feature catalog,
 * flow list, data entities). Proposals note them in additionalInstructions
 * instead of corrupting the typed structures, so auto-complete never drafts
 * them directly. */
export const GENERATOR_MANAGED_SECTIONS: ReadonlySet<string> = new Set(["features", "flows", "data"])

/** Plan sections that map 1:1 to a plain business-plan text field on the
 * spec — clearable to empty via the businessFields branch of
 * clearSectionUpdate. Includes SEO (a founder-owned text section). */
export const TEXT_PLAN_SECTIONS: ReadonlySet<string> = new Set([
  "vision",
  "problem",
  "solution",
  "valueProposition",
  "businessModel",
  "revenueModel",
  "runtimeIntegrations",
  "seo",
  "marketPositioning",
  "marketingPlan",
  "launchPlan",
  "growthPlan",
])

/** Reset a section to its empty ("not defined") state immutably — used by the
 * undo path for auto-completed sections. Never throws; unknown sections are
 * returned unchanged. */
export function clearSectionUpdate(
  spec: ApplicationSpecification,
  sectionId: PlanSectionId,
): ApplicationSpecification {
  if (sectionId === "targetUsers") return { ...spec, targetUsers: [] }
  if (sectionId === "features" || sectionId === "flows" || sectionId === "data") return spec
  // Map plan-section ids to their spec text fields. "seo" (the SEO & Search
  // section) stores in seoPlan; every other text section shares its id.
  const businessFields = new Set<string>([
    "vision",
    "problem",
    "solution",
    "valueProposition",
    "businessModel",
    "revenueModel",
    "runtimeIntegrations",
    "marketPositioning",
    "marketingPlan",
    "launchPlan",
    "growthPlan",
  ])
  if (sectionId === "seo") return { ...spec, seoPlan: "" }
  if (businessFields.has(sectionId)) {
    return { ...spec, [sectionId]: "" }
  }
  switch (sectionId) {
    case "overview":
      return { ...spec, description: "" }
    case "auth":
      return { ...spec, authenticationRequirements: "" }
    default:
      return spec
  }
}

/** Apply an approved section update to a specification immutably. */
export function applySectionUpdate(
  spec: ApplicationSpecification,
  sectionId: PlanSectionId,
  value: string,
): ApplicationSpecification {
  const businessFields = new Set<string>([
    "vision",
    "problem",
    "solution",
    "valueProposition",
    "businessModel",
    "revenueModel",
    "runtimeIntegrations",
    "marketPositioning",
    "launchPlan",
    "marketingPlan",
    "growthPlan",
  ])
  // The SEO & Search section stores under seoPlan — the plan content itself
  // is kept verbatim and becomes mandatory build instructions.
  if (sectionId === "seo") return { ...spec, seoPlan: value }
  if (businessFields.has(sectionId)) {
    return { ...spec, [sectionId]: value }
  }
  switch (sectionId) {
    case "overview":
      return { ...spec, description: value }
    case "targetUsers":
      return { ...spec, targetUsers: value.split(",").map((v) => v.trim()).filter(Boolean) }
    case "features": {
      // Section-level features editing stays in the plan editor; proposals
      // here append instructions rather than corrupt the feature catalog.
      const note = `Key features: ${value}`
      return { ...spec, additionalInstructions: spec.additionalInstructions ? `${spec.additionalInstructions}\n${note}` : note }
    }
    case "flows": {
      const note = `User flows: ${value}`
      return { ...spec, additionalInstructions: spec.additionalInstructions ? `${spec.additionalInstructions}\n${note}` : note }
    }
    case "data": {
      const note = `Data model: ${value}`
      return { ...spec, additionalInstructions: spec.additionalInstructions ? `${spec.additionalInstructions}\n${note}` : note }
    }
    case "auth":
      return { ...spec, authenticationRequirements: value }
    default:
      return spec
  }
}


// ─── Plan quality scoring ─────────────────────────────────────────────────────

export interface SectionQualityRequirements {
  minWordCount: number
  /** Keywords or patterns that should appear in a complete section */
  requiredPatterns?: RegExp[]
  /** Maximum allowed placeholder markers like "TBD", "(fill this in)" */
  maxPlaceholders: number
}

/** Quality requirements per section — used to assess if a section has enough
 * detail for production-ready builds */
export const SECTION_QUALITY_REQUIREMENTS: Partial<Record<PlanSectionId, SectionQualityRequirements>> = {
  features: {
    minWordCount: 400,
    requiredPatterns: [/user story/i, /functionality|feature/i],
    maxPlaceholders: 2,
  },
  pricingTiers: {
    minWordCount: 300,
    requiredPatterns: [/(free|basic|pro|enterprise|tier)/i, /\$\d+|price/i],
    maxPlaceholders: 0,
  },
  flows: {
    minWordCount: 300,
    requiredPatterns: [/step|user|flow/i],
    maxPlaceholders: 2,
  },
  data: {
    minWordCount: 200,
    requiredPatterns: [/field|entity|table/i],
    maxPlaceholders: 2,
  },
  problem: {
    minWordCount: 150,
    maxPlaceholders: 1,
  },
  solution: {
    minWordCount: 150,
    maxPlaceholders: 1,
  },
  auth: {
    minWordCount: 100,
    requiredPatterns: [/sign|login|auth|password|email/i],
    maxPlaceholders: 1,
  },
  seo: {
    minWordCount: 200,
    requiredPatterns: [/keyword|meta|search|google/i],
    maxPlaceholders: 1,
  },
  brandIdentity: {
    minWordCount: 150,
    requiredPatterns: [/color|brand|logo|visual/i],
    maxPlaceholders: 1,
  },
  themePreferences: {
    minWordCount: 150,
    requiredPatterns: [/theme|font|dark|light/i],
    maxPlaceholders: 1,
  },
}

/** Count placeholder markers in text (TBD, TODO, fill this in, etc.) */
function countPlaceholders(text: string): number {
  const patterns = [
    /\bTBD\b/gi,
    /\bTODO\b/gi,
    /\(fill (?:this|in|out)\)/gi,
    /\[.*?\]/g, // Bracketed placeholders like [insert here]
    /\{\{.*?\}\}/g, // Mustache-style {{placeholders}}
  ]
  let count = 0
  for (const pattern of patterns) {
    const matches = text.match(pattern)
    if (matches) count += matches.length
  }
  return count
}

/** Calculate quality score (0-100) for a single section based on completeness
 * and detail requirements */
export function calculateSectionQuality(
  sectionId: PlanSectionId,
  spec: ApplicationSpecification,
): number {
  const def = getPlanSection(sectionId)
  if (!def) return 0

  const value = def.read(spec)
  if (!value || isPlaceholderValue(value)) return 0

  const requirements = SECTION_QUALITY_REQUIREMENTS[sectionId]
  if (!requirements) return 100 // No specific requirements = present is enough

  const wordCount = value.split(/\s+/).length
  const placeholderCount = countPlaceholders(value)

  let score = 0

  // Word count score (50% weight)
  const wordScore = Math.min((wordCount / requirements.minWordCount) * 50, 50)
  score += wordScore

  // Pattern matching score (30% weight)
  if (requirements.requiredPatterns && requirements.requiredPatterns.length > 0) {
    const matchedPatterns = requirements.requiredPatterns.filter((pattern) => pattern.test(value)).length
    const patternScore = (matchedPatterns / requirements.requiredPatterns.length) * 30
    score += patternScore
  } else {
    score += 30 // No patterns required = full points
  }

  // Placeholder penalty (20% weight)
  if (placeholderCount <= requirements.maxPlaceholders) {
    score += 20
  } else {
    // Lose points for excess placeholders
    const excess = placeholderCount - requirements.maxPlaceholders
    score += Math.max(0, 20 - (excess * 5))
  }

  return Math.round(Math.min(score, 100))
}

/** Calculate overall plan quality score and readiness assessment */
export function calculatePlanQuality(spec: ApplicationSpecification): {
  overallScore: number
  readinessLevel: 'excellent' | 'good' | 'acceptable' | 'needs_work'
  readinessMessage: string
  sectionsAssessed: number
  sectionsWithIssues: Array<{ id: PlanSectionId; label: string; score: number }>
} {
  const sectionsWithRequirements = PLAN_SECTIONS.filter(
    (def) => SECTION_QUALITY_REQUIREMENTS[def.id]
  )

  const scores = sectionsWithRequirements.map((def) => ({
    id: def.id,
    label: def.label,
    score: calculateSectionQuality(def.id, spec),
  }))

  const overallScore = scores.length > 0
    ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length)
    : 100

  const sectionsWithIssues = scores.filter((s) => s.score < 70).sort((a, b) => a.score - b.score)

  let readinessLevel: 'excellent' | 'good' | 'acceptable' | 'needs_work'
  let readinessMessage: string

  if (overallScore >= 90) {
    readinessLevel = 'excellent'
    readinessMessage = 'Excellent detail — ready to build a production-quality application'
  } else if (overallScore >= 75) {
    readinessLevel = 'good'
    readinessMessage = 'Good level of detail — the builder has what it needs'
  } else if (overallScore >= 60) {
    readinessLevel = 'acceptable'
    readinessMessage = 'Acceptable detail — you can build, but more specificity would help'
  } else {
    readinessLevel = 'needs_work'
    readinessMessage = 'Needs more detail for a production-ready build'
  }

  return {
    overallScore,
    readinessLevel,
    readinessMessage,
    sectionsAssessed: scores.length,
    sectionsWithIssues,
  }
}
