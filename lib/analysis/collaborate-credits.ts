import { store, cryptoId } from "@/lib/store/store"
import { consumeCredits, grantCredits, getAvailableCredits } from "@/lib/billing/credit-service"
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

/** Charge for one auto-completed plan section. Returns false when the user
 * cannot afford it — callers must stop the run and report INSUFFICIENT_CREDITS. */
export async function chargeAutoCompleteCredits(userId: string, projectId: string): Promise<boolean> {
  const costs = await getCollaborateCosts()
  return chargeCollaboration(userId, projectId, costs.autoCompleteSectionCost, "AI co-founder auto-complete section")
}

/** Best-effort refund when the AI work itself failed after the charge was
 * taken. Never throws — a failed refund must not mask the original AI error.
 * Zero-cost configurations are a no-op (nothing was charged). */
export async function refundCollaboration(
  userId: string,
  projectId: string,
  kind: "chat" | "analysis" | "auto-complete",
): Promise<void> {
  try {
    const costs = await getCollaborateCosts()
    const amount = kind === "chat" ? costs.chatMessageCost : kind === "analysis" ? costs.planAnalysisCost : costs.autoCompleteSectionCost
    if (amount <= 0) return
    await grantCredits({
      userId,
      creditType: "permanent",
      amount,
      transactionType: "other_reversal",
      idempotencyKey: `collab_refund_${cryptoId()}`,
      referenceType: "project",
      referenceId: projectId,
      metadata: {
        reason:
          kind === "chat"
            ? "AI chat failed — automatic refund"
            : kind === "analysis"
              ? "AI plan analysis failed — automatic refund"
              : "AI auto-complete section failed — automatic refund",
        feature: "collaborate",
      },
    })
    logger.info("credits.collaborate", "refunded after AI failure", { userId, projectId, kind, amount })
  } catch (e) {
    logger.warn("credits.collaborate", "refund failed", {
      userId,
      projectId,
      kind,
      message: e instanceof Error ? e.message : String(e),
    })
  }
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
