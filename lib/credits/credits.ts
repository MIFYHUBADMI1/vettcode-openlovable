import { store, cryptoId } from "@/lib/store/store"
import { logger } from "@/lib/logging/logger"

/**
 * MirrorSite credit system (spec sections 22 & 23). MirrorSite bills users in
 * its own credits with margin over provider (Totalum/Firecrawl) usage. Totalum
 * agent runs are usage-based (documented ~10–40 dev credits per prompt), so we
 * never hard-code a fixed cost — we estimate a reservation with margin, then
 * reconcile against actual usage and refund the difference.
 */

// Margin multiplier applied on top of provider credits to cover Firecrawl,
// infrastructure, payment fees and unexpected usage.
const MARGIN = 1.5

export interface CostEstimate {
  // MirrorSite credits reserved for the operation.
  reserve: number
  // Human-readable estimate range for display.
  low: number
  high: number
  basis: string
}

/** Estimate MirrorSite cost for an initial website build. */
export function estimateInitialBuild(providerHigh = 40): CostEstimate {
  const high = Math.ceil(providerHigh * MARGIN) + 10 // +10 covers Firecrawl analysis
  const low = Math.ceil(10 * MARGIN) + 10
  return { reserve: high, low, high, basis: "Website analysis + initial full-stack build" }
}

/** Estimate MirrorSite cost for a follow-up agent prompt. */
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

/** Return the credit cost for a given complexity tier. */
export function getTierCost(tier: string): number {
  return TIER_COSTS[tier] ?? TIER_COSTS.medium
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

export const SCRAPE_COST = 5
export const PLAN_COST = 5

/** Charge a user for a successful website scrape. */
export async function chargeScrapeCredits(userId: string, projectId: string) {
  await store.addTransaction({
    id: cryptoId(),
    userId,
    type: "consume",
    amount: -SCRAPE_COST,
    reason: "Website scrape",
    createdAt: Date.now(),
  })
  logger.info("credits.scrape", "charged", { userId, projectId, amount: SCRAPE_COST })
}

/** Charge a user for a successful plan/specification generation. */
export async function chargePlanCredits(userId: string, projectId: string) {
  await store.addTransaction({
    id: cryptoId(),
    userId,
    type: "consume",
    amount: -PLAN_COST,
    reason: "Plan generation",
    createdAt: Date.now(),
  })
  logger.info("credits.plan", "charged", { userId, projectId, amount: PLAN_COST })
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
