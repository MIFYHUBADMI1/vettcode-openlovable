import { store, cryptoId } from "@/lib/store/store"
import { consumeCredits, getAvailableCredits } from "@/lib/billing/credit-service"
import { logger } from "@/lib/logging/logger"

/**
 * Credit costs for the Collaborate AI Co-Founder workspace.
 *
 * Uses the EXISTING credit infrastructure (credit-service double-entry
 * ledger via `consumeCredits`) — no new billing system. Charges are small
 * and applied only when real AI work is performed, never on page load
 * (spec sections 15 & 29). Cached analyses are re-read for free.
 */

export const COLLABORATE_CHAT_COST = 2
export const COLLABORATE_ANALYZE_COST = 10

/** Charge for one co-founder chat exchange. Returns false when the user
 * cannot afford it — callers must respond with INSUFFICIENT_CREDITS. */
export async function chargeChatCredits(userId: string, projectId: string): Promise<boolean> {
  return chargeCollaboration(userId, projectId, COLLABORATE_CHAT_COST, "AI co-founder chat message")
}

/** Charge for a full plan analysis. */
export async function chargeAnalysisCredits(userId: string, projectId: string): Promise<boolean> {
  return chargeCollaboration(userId, projectId, COLLABORATE_ANALYZE_COST, "AI plan analysis")
}

async function chargeCollaboration(userId: string, projectId: string, amount: number, reason: string): Promise<boolean> {
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
