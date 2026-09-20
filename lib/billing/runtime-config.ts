import { getDb } from "@/lib/db/mongodb"
import { z } from "zod"
import { logger } from "@/lib/logging/logger"
import { BUILD_TIERS, type ForkTier } from "@/lib/billing/config"

/**
 * Runtime billing configuration.
 *
 * Some billing knobs need to change without a deploy. This service stores
 * overrides in a single `app_settings` document and layers them ON TOP of
 * the code defaults — a missing or invalid override always falls back to
 * the default, so a corrupted or wiped collection can never break billing.
 */

const SETTINGS_COLLECTION = "app_settings"
const SETTINGS_DOC_ID = "billing"
const CACHE_TTL_MS = 30_000

const CollaborateCostsSchema = z.object({
  /** Credits charged per co-founder chat message. */
  chatMessageCost: z.number().int().min(0).max(10_000),
  /** Credits charged per AI plan analysis run. */
  planAnalysisCost: z.number().int().min(0).max(100_000),
  /** Credits charged per section the co-founder auto-completes. */
  autoCompleteSectionCost: z.number().int().min(0).max(10_000),
})
export type CollaborateCosts = z.infer<typeof CollaborateCostsSchema>

export const DEFAULT_COLLABORATE_COSTS: CollaborateCosts = {
  chatMessageCost: 2,
  planAnalysisCost: 10,
  autoCompleteSectionCost: 8,
}

const BuildTiersCostsSchema = z.object({
  /** Credits charged for a simple-tier build or follow-up edit. */
  simple: z.number().int().min(0).max(10_000_000),
  /** Credits charged for a medium-tier build or follow-up edit. */
  medium: z.number().int().min(0).max(10_000_000),
  /** Credits charged for a complex-tier build or follow-up edit. */
  complex: z.number().int().min(0).max(10_000_000),
})
export type BuildTierCosts = z.infer<typeof BuildTiersCostsSchema>

export const DEFAULT_BUILD_TIER_COSTS: BuildTierCosts = {
  simple: BUILD_TIERS.simple.credits,
  medium: BUILD_TIERS.medium.credits,
  complex: BUILD_TIERS.complex.credits,
}

const MirrorPipelineCostsSchema = z.object({
  /** Credits charged for a standard website scrape (legacy mode). */
  scrapeCost: z.number().int().min(0).max(100_000),
  /** Credits charged for a website scrape (heavy mode). */
  heavyScrapeCost: z.number().int().min(0).max(100_000),
  /** Credits charged for plan/spec generation (legacy mode). */
  planCost: z.number().int().min(0).max(100_000),
  /** Credits charged for plan/spec generation (heavy mode). */
  heavyPlanCost: z.number().int().min(0).max(100_000),
  /** Credits charged for a full-site deep crawl (legacy mode). */
  deepCrawlCost: z.number().int().min(0).max(1_000_000),
  /** Credits charged for a full-site deep crawl (heavy mode). */
  heavyDeepCrawlCost: z.number().int().min(0).max(1_000_000),
})
export type MirrorPipelineCosts = z.infer<typeof MirrorPipelineCostsSchema>

export const DEFAULT_MIRROR_PIPELINE_COSTS: MirrorPipelineCosts = {
  scrapeCost: 5,
  heavyScrapeCost: 100,
  planCost: 5,
  heavyPlanCost: 100,
  deepCrawlCost: 500,
  heavyDeepCrawlCost: 1000,
}

const DeploymentCostsSchema = z.object({
  /** Credits charged per production deployment (lifetime hosting). */
  deployCost: z.number().int().min(0).max(1_000_000),
})
export type DeploymentCosts = z.infer<typeof DeploymentCostsSchema>

export const DEFAULT_DEPLOYMENT_COSTS: DeploymentCosts = {
  deployCost: 500,
}

const ForkPricingSchema = z.object({
  /** Credits charged to fork a simple-tier project. */
  simpleForkCost: z.number().int().min(0).max(10_000_000),
  /** Credits charged to fork a medium-tier project. */
  mediumForkCost: z.number().int().min(0).max(10_000_000),
  /** Credits charged to fork a complex-tier project. */
  complexForkCost: z.number().int().min(0).max(10_000_000),
  /** Credits granted to the original owner when their project is forked (simple). */
  simpleOwnerRoyalty: z.number().int().min(0).max(10_000_000),
  /** Credits granted to the original owner when their project is forked (medium). */
  mediumOwnerRoyalty: z.number().int().min(0).max(10_000_000),
  /** Credits granted to the original owner when their project is forked (complex). */
  complexOwnerRoyalty: z.number().int().min(0).max(10_000_000),
})
export type ForkPricing = z.infer<typeof ForkPricingSchema>

export const DEFAULT_FORK_PRICING: ForkPricing = {
  simpleForkCost: 15_000,
  mediumForkCost: 45_000,
  complexForkCost: 50_000,
  simpleOwnerRoyalty: 5_000,
  mediumOwnerRoyalty: 10_000,
  complexOwnerRoyalty: 15_000,
}

const InfrastructurePricesSchema = z.object({
  /** Monthly credits for the Basic infrastructure plan. */
  basicPrice: z.number().int().min(0).max(10_000_000),
  /** Monthly credits for the Starter infrastructure plan. */
  starterPrice: z.number().int().min(0).max(10_000_000),
  /** Monthly credits for the Pro infrastructure plan. */
  proPrice: z.number().int().min(0).max(10_000_000),
  /** Monthly credits for the Business infrastructure plan. */
  businessPrice: z.number().int().min(0).max(10_000_000),
})
export type InfrastructurePrices = z.infer<typeof InfrastructurePricesSchema>

export const DEFAULT_INFRASTRUCTURE_PRICES: InfrastructurePrices = {
  basicPrice: 5_000,
  starterPrice: 15_000,
  proPrice: 35_000,
  businessPrice: 95_000,
}

const RewardsSchema = z.object({
  /** One-time welcome bonus granted on email verification. */
  welcomeBonus: z.number().int().min(0).max(1_000_000),
  /** Credits granted to a referrer when a referred user verifies their email. */
  referralVerificationReward: z.number().int().min(0).max(1_000_000),
  /** Credits granted to a referrer when a referred user hits the usage milestone. */
  referralMilestoneReward: z.number().int().min(0).max(1_000_000),
  /** Eligible build usage (credits) a referred user must reach for the milestone. */
  referralMilestoneThreshold: z.number().int().min(0).max(100_000_000),
})
export type Rewards = z.infer<typeof RewardsSchema>

export const DEFAULT_REWARDS: Rewards = {
  welcomeBonus: 500,
  referralVerificationReward: 500,
  referralMilestoneReward: 1_500,
  referralMilestoneThreshold: 75_000,
}

// ─── Runtime API pricing (Phase 9) ───────────────────────────────────────────
//
// Runtime pricing is SERVER-CONTROLLED and config-driven — never hardcoded in
// provider adapters and never client-supplied (Phase 9 §10/§107). It lives in
// the same app_settings document as every other billing knob, so admins
// adjust it without a deploy and invalid overrides fall back to defaults.
//
// Units are CREDITS PER 1,000 TOKENS (Atai credits are integers; the runtime
// charge calculator converts deterministically and rounds — see
// lib/runtime/metering/pricing.ts). Provider economics (what Atai pays
// OpenRouter) are deliberately NOT part of this config: provider cost and
// customer charge are separate concepts (Phase 9 §11).

const RuntimePricingSchema = z.object({
  /** ai.text chat/completion — credits per 1,000 input tokens. */
  aiTextInputPer1k: z.number().int().min(0).max(1_000_000),
  /** ai.text chat/completion — credits per 1,000 output tokens. */
  aiTextOutputPer1k: z.number().int().min(0).max(1_000_000),
  /** ai.embed — credits per 1,000 input tokens. */
  aiEmbedPer1k: z.number().int().min(0).max(1_000_000),
  /** search.web / web scrape — flat credits per request. */
  webRequest: z.number().int().min(0).max(1_000_000),
})
export type RuntimePricing = z.infer<typeof RuntimePricingSchema>

/** Runtime pricing version recorded on usage events + ledger metadata for auditability. */
export const RUNTIME_PRICING_VERSION = "RUNTIME_PRICING_V1" as const

export const DEFAULT_RUNTIME_PRICING: RuntimePricing = {
  aiTextInputPer1k: 2,
  aiTextOutputPer1k: 8,
  aiEmbedPer1k: 1,
  webRequest: 5,
}

// ─── Runtime pricing RULES (Phase 9.5) ───────────────────────────────────────
//
// Phase 9 shipped capability-level pricing (the flat `runtimePricing` section
// above — kept as the legacy fallback). Phase 9.5 adds ADMIN-MANAGED pricing
// RULES at the provider + capability + operation level, configurable from
// /admin without a deploy. Zero-charge rules are explicit ("free"); a MISSING
// rule is NOT free — resolution falls back to the legacy flat config and then
// DENIES the operation (fail-safe against unpriced provider spend).
//
// Rules live in the same app_settings billing document (no second config
// store, no migration). The array is replaced atomically on edit; historical
// runtime charges always carry the resolved pricing snapshot, so edits never
// rewrite the past.

export const RUNTIME_PRICING_MODES = ["fixed_per_request", "per_1k_tokens"] as const
export type RuntimePricingMode = (typeof RUNTIME_PRICING_MODES)[number]

export const RuntimePricingRuleSchema = z.object({
  /** Stable rule id (`rpr_...`) — snapshotted onto runtime usage records. */
  id: z.string().min(1).max(64),
  /** Provider id from the runtime provider registry (e.g. "openrouter"). */
  provider: z.string().min(1).max(64),
  /** Capability id from the capability registry (e.g. "ai.text"). */
  capability: z.string().min(1).max(100),
  /** Operation id within the capability (e.g. "chat"). */
  operation: z.string().min(1).max(100),
  /** Fixed flat charge per request, or usage-based per-1k-token charge. */
  mode: z.enum(RUNTIME_PRICING_MODES),
  /** fixed_per_request: flat Atai credits per billable request (0 = free). */
  credits: z.number().int().min(0).max(1_000_000).optional(),
  /** per_1k_tokens: Atai credits per 1,000 input tokens. */
  inputPer1k: z.number().int().min(0).max(1_000_000).optional(),
  /** per_1k_tokens: Atai credits per 1,000 output tokens. */
  outputPer1k: z.number().int().min(0).max(1_000_000).optional(),
  /** Disabled rules stay for audit and never match (deactivate over delete). */
  active: z.boolean(),
  /** Admin id of the last editor (audit — no secrets). */
  createdBy: z.string().max(64).optional(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
})
export type RuntimePricingRule = z.infer<typeof RuntimePricingRuleSchema>

/** No seeded rules: the legacy flat pricing fallback governs until the admin
 * adds provider-specific rules. Explicitly a config decision, not a gap. */
export const DEFAULT_RUNTIME_PRICING_RULES: RuntimePricingRule[] = []

const BillingSettingsSchema = z.object({
  collaborate: CollaborateCostsSchema,
  buildTiers: BuildTiersCostsSchema,
  mirrorPipeline: MirrorPipelineCostsSchema,
  deployment: DeploymentCostsSchema,
  forkPricing: ForkPricingSchema,
  infrastructurePrices: InfrastructurePricesSchema,
  rewards: RewardsSchema,
  runtimePricing: RuntimePricingSchema,
  /** Phase 9.5 — admin-managed runtime pricing rules (provider-level). */
  runtimePricingRules: z.array(RuntimePricingRuleSchema).max(500),
})
export type BillingSettings = z.infer<typeof BillingSettingsSchema>

interface SettingsDoc {
  _id: string
  collaborate?: Partial<CollaborateCosts>
  buildTiers?: Partial<BuildTierCosts>
  mirrorPipeline?: Partial<MirrorPipelineCosts>
  deployment?: Partial<DeploymentCosts>
  forkPricing?: Partial<ForkPricing>
  infrastructurePrices?: Partial<InfrastructurePrices>
  rewards?: Partial<Rewards>
  runtimePricing?: Partial<RuntimePricing>
  /** Phase 9.5 rules — replaced atomically, never merged per-field. */
  runtimePricingRules?: RuntimePricingRule[]
  updatedAt: number
}

let cache: { value: BillingSettings; at: number } | null = null

/** Clear the in-process cache (called after an admin update so the change
 * applies immediately on this instance). */
export function invalidateBillingSettings(): void {
  cache = null
}

async function loadSettings(): Promise<BillingSettings> {
  const now = Date.now()
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.value

  let value: BillingSettings = {
    collaborate: { ...DEFAULT_COLLABORATE_COSTS },
    buildTiers: { ...DEFAULT_BUILD_TIER_COSTS },
    mirrorPipeline: { ...DEFAULT_MIRROR_PIPELINE_COSTS },
    deployment: { ...DEFAULT_DEPLOYMENT_COSTS },
    forkPricing: { ...DEFAULT_FORK_PRICING },
    infrastructurePrices: { ...DEFAULT_INFRASTRUCTURE_PRICES },
    rewards: { ...DEFAULT_REWARDS },
    runtimePricing: { ...DEFAULT_RUNTIME_PRICING },
    runtimePricingRules: DEFAULT_RUNTIME_PRICING_RULES.map((r) => ({ ...r })),
  }
  try {
    const db = await getDb()
    const doc = await db.collection<SettingsDoc>(SETTINGS_COLLECTION).findOne({ _id: SETTINGS_DOC_ID })
    if (doc) {
      const parsed = BillingSettingsSchema.safeParse({
        collaborate: { ...DEFAULT_COLLABORATE_COSTS, ...(doc.collaborate ?? {}) },
        buildTiers: { ...DEFAULT_BUILD_TIER_COSTS, ...(doc.buildTiers ?? {}) },
        mirrorPipeline: { ...DEFAULT_MIRROR_PIPELINE_COSTS, ...(doc.mirrorPipeline ?? {}) },
        deployment: { ...DEFAULT_DEPLOYMENT_COSTS, ...(doc.deployment ?? {}) },
        forkPricing: { ...DEFAULT_FORK_PRICING, ...(doc.forkPricing ?? {}) },
        infrastructurePrices: { ...DEFAULT_INFRASTRUCTURE_PRICES, ...(doc.infrastructurePrices ?? {}) },
        rewards: { ...DEFAULT_REWARDS, ...(doc.rewards ?? {}) },
        runtimePricing: { ...DEFAULT_RUNTIME_PRICING, ...(doc.runtimePricing ?? {}) },
        runtimePricingRules: Array.isArray(doc.runtimePricingRules)
          ? doc.runtimePricingRules
          : [...DEFAULT_RUNTIME_PRICING_RULES],
      })
      if (parsed.success) value = parsed.data
    }
  } catch (e) {
    // DB unavailable → fall back to defaults (and don't cache failures for long).
    logger.warn("billing.runtime-config", "failed to load settings, using defaults", {
      message: e instanceof Error ? e.message : String(e),
    })
    cache = { value, at: now - CACHE_TTL_MS + 5_000 } // retry in ~5s, not 30s
    return value
  }

  cache = { value, at: now }
  return value
}

/** Current Collaborate AI costs (DB override layered over code defaults). */
export async function getCollaborateCosts(): Promise<CollaborateCosts> {
  const settings = await loadSettings()
  return settings.collaborate
}

/** Current build tier costs (DB override layered over code defaults). */
export async function getBuildTierCosts(): Promise<BuildTierCosts> {
  const settings = await loadSettings()
  return settings.buildTiers
}

/** Current mirror/crawl pipeline costs (DB override layered over code defaults). */
export async function getMirrorPipelineCosts(): Promise<MirrorPipelineCosts> {
  const settings = await loadSettings()
  return settings.mirrorPipeline
}

/** Current deployment cost (DB override layered over code defaults). */
export async function getDeploymentCosts(): Promise<DeploymentCosts> {
  const settings = await loadSettings()
  return settings.deployment
}

/** Current fork pricing (DB override layered over code defaults). */
export async function getForkPricing(): Promise<ForkPricing> {
  const settings = await loadSettings()
  return settings.forkPricing
}

/** Current infrastructure plan prices (DB override layered over code defaults). */
export async function getInfrastructurePrices(): Promise<InfrastructurePrices> {
  const settings = await loadSettings()
  return settings.infrastructurePrices
}

/** Current reward settings — welcome bonus, referral rewards, milestone
 * threshold (DB override layered over code defaults). */
export async function getRewardSettings(): Promise<Rewards> {
  const settings = await loadSettings()
  return settings.rewards
}

/** Admin-configurable fork pricing for a tier, with a dynamically computed
 * savings percentage relative to the current build cost for that tier. */
export async function getForkPricingForTier(tier: ForkTier): Promise<{
  forkCost: number
  ownerRoyalty: number
  savingsPct: number
}> {
  const [fork, buildTiers] = await Promise.all([getForkPricing(), getBuildTierCosts()])
  const forkCost = tier === "complex" ? fork.complexForkCost : tier === "medium" ? fork.mediumForkCost : fork.simpleForkCost
  const ownerRoyalty = tier === "complex" ? fork.complexOwnerRoyalty : tier === "medium" ? fork.mediumOwnerRoyalty : fork.simpleOwnerRoyalty
  const buildCost = tier === "complex" ? buildTiers.complex : tier === "medium" ? buildTiers.medium : buildTiers.simple
  const savingsPct = buildCost > 0 ? Math.max(0, Math.round((1 - forkCost / buildCost) * 100)) : 0
  return { forkCost, ownerRoyalty, savingsPct }
}

/** Current Runtime API pricing (DB override layered over code defaults).
 * Server-controlled — runtime clients can never influence these values. */
export async function getRuntimePricing(): Promise<RuntimePricing> {
  const settings = await loadSettings()
  return settings.runtimePricing
}

/** Current admin-managed runtime pricing rules (Phase 9.5). Server-controlled
 * — the runtime resolves charges from these rules, never from client input. */
export async function getRuntimePricingRules(): Promise<readonly RuntimePricingRule[]> {
  const settings = await loadSettings()
  return settings.runtimePricingRules
}

/** Persist the full admin-managed runtime pricing rule set (Phase 9.5).
 * The array is validated as a whole and replaced atomically; the caller
 * (admin API) is responsible for authorization and audit logging. */
export async function updateRuntimePricingRules(
  rules: RuntimePricingRule[],
): Promise<readonly RuntimePricingRule[]> {
  const db = await getDb()
  const parsed = z.array(RuntimePricingRuleSchema).max(500).parse(rules)
  await db.collection<SettingsDoc>(SETTINGS_COLLECTION).updateOne(
    { _id: SETTINGS_DOC_ID },
    { $set: { runtimePricingRules: parsed, updatedAt: Date.now() } },
    { upsert: true },
  )
  invalidateBillingSettings()
  return parsed
}

/** Persist billing setting overrides. Passing a section's field sets it;
 * the caller (admin API) is responsible for authorization. */
export async function updateBillingSettings(
  patch: {
    collaborate?: Partial<CollaborateCosts>
    buildTiers?: Partial<BuildTierCosts>
    mirrorPipeline?: Partial<MirrorPipelineCosts>
    deployment?: Partial<DeploymentCosts>
    forkPricing?: Partial<ForkPricing>
    infrastructurePrices?: Partial<InfrastructurePrices>
    rewards?: Partial<Rewards>
    runtimePricing?: Partial<RuntimePricing>
  },
): Promise<BillingSettings> {
  const db = await getDb()
  const current = await loadSettings()
  const merged = BillingSettingsSchema.parse({
    collaborate: { ...current.collaborate, ...(patch.collaborate ?? {}) },
    buildTiers: { ...current.buildTiers, ...(patch.buildTiers ?? {}) },
    mirrorPipeline: { ...current.mirrorPipeline, ...(patch.mirrorPipeline ?? {}) },
    deployment: { ...current.deployment, ...(patch.deployment ?? {}) },
    forkPricing: { ...current.forkPricing, ...(patch.forkPricing ?? {}) },
    infrastructurePrices: { ...current.infrastructurePrices, ...(patch.infrastructurePrices ?? {}) },
    rewards: { ...current.rewards, ...(patch.rewards ?? {}) },
    runtimePricing: { ...current.runtimePricing, ...(patch.runtimePricing ?? {}) },
  })

  await db.collection<SettingsDoc>(SETTINGS_COLLECTION).updateOne(
    { _id: SETTINGS_DOC_ID },
    { $set: { ...merged, updatedAt: Date.now() } },
    { upsert: true },
  )
  invalidateBillingSettings()

  logger.info("billing.runtime-config", "settings updated", { patch })
  return merged
}
