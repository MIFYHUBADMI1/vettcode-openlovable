import "server-only"

/**
 * SEO audit credit accounting (Phase 3 — W2).
 *
 * Reuses the EXISTING double-entry credit service exactly like the Collaborate
 * workspace does (`lib/analysis/collaborate-credits.ts`) — no new billing
 * system, no new balance fields. Charges are taken only when a real crawl is
 * about to run, never on page view, and are refunded on failure. Ledger entries
 * carry `referenceType: "project"` so the Growth Overview's existing
 * project-credit metric already accounts for them with no change.
 */

import { consumeCredits, grantCredits, getAvailableCredits } from "@/lib/billing/credit-service"
import { cryptoId } from "@/lib/store/store"
import { logger } from "@/lib/logging/logger"

/**
 * Default credit cost for one bounded SEO audit. Overridable via
 * SEO_AUDIT_CREDIT_COST (integer ≥ 0; 0 makes the feature free and skips the
 * ledger entirely). Kept as a local knob rather than editing the shared billing
 * settings schema, so this phase touches no unrelated billing logic.
 */
export function getSeoAuditCost(): number {
  const raw = process.env.SEO_AUDIT_CREDIT_COST
  if (raw === undefined) return 15
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return 15
  return parsed
}

export async function getSeoAuditAffordability(userId: string): Promise<{ cost: number; available: number; affordable: boolean }> {
  const cost = getSeoAuditCost()
  const available = await getAvailableCredits(userId)
  return { cost, available, affordable: cost <= 0 || available >= cost }
}

/** Charge for one audit. Returns false when the user cannot afford it — the
 * caller must respond INSUFFICIENT_CREDITS and not run the crawl. */
export async function chargeSeoAuditCredits(userId: string, projectId: string): Promise<boolean> {
  const amount = getSeoAuditCost()
  if (amount <= 0) {
    logger.info("credits.seo", "charge skipped (zero cost configured)", { userId, projectId })
    return true
  }
  const available = await getAvailableCredits(userId)
  if (available < amount) {
    logger.warn("credits.seo", "insufficient credits", { userId, amount, available })
    return false
  }
  const result = await consumeCredits({
    userId,
    amount,
    transactionType: "ai_collaboration",
    idempotencyKey: cryptoId(),
    referenceType: "project",
    referenceId: projectId,
    metadata: { reason: "SEO visibility audit", feature: "seo_audit" },
  })
  if (!result.success) {
    logger.warn("credits.seo", "consume failed", { userId, amount })
    return false
  }
  logger.info("credits.seo", "charged", { userId, projectId, amount })
  return true
}

/** Best-effort refund after a charged crawl failed. Never throws — a failed
 * refund must not mask the original crawl error. */
export async function refundSeoAuditCredits(userId: string, projectId: string): Promise<void> {
  const amount = getSeoAuditCost()
  if (amount <= 0) return
  try {
    await grantCredits({
      userId,
      creditType: "permanent",
      amount,
      transactionType: "other_reversal",
      idempotencyKey: `seo_refund_${cryptoId()}`,
      referenceType: "project",
      referenceId: projectId,
      metadata: { reason: "SEO audit failed — automatic refund", feature: "seo_audit" },
    })
    logger.info("credits.seo", "refunded after failure", { userId, projectId, amount })
  } catch (e) {
    logger.warn("credits.seo", "refund failed", {
      userId,
      projectId,
      message: e instanceof Error ? e.message : String(e),
    })
  }
}
