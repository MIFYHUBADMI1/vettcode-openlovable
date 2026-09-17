import { store, cryptoId } from "@/lib/store/store"
import { consumeCredits, getAvailableCredits } from "@/lib/billing/credit-service"
import { getCollaborateCosts } from "@/lib/billing/runtime-config"
import { logger } from "@/lib/logging/logger"

/**
 * Credit costs for the Collaborate AI Co-Founder workspace.
 *
 * Uses the EXISTING credit infrastructure (credit-service double-entry
 * ledger via `consumeCredits`) — no new billing system. Charges are small
 * and applied only when real AI work is performed, never on page load.
 * Amounts come from the admin-configurable runtime settings
 * (lib/billing/runtime-config.ts) and fall back to code defaults if the
 * settings collection is unavailable.
 *
 * Cached analyses are re-read for free; only fresh AI work is charged.
 */

export const DEFAULT_CHAT_COST = 2
export const DEFAULT_ANALYZE_COST = 10

/** Charge for one co-founder chat exchange. Returns false when the user
 * cannot afford it — callers must respond with INSUFFICIENT_CREDITS. */
export async function chargeChatCredits(userId: string, projectId: string): Promise<boolean> {
  const costs = await getCollaborateCosts()
  return chargeCollaboration(userId, projectId, costs.chatMessageCost, "AI co-founder chat message")
}

/** Charge for a full plan analysis. */
export async function chargeAnalysisCredits(userId: string, projectId: string): Promise<boolean> {
  const costs = await getCollaborateCosts()
  return chargeCollaboration(userId, projectId, costs.planAnalysisCost, "AI plan analysis")
}

async function chargeCollaboration(userId: string, projectId: string, amount: number, reason: string): Promise<boolean> {
  // A configured cost of 0 means the feature is free — skip the ledger entirely.
  if (amount <= 0) {
    logger.info("credits.collaborate", "charge skipped (zero cost configured)", { userId, reason })
    return true
  }

  const available = await getAvailableCredits(userId)
  if (available < amount) {
    logger.warn("credits.collaborate", "insufficient credits", { userId, amount, available })
    return false
  }
  const result = await consumeCredits({
    userId,
    amount,
    transactionType: "ai_collaboration",
    idempotencyKey: cryptoId(),
    referenceType: "project",
    referenceId: projectId,
    metadata: { reason, feature: "collaborate" },
  })
  if (!result.success) {
    logger.warn("credits.collaborate", "consume failed", { userId, amount })
    return false
  }
  logger.info("credits.collaborate", "charged", { userId, projectId, amount, reason })
  return true
}
