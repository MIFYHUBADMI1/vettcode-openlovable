import type { ApplicationSpecification } from "@/lib/types/specification"
import type { BusinessPlanField, CoreFlow, SpecDataEntity, SuggestedFeature } from "@/lib/types/specification"
import { isRuntimeIntegrationsGrounded } from "@/lib/analysis/runtime-capabilities"

/**
 * Canonical plan sections for the Collaborate workspace.
 *
 * Every visible section maps to a REAL field on `ApplicationSpecification`
 * (spec section 12: never invent sections that don't exist). Statuses are
 * deterministic — derived from field population — so the UI never fabricates
 * a score. "Needs work" is only ever added by AI findings, never guessed.
 *
 * Marketing Plan is ONE combined section covering marketing, launch and
 * growth together, Design Direction is ONE combined section covering brand
 * identity, visual system, typography, theme and responsive behaviour, and
 * Vision, Purpose, Problem & Solution is ONE combined foundation section.
 * The legacy spec fields behind those merges are still read and cleared so
 * plans drafted before the merges show their whole story instead of half of
 * it. Every non-metadata field the AI writes to `ApplicationSpecification`
 * has a section — nothing the AI produced is hidden from the Collaborate
 * workspace.
 */

export type PlanSectionId =
  | BusinessPlanField
  | "overview"
  | "applicationType"
  | "targetUsers"
  | "userRoles"
  | "features"
  | "flows"
  | "data"
  | "auth"
  | "backend"
  | "integrations"
  | "designDirection"
  | "additionalInstructions"
  | "seo"
  | "pricingTiersDetail"

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

/** The fields the combined marketing section reads (full spec or a partial
 * stored record both satisfy this). */
type MarketingPlanSource = Pick<ApplicationSpecification, "marketingPlan" | "launchPlan" | "growthPlan">

const MARKETING_PLAN_PARTS: ReadonlyArray<{
  heading: string
  read: (spec: MarketingPlanSource) => string
}> = [
  { heading: "Marketing", read: (spec) => s(spec.marketingPlan) },
  { heading: "Launch", read: (spec) => s(spec.launchPlan) },
  { heading: "Growth", read: (spec) => s(spec.growthPlan) },
]

/** The combined Marketing Plan value.
 *
 * One section now covers marketing, launch and growth. Plans drafted while
 * those were three sections keep their words: when more than one of the
 * legacy fields still carries content, the parts are merged under headings so
 * nothing is silently dropped. Explicit generator placeholders never count as
 * content. New drafts write the whole plan to `marketingPlan` (and retire the
 * legacy copies, see applySectionUpdate). */
export function readCombinedMarketingPlan(spec: MarketingPlanSource | undefined | null): string {
  if (!spec) return ""
  const defined = MARKETING_PLAN_PARTS.map((part) => ({ heading: part.heading, value: part.read(spec) })).filter(
    (part) => part.value && !isPlaceholderValue(part.value),
  )
  if (defined.length === 0) {
    // Keep a lone placeholder visible so the section still reads as missing
    // instead of looking like it was never generated at all.
    return MARKETING_PLAN_PARTS.map((part) => part.read(spec)).find(Boolean) ?? ""
  }
  if (defined.length === 1) return defined[0].value
  return defined.map((part) => `## ${part.heading}\n${part.value}`).join("\n\n")
}

/** The fields the combined design section reads (full spec or a partial
 * stored record both satisfy this). */
type DesignDirectionSource = Pick<
  ApplicationSpecification,
  "designDirection" | "brandIdentity" | "appearance" | "typography" | "themePreferences" | "responsiveRequirements"
>

const DESIGN_DIRECTION_PARTS: ReadonlyArray<{
  heading: string
  read: (spec: DesignDirectionSource) => string
}> = [
  { heading: "Design direction", read: (spec) => s(spec.designDirection) },
  { heading: "Brand identity", read: (spec) => s(spec.brandIdentity) },
  { heading: "Visual system", read: (spec) => s(spec.appearance) },
  { heading: "Typography", read: (spec) => s(spec.typography) },
  { heading: "Theme & appearance", read: (spec) => s(spec.themePreferences) },
  { heading: "Responsive & devices", read: (spec) => s(spec.responsiveRequirements) },
]

/** The combined Design Direction value.
 *
 * One section now covers design direction, brand identity, visual system,
 * typography, theme and responsive behaviour. Plans drafted while those were
 * separate sections keep their words: when more than one legacy field still
 * carries content, the parts are merged under headings so nothing is silently
 * dropped. Explicit generator placeholders never count as content. New drafts
 * write the whole direction to `designDirection` (and retire the legacy
 * copies, see applySectionUpdate). */
export function readCombinedDesignDirection(spec: DesignDirectionSource | undefined | null): string {
  if (!spec) return ""
  const defined = DESIGN_DIRECTION_PARTS.map((part) => ({ heading: part.heading, value: part.read(spec) })).filter(
    (part) => part.value && !isPlaceholderValue(part.value),
  )
  if (defined.length === 0) {
    // Keep a lone placeholder visible so the section still reads as missing
    // instead of looking like it was never generated at all.
    return DESIGN_DIRECTION_PARTS.map((part) => part.read(spec)).find(Boolean) ?? ""
  }
  if (defined.length === 1) return defined[0].value
  return defined.map((part) => `## ${part.heading}\n${part.value}`).join("\n\n")
}

/** The fields the combined foundation section reads. */
type FoundationSource = Pick<ApplicationSpecification, "vision" | "purpose" | "problem" | "solution">

const FOUNDATION_PARTS: ReadonlyArray<{
  heading: string
  read: (spec: FoundationSource) => string
}> = [
  { heading: "Vision", read: (spec) => s(spec.vision) },
  { heading: "Purpose", read: (spec) => s(spec.purpose) },
  { heading: "Problem", read: (spec) => s(spec.problem) },
  { heading: "Solution", read: (spec) => s(spec.solution) },
]

/** The combined Vision, Purpose, Problem & Solution value.
 *
 * One section now covers the whole foundation. Plans drafted while those were
 * separate sections keep their words: when more than one field still carries
 * content, the parts are merged under headings so nothing is silently dropped.
 * Explicit generator placeholders never count as content. New drafts write the
 * whole foundation to `vision` (and retire the legacy copies, see
 * applySectionUpdate). */
export function readCombinedFoundation(spec: FoundationSource | undefined | null): string {
  if (!spec) return ""
  const defined = FOUNDATION_PARTS.map((part) => ({ heading: part.heading, value: part.read(spec) })).filter(
    (part) => part.value && !isPlaceholderValue(part.value),
  )
  if (defined.length === 0) {
    // Keep a lone placeholder visible so the section still reads as missing
    // instead of looking like it was never generated at all.
    return FOUNDATION_PARTS.map((part) => part.read(spec)).find(Boolean) ?? ""
  }
  if (defined.length === 1) return defined[0].value
  return defined.map((part) => `## ${part.heading}\n${part.value}`).join("\n\n")
}

export const PLAN_SECTIONS: PlanSectionDef[] = [
  {
    id: "applicationType",
    label: "Application Type",
    icon: "Tag",
    group: "Foundation",
    emptyHint: "Let's name the kind of application this is.",
    read: (spec) => s(spec.applicationType),
  },
  {
    id: "overview",
    label: "Overview",
    icon: "Lightbulb",
    group: "Foundation",
    emptyHint: "Let's describe what this product is and who it's for.",
    read: (spec) => s(spec.description) || s(spec.purpose),
  },
  {
    id: "vision",
    label: "Vision, Purpose, Problem & Solution",
    icon: "Telescope",
    group: "Foundation",
    emptyHint:
      "Let's define one clear foundation — the vision, why it matters (purpose), the problem you solve, and how you solve it.",
    read: (spec) => readCombinedFoundation(spec),
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
    id: "userRoles",
    label: "User Roles",
    icon: "UserCog",
    group: "Market",
    emptyHint: "Let's define the roles people can have and what each can do.",
    read: (spec) => spec.userRoles.filter(Boolean).join(", "),
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
    id: "marketingPlan",
    label: "Marketing Plan",
    icon: "Megaphone",
    group: "Market",
    emptyHint:
      "Let's build one go-to-market plan — who it's for, how customers find you, the launch, and how the business grows after it.",
    read: (spec) => readCombinedMarketingPlan(spec),
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
    id: "backend",
    label: "Backend & API",
    icon: "Server",
    group: "Product",
    emptyHint: "Let's list the server-side capabilities this app needs.",
    read: (spec) => spec.backendRequirements.filter(Boolean).join("\n"),
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: "Cable",
    group: "Product",
    emptyHint: "Let's list the external services this app connects to.",
    read: (spec) => spec.integrations.filter(Boolean).join("\n"),
  },
  {
    id: "designDirection",
    label: "Design Direction",
    icon: "PenTool",
    group: "Product",
    emptyHint:
      "Let's settle one design direction — brand identity, visual system, typography, theme, and how it adapts across devices.",
    read: (spec) => readCombinedDesignDirection(spec),
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
    label: "Pricing Structure",
    icon: "DollarSign",
    group: "Business",
    emptyHint: "Let's define your pricing structure — tiers, features per tier, billing cycles, and payment strategy.",
    read: (spec) => s(spec.pricingStructure),
  },
  {
    id: "pricingTiersDetail",
    label: "Pricing Tiers",
    icon: "Layers",
    group: "Business",
    emptyHint: "Let's set out the plans, prices, limits, and upgrade paths.",
    read: (spec) => s(spec.pricingTiers),
  },
  {
    id: "additionalInstructions",
    label: "Build Instructions",
    icon: "ListChecks",
    group: "Product",
    emptyHint: "Let's add any special instructions the builder must follow.",
    read: (spec) => s(spec.additionalInstructions),
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

/** The largest section value the plan accepts. Proposal builders need it so
 * they never offer something the accept PATCH is guaranteed to reject. */
export const MAX_PLAN_SECTION_LENGTH = MAX_SECTION_VALUE_LENGTH

/** Trim AI prose down to the accepted length, cutting at the last whitespace
 * so the sentence doesn't stop mid-word. Deterministic and visible: the card
 * shows the exact text that will be saved. */
export function clampPlanSectionValue(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length <= MAX_PLAN_SECTION_LENGTH) return trimmed
  const cut = trimmed.slice(0, MAX_PLAN_SECTION_LENGTH)
  const lastBreak = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("\n"))
  return (lastBreak > MAX_PLAN_SECTION_LENGTH * 0.6 ? cut.slice(0, lastBreak) : cut).trimEnd()
}

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
  "applicationType",
  "vision",
  "valueProposition",
  "businessModel",
  "revenueModel",
  "runtimeIntegrations",
  "seo",
  "marketPositioning",
  "marketingPlan",
  "designDirection",
  "additionalInstructions",
])

/** Reset a section to its empty ("not defined") state immutably — used by the
 * undo path for auto-completed sections. Never throws; unknown sections are
 * returned unchanged. */
export function clearSectionUpdate(
  spec: ApplicationSpecification,
  sectionId: PlanSectionId,
): ApplicationSpecification {
  if (sectionId === "targetUsers") return { ...spec, targetUsers: [] }
  if (sectionId === "userRoles") return { ...spec, userRoles: [] }
  if (sectionId === "backend") return { ...spec, backendRequirements: [] }
  if (sectionId === "integrations") return { ...spec, integrations: [] }
  if (sectionId === "features" || sectionId === "flows" || sectionId === "data") return spec
  // One combined section: clearing it retires the legacy launch/growth copies too.
  if (sectionId === "marketingPlan") {
    return { ...spec, marketingPlan: "", launchPlan: "", growthPlan: "" }
  }
  // One combined section: clearing it retires the five legacy design copies too.
  if (sectionId === "designDirection") {
    return {
      ...spec,
      designDirection: "",
      brandIdentity: "",
      themePreferences: "",
      appearance: "",
      typography: "",
      responsiveRequirements: "",
    }
  }
  // One combined foundation section: clearing it retires the legacy purpose,
  // problem and solution copies too.
  if (sectionId === "vision") {
    return { ...spec, vision: "", purpose: "", problem: "", solution: "" }
  }
  // Map plan-section ids to their spec text fields. "seo" (the SEO & Search
  // section) stores in seoPlan; every other text section shares its id.
  const businessFields = new Set<string>([
    "valueProposition",
    "businessModel",
    "revenueModel",
    "runtimeIntegrations",
    "marketPositioning",
    "additionalInstructions",
  ])
  if (sectionId === "seo") return { ...spec, seoPlan: "" }
  // Pricing & Tiers reads pricingStructure — the field the build consumes.
  if (sectionId === "pricingTiers") return { ...spec, pricingStructure: "" }
  if (sectionId === "pricingTiersDetail") return { ...spec, pricingTiers: "" }
  if (businessFields.has(sectionId)) {
    return { ...spec, [sectionId]: "" }
  }
  switch (sectionId) {
    case "overview":
      return { ...spec, description: "" }
    case "applicationType":
      return { ...spec, applicationType: "" }
    case "auth":
      return { ...spec, authenticationRequirements: "" }
    default:
      return spec
  }
}

// ─── Structured list sections (features / flows / data) ──────────────────────
//
// These three sections render a comma-separated list of names, so a manual
// save must update the typed catalog those names come from. AI proposals keep
// the older behaviour (append their prose to additionalInstructions) because
// they carry instructions, not a replacement catalog.

function splitListValue(value: string): string[] {
  const seen = new Set<string>()
  const parts: string[] = []
  for (const raw of value.split(",")) {
    const part = raw.trim()
    if (!part) continue
    const key = part.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    parts.push(part)
  }
  return parts
}

/** One requirement per line (the way backend/integration lists are displayed),
 * falling back to a comma list when the founder typed everything on one line. */
function splitListLines(value: string): string[] {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
  return lines.length > 1 ? lines : splitListValue(value)
}

function uniqueFeatureKey(label: string, used: Set<string>): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "feature"
  let key = base
  let suffix = 2
  while (used.has(key)) key = `${base}-${suffix++}`
  used.add(key)
  return key
}

function mergeFeatureCatalog(existing: SuggestedFeature[], value: string): SuggestedFeature[] {
  const labels = splitListValue(value)
  const byLabel = new Map(existing.map((f) => [f.label.toLowerCase(), f]))
  const used = new Set(existing.map((f) => f.key))
  const selected = labels.map((label) => {
    const match = byLabel.get(label.toLowerCase())
    return match
      ? { ...match, label, enabled: true }
      : { key: uniqueFeatureKey(label, used), label, description: undefined, enabled: true }
  })
  // Features the founder removed stay in the catalog but disabled, so their
  // descriptions survive and re-adding them is lossless.
  const keptOff = existing
    .filter((f) => !labels.some((label) => label.toLowerCase() === f.label.toLowerCase()))
    .map((f) => ({ ...f, enabled: false }))
  return [...selected, ...keptOff]
}

function mergeFlowList(existing: CoreFlow[], value: string): CoreFlow[] {
  const names = splitListValue(value)
  const byName = new Map(existing.map((f) => [f.name.toLowerCase(), f]))
  return names.map((name) => {
    const match = byName.get(name.toLowerCase())
    return match ? { ...match, name } : { name, description: undefined }
  })
}

function mergeEntityList(existing: SpecDataEntity[], value: string): SpecDataEntity[] {
  const names = splitListValue(value)
  const byName = new Map(existing.map((e) => [e.name.toLowerCase(), e]))
  return names.map((name) => {
    const match = byName.get(name.toLowerCase())
    return match ? { ...match, name } : { name, description: undefined, fields: [] }
  })
}

export interface ApplySectionUpdateOptions {
  /**
   * "manual" — the founder edited the section in the workspace, so a list of
   * names replaces the structured catalog.
   * "proposal" (default) — an AI-authored change; list sections keep their
   * catalog and the prose is recorded as extra build instructions.
   */
  mode?: "manual" | "proposal"
}

/** Apply an approved section update to a specification immutably. */
export function applySectionUpdate(
  spec: ApplicationSpecification,
  sectionId: PlanSectionId,
  value: string,
  options?: ApplySectionUpdateOptions,
): ApplicationSpecification {
  const businessFields = new Set<string>([
    "valueProposition",
    "businessModel",
    "revenueModel",
    "runtimeIntegrations",
    "marketPositioning",
    "additionalInstructions",
  ])
  // One combined Marketing Plan replaced the separate marketing/launch/growth
  // sections. The whole plan is stored in marketingPlan and the legacy copies
  // are retired together, so the section never shows the same content twice.
  if (sectionId === "marketingPlan") {
    return { ...spec, marketingPlan: value, launchPlan: "", growthPlan: "" }
  }
  // One combined Design Direction replaced the five separate design sections.
  // The whole direction is stored in designDirection and the legacy copies are
  // retired together, so the section never shows the same content twice.
  if (sectionId === "designDirection") {
    return {
      ...spec,
      designDirection: value,
      brandIdentity: "",
      themePreferences: "",
      appearance: "",
      typography: "",
      responsiveRequirements: "",
    }
  }
  // One combined foundation section replaced the separate vision/purpose/
  // problem/solution sections. The whole foundation is stored in vision and
  // the legacy copies are retired together, so nothing shows twice.
  if (sectionId === "vision") {
    return { ...spec, vision: value, purpose: "", problem: "", solution: "" }
  }
  // The SEO & Search section stores under seoPlan — the plan content itself
  // is kept verbatim and becomes mandatory build instructions.
  if (sectionId === "seo") return { ...spec, seoPlan: value }
  // Pricing & Tiers reads pricingStructure — the field the build consumes.
  if (sectionId === "pricingTiers") return { ...spec, pricingStructure: value }
  if (sectionId === "pricingTiersDetail") return { ...spec, pricingTiers: value }
  if (businessFields.has(sectionId)) {
    return { ...spec, [sectionId]: value }
  }
  const manual = options?.mode === "manual"
  switch (sectionId) {
    case "overview":
      return { ...spec, description: value }
    case "applicationType":
      return { ...spec, applicationType: value }
    case "userRoles":
      return { ...spec, userRoles: splitListValue(value) }
    case "backend":
      return { ...spec, backendRequirements: splitListLines(value) }
    case "integrations":
      return { ...spec, integrations: splitListLines(value) }
    case "targetUsers":
      return { ...spec, targetUsers: value.split(",").map((v) => v.trim()).filter(Boolean) }
    case "features": {
      if (manual) return { ...spec, suggestedFeatures: mergeFeatureCatalog(spec.suggestedFeatures, value) }
      // Section-level features editing stays in the plan editor; proposals
      // here append instructions rather than corrupt the feature catalog.
      const note = `Key features: ${value}`
      return { ...spec, additionalInstructions: spec.additionalInstructions ? `${spec.additionalInstructions}\n${note}` : note }
    }
    case "flows": {
      if (manual) return { ...spec, coreFlows: mergeFlowList(spec.coreFlows, value) }
      const note = `User flows: ${value}`
      return { ...spec, additionalInstructions: spec.additionalInstructions ? `${spec.additionalInstructions}\n${note}` : note }
    }
    case "data": {
      if (manual) return { ...spec, dataEntities: mergeEntityList(spec.dataEntities, value) }
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
  marketingPlan: {
    // One section now carries marketing, launch and growth — it needs the
    // depth of all three combined, not a single paragraph.
    minWordCount: 400,
    requiredPatterns: [/launch/i, /growth/i, /channel|acquisition/i, /metric|retention|loop/i],
    maxPlaceholders: 1,
  },
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
  vision: {
    // One section now carries vision, purpose, problem and solution — it needs
    // the depth of all four, not a single mission sentence.
    minWordCount: 350,
    requiredPatterns: [/vision|purpose/i, /problem/i, /solution/i],
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
  designDirection: {
    // One section now carries brand identity, visual system, typography,
    // theme and responsive behaviour — it needs the depth of all of them.
    minWordCount: 350,
    requiredPatterns: [/color|palette/i, /font|type/i, /theme|dark|light/i, /responsive|mobile|device/i],
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
