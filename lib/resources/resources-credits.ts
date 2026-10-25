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
  /**
   * Phase 3 (Workstream C): stable server-scoped operation identity (see
   * `lib/billing/operation-identity`). When present the charge key becomes
   * `resources_${intentKey}` so a retried generation of the SAME logical
   * operation is a recognized no-op instead of a second debit; when absent
   * the previous per-attempt key is kept. Never authorization — routes pass
   * only a value already validated and scoped to this user + project.
   */
  intentKey?: string,
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
    idempotencyKey: intentKey ? `resources_${intentKey}` : cryptoId(),
    referenceType: "project",
    referenceId: projectId,
    // First-class project attribution (Phase 2) — server-validated project
    // from the route's ownership gate, never a client guess.
    projectId,
    metadata: { feature: "resources", operation },
  })

  logger.info("credits.resources", "charged", { userId, projectId, operation, amount, success: result.success })
  return result.success
}

export async function chargeActionPlan(userId: string, projectId: string, intentKey?: string) {
  return chargeResources(userId, projectId, "actionPlan", intentKey)
}
export async function chargeMarketResearch(userId: string, projectId: string, intentKey?: string) {
  return chargeResources(userId, projectId, "marketResearch", intentKey)
}
export async function chargeCompetitors(userId: string, projectId: string, intentKey?: string) {
  return chargeResources(userId, projectId, "competitors", intentKey)
}
export async function chargeMarketingPlaybook(userId: string, projectId: string, intentKey?: string) {
  return chargeResources(userId, projectId, "marketingPlaybook", intentKey)
}

export async function refundResources(
  userId: string,
  projectId: string,
  operation: ResourcesAIOperation,
  /** Pass the SAME intent key used to charge and the reversal key becomes
   * deterministic (`resources_${intentKey}_refund`), so a retried failure path
   * cannot refund the same generation twice. */
  intentKey?: string,
): Promise<void> {
  try {
    const amount = RESOURCES_CREDIT_COSTS[operation]
    if (amount <= 0) return
    await grantCredits({
      userId,
      creditType: "permanent",
      amount,
      transactionType: "other_reversal",
      idempotencyKey: intentKey ? `resources_${intentKey}_refund` : `resources_refund_${cryptoId()}`,
      referenceType: "project",
      referenceId: projectId,
      // First-class project attribution (Phase 2) — mirrors the charge.
      projectId,
      metadata: { feature: "resources", operation, reason: "AI call failed — automatic refund" },
    })
  } catch (e) {
    logger.warn("credits.resources", "refund failed", { userId, projectId, operation, message: e instanceof Error ? e.message : String(e) })
  }
}
