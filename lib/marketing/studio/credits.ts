import "server-only"

/**
 * Marketing Studio credit accounting (Phase 4 — W3).
 *
 * Mirrors the SEO audit pair exactly — reuses the SHARED double-entry credit
 * service (`lib/billing/credit-service`) with a project-attributable ledger
 * reference, so the Growth Overview's existing `creditsConsumedByProject` metric
 * already accounts for Studio generations with no change. Charges are taken only
 * when a real generation is about to run (never on page view / list) and are
 * refunded on failure. A stable `intentKey` (the approved pending-action id)
 * makes the charge idempotent across retries — the same discipline
 * `collaborate-credits.ts` uses, deliberately NOT a fresh random key.
 */

import { consumeCredits, grantCredits, getAvailableCredits } from "@/lib/billing/credit-service"
import { cryptoId } from "@/lib/store/store"
import { logger } from "@/lib/logging/logger"

/**
 * Default credit cost for one bounded marketing-copy generation. Overridable via
 * STUDIO_CREDIT_COST (integer ≥ 0; 0 makes it free and skips the ledger). Kept as
 * a local knob rather than editing the shared billing-settings schema, so this
 * phase touches no unrelated billing logic.
 */
export function getStudioCost(): number {
  const raw = process.env.STUDIO_CREDIT_COST
  if (raw === undefined) return 10
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return 10
  return parsed
}

export async function getStudioAffordability(userId: string): Promise<{ cost: number; available: number; affordable: boolean }> {
  const cost = getStudioCost()
  const available = await getAvailableCredits(userId)
  return { cost, available, affordable: cost <= 0 || available >= cost }
}

/**
 * Charge for one generation. `intentKey` — when provided (e.g. the approved
 * pending-action id) — becomes the ledger idempotency key so a retried execution
 * of the SAME approval cannot double-charge. Returns false when the user cannot
 * afford it — the caller must respond INSUFFICIENT_CREDITS and not generate.
 */
export async function chargeStudioCredits(userId: string, projectId: string, intentKey?: string): Promise<boolean> {
  const amount = getStudioCost()
  if (amount <= 0) {
    logger.info("credits.studio", "charge skipped (zero cost configured)", { userId, projectId })
    return true
  }
  const available = await getAvailableCredits(userId)
  if (available < amount) {
    logger.warn("credits.studio", "insufficient credits", { userId, amount, available })
    return false
  }
  const result = await consumeCredits({
    userId,
    amount,
    transactionType: "ai_collaboration",
    idempotencyKey: intentKey ? `studio_${intentKey}` : cryptoId(),
    referenceType: "project",
    referenceId: projectId,
    metadata: { reason: "Marketing Studio copy generation", feature: "marketing_studio" },
  })
  if (!result.success) {
    logger.warn("credits.studio", "consume failed", { userId, amount })
    return false
  }
  logger.info("credits.studio", "charged", { userId, projectId, amount })
  return true
}

/** Best-effort refund after a charged generation failed. Never throws — a failed
 * refund must not mask the original generation error. */
export async function refundStudioCredits(userId: string, projectId: string): Promise<void> {
  const amount = getStudioCost()
  if (amount <= 0) return
  try {
    await grantCredits({
      userId,
      creditType: "permanent",
      amount,
      transactionType: "other_reversal",
      idempotencyKey: `studio_refund_${cryptoId()}`,
      referenceType: "project",
      referenceId: projectId,
      metadata: { reason: "Marketing Studio generation failed — automatic refund", feature: "marketing_studio" },
    })
    logger.info("credits.studio", "refunded after failure", { userId, projectId, amount })
  } catch (e) {
    logger.warn("credits.studio", "refund failed", {
      userId,
      projectId,
      message: e instanceof Error ? e.message : String(e),
    })
  }
}
