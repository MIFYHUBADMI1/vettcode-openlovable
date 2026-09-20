import { store, cryptoId } from "@/lib/store/store"
import { logger } from "@/lib/logging/logger"
import { getBuildTierCosts, getMirrorPipelineCosts, DEFAULT_MIRROR_PIPELINE_COSTS } from "@/lib/billing/runtime-config"

/**
 * Atai Credit system (spec sections 22 & 23). Atai bills users in
 * its own credits with margin over provider (Totalum/Firecrawl) usage. Totalum
 * agent runs are usage-based (documented ~10–40 dev credits per prompt), so we
 * never hard-code a fixed cost — we estimate a reservation with margin, then
 * reconcile against actual usage and refund the difference.
 */

// Margin multiplier applied on top of provider credits to cover Firecrawl,
// infrastructure, payment fees and unexpected usage.
const MARGIN = 1.5

export interface CostEstimate {
  // Atai Credits reserved for the operation.
  reserve: number
  // Human-readable estimate range for display.
  low: number
  high: number
  basis: string
}

/** Estimate Atai cost for an initial website build. */
export function estimateInitialBuild(providerHigh = 40): CostEstimate {
  const high = Math.ceil(providerHigh * MARGIN) + 10 // +10 covers Firecrawl analysis
  const low = Math.ceil(10 * MARGIN) + 10
  return { reserve: high, low, high, basis: "Website analysis + initial full-stack build" }
}

/** Estimate Atai cost for a follow-up agent prompt. */
export function estimateFollowup(providerHigh = 40): CostEstimate {
  const high = Math.ceil(providerHigh * MARGIN)
  const low = Math.ceil(10 * MARGIN)
  return { reserve: high, low, high, basis: "AI development prompt" }
}

/** Tier-based credit costs matching the pricing page. */
const TIER_COSTS: Record<string, number> = {
  simple: 25000,
  medium: 50000,
  complex: 75000,
}

/** Heavy mode tier costs — higher due to admin dashboards, user management, analytics, and comprehensive SaaS features. */
const HEAVY_TIER_COSTS: Record<string, number> = {
  simple: 50000,
  medium: 75000,
  complex: 100000,
}

/**
 * Return the credit cost for a given complexity tier and pipeline mode.
 * Reads the admin-configurable runtime override (lib/billing/runtime-config.ts):
 * legacy mode uses the build-tier costs, heavy mode scales them ×1.5 (matching
 * the legacy/heavy default ratio and keeping heavy pricier without its own
 * separate admin knobs).
 */
export async function getTierCost(tier: string, pipelineMode?: "legacy" | "heavy"): Promise<number> {
  const tiers = await getBuildTierCosts()
  const base = tier === "simple" ? tiers.simple : tier === "complex" ? tiers.complex : tiers.medium
  if (pipelineMode === "heavy") {
    const heavyDefault = HEAVY_TIER_COSTS[tier] ?? HEAVY_TIER_COSTS.medium
    const legacyDefault = TIER_COSTS[tier] ?? TIER_COSTS.medium
    const heavyScale = heavyDefault / legacyDefault
    return Math.round(base * heavyScale)
  }
  return base
}

/**
 * Classify a specification into a complexity tier based on its features,
 * data entities, integrations, and core flows. Used when the spec doesn't
 * already have a pre-set complexity value.
 */
export function classifyComplexity(spec: {
  suggestedFeatures?: { enabled?: boolean }[]
  dataEntities?: unknown[]
  integrations?: string[]
  coreFlows?: unknown[]
  backendRequirements?: string[]
}): "simple" | "medium" | "complex" {
  let score = 0
  const enabledFeatures = (spec.suggestedFeatures ?? []).filter((f) => f.enabled).length
  score += enabledFeatures * 2
  score += (spec.dataEntities ?? []).length
  score += (spec.integrations ?? []).length * 3
  score += (spec.coreFlows ?? []).length
  score += (spec.backendRequirements ?? []).length
  if (score <= 6) return "simple"
  if (score <= 14) return "medium"
  return "complex"
}

// Legacy mode costs (unchanged)
export const SCRAPE_COST = DEFAULT_MIRROR_PIPELINE_COSTS.scrapeCost
export const PLAN_COST = DEFAULT_MIRROR_PIPELINE_COSTS.planCost
export const DEEP_CRAWL_COST = DEFAULT_MIRROR_PIPELINE_COSTS.deepCrawlCost

// Heavy mode costs (20x increase for scrape/plan)
export const HEAVY_SCRAPE_COST = DEFAULT_MIRROR_PIPELINE_COSTS.heavyScrapeCost
export const HEAVY_PLAN_COST = DEFAULT_MIRROR_PIPELINE_COSTS.heavyPlanCost

// Deep crawl heavy mode cost (total: 1000 credits = 500 base + 500 heavy pipeline)
export const DEEP_CRAWL_HEAVY_COST = DEFAULT_MIRROR_PIPELINE_COSTS.heavyDeepCrawlCost

/**
 * Get scrape cost based on pipeline mode.
 * Reads the admin-configurable runtime override (lib/billing/runtime-config.ts),
 * falling back to the code defaults above when the settings store is unavailable.
 */
export async function getScrapeCost(pipelineMode?: "legacy" | "heavy"): Promise<number> {
  const costs = await getMirrorPipelineCosts()
  return pipelineMode === "heavy" ? costs.heavyScrapeCost : costs.scrapeCost
}

/** Get plan cost based on pipeline mode (admin-configurable). */
export async function getPlanCost(pipelineMode?: "legacy" | "heavy"): Promise<number> {
  const costs = await getMirrorPipelineCosts()
  return pipelineMode === "heavy" ? costs.heavyPlanCost : costs.planCost
}

/** Get deep crawl cost based on pipeline mode (admin-configurable). */
export async function getDeepCrawlCost(pipelineMode?: "legacy" | "heavy"): Promise<number> {
  const costs = await getMirrorPipelineCosts()
  return pipelineMode === "heavy" ? costs.heavyDeepCrawlCost : costs.deepCrawlCost
}

/** Charge a user for a successful website scrape. */
export async function chargeScrapeCredits(userId: string, projectId: string, pipelineMode?: "legacy" | "heavy") {
  const cost = await getScrapeCost(pipelineMode)
  const modeLabel = pipelineMode === "heavy" ? "Heavy mode" : "Legacy mode"
  await store.addTransaction({
    id: cryptoId(),
    userId,
    type: "consume",
    amount: -cost,
    reason: `Website scrape (${modeLabel})`,
    createdAt: Date.now(),
  })
  logger.info("credits.scrape", "charged", { userId, projectId, amount: cost, mode: pipelineMode ?? "legacy" })
}

/** Charge a user for a deep crawl (full-site exact replica mode). */
export async function chargeDeepCrawlCredits(userId: string, projectId: string, pipelineMode?: "legacy" | "heavy") {
  const cost = await getDeepCrawlCost(pipelineMode)
  const modeLabel = pipelineMode === "heavy" ? "Heavy mode" : "Legacy mode"
  await store.addTransaction({
    id: cryptoId(),
    userId,
    type: "consume",
    amount: -cost,
    reason: `Deep crawl — full site replica (${modeLabel})`,
    createdAt: Date.now(),
  })
  logger.info("credits.deepCrawl", "charged", { userId, projectId, amount: cost, mode: pipelineMode ?? "legacy" })
}

/** Charge a user for a successful plan/specification generation. */
export async function chargePlanCredits(userId: string, projectId: string, pipelineMode?: "legacy" | "heavy") {
  const cost = await getPlanCost(pipelineMode)
  const modeLabel = pipelineMode === "heavy" ? "Heavy mode" : "Legacy mode"
  await store.addTransaction({
    id: cryptoId(),
    userId,
    type: "consume",
    amount: -cost,
    reason: `Plan generation (${modeLabel})`,
    createdAt: Date.now(),
  })
  logger.info("credits.plan", "charged", { userId, projectId, amount: cost, mode: pipelineMode ?? "legacy" })
}

export async function getBalance(userId: string) {
  return store.getBalance(userId)
}

export async function hasSufficientCredits(userId: string, amount: number) {
  const balance = await store.getBalance(userId)
  return balance >= amount
}

/** Reserve credits before launching a provider operation. Returns false when
 * the user cannot afford it. The balance check and debit happen as a single
 * atomic store operation (`reserveCreditsAtomic`) so two concurrent
 * reservations for the same user can never both pass a stale balance check
 * and overdraft the account. */
export async function reserveCredits(userId: string, amount: number, buildRunId: string, reason: string) {
  const reserved = await store.reserveCreditsAtomic(userId, amount, {
    id: cryptoId(),
    userId,
    type: "reserve",
    amount: -amount,
    reason,
    buildRunId,
    createdAt: Date.now(),
  })
  if (!reserved) {
    logger.warn("credits.reserve", "insufficient credits", { userId, amount })
    return false
  }
  logger.info("credits.reserve", "reserved", { userId, amount, buildRunId })
  return true
}

/**
 * Reconcile a reserved operation against actual usage.
 * - If actual < reserved: refund the difference.
 * - If actual > reserved: charge the extra (down to a floor of the reservation).
 * The reservation already debited the balance, so we only adjust the delta.
 */
export async function reconcileCredits(
  userId: string,
  reserved: number,
  actual: number,
  buildRunId: string,
) {
  const delta = reserved - actual // positive => refund to user
  if (delta === 0) return
  await store.addTransaction({
    id: cryptoId(),
    userId,
    type: delta > 0 ? "refund" : "consume",
    amount: delta, // positive refunds, negative charges more
    reason: delta > 0 ? "Refund of unused reservation" : "Additional usage",
    buildRunId,
    createdAt: Date.now(),
  })
  logger.info("credits.reconcile", "reconciled", { userId, reserved, actual, delta, buildRunId })
}

/** Full refund when an operation fails before consuming provider resources. */
export async function refundReservation(userId: string, amount: number, buildRunId: string) {
  await store.addTransaction({
    id: cryptoId(),
    userId,
    type: "refund",
    amount,
    reason: "Refund — operation failed",
    buildRunId,
    createdAt: Date.now(),
  })
  logger.info("credits.refund", "refunded failed op", { userId, amount, buildRunId })
}
