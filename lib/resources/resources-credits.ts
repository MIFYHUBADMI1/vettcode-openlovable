import { consumeCredits, grantCredits, getAvailableCredits } from "@/lib/billing/credit-service"
import { cryptoId } from "@/lib/store/store"
import { logger } from "@/lib/logging/logger"
import { RESOURCES_CREDIT_COSTS, type ResourcesAIOperation } from "./credit-costs"

// Re-exported for existing server-side callers; Client Components must import
// the client-safe ./credit-costs module directly.
export { RESOURCES_CREDIT_COSTS, type ResourcesAIOperation }

async function chargeResources(
  userId: string,
  projectId: string,
  operation: ResourcesAIOperation,
): Promise<boolean> {
  const amount = RESOURCES_CREDIT_COSTS[operation]
  if (amount <= 0) return true

  const available = await getAvailableCredits(userId)
  if (available < amount) {
    logger.warn("credits.resources", "insufficient credits", { userId, operation, amount, available })
    return false
  }

  const result = await consumeCredits({
    userId,
    amount,
    transactionType: "ai_collaboration",
    idempotencyKey: cryptoId(),
    referenceType: "project",
    referenceId: projectId,
    metadata: { feature: "resources", operation },
  })

  logger.info("credits.resources", "charged", { userId, projectId, operation, amount, success: result.success })
  return result.success
}

export async function chargeActionPlan(userId: string, projectId: string) {
  return chargeResources(userId, projectId, "actionPlan")
}
export async function chargeMarketResearch(userId: string, projectId: string) {
  return chargeResources(userId, projectId, "marketResearch")
}
export async function chargeCompetitors(userId: string, projectId: string) {
  return chargeResources(userId, projectId, "competitors")
}
export async function chargeMarketingPlaybook(userId: string, projectId: string) {
  return chargeResources(userId, projectId, "marketingPlaybook")
}

export async function refundResources(
  userId: string,
  projectId: string,
  operation: ResourcesAIOperation,
): Promise<void> {
  try {
    const amount = RESOURCES_CREDIT_COSTS[operation]
    if (amount <= 0) return
    await grantCredits({
      userId,
      creditType: "permanent",
      amount,
      transactionType: "other_reversal",
      idempotencyKey: `resources_refund_${cryptoId()}`,
      referenceType: "project",
      referenceId: projectId,
      metadata: { feature: "resources", operation, reason: "AI call failed — automatic refund" },
    })
  } catch (e) {
    logger.warn("credits.resources", "refund failed", { userId, projectId, operation, message: e instanceof Error ? e.message : String(e) })
  }
}
