import "server-only"
import { topupsCol } from "@/lib/db/collections"
import type { TopUpDoc } from "@/lib/types/db"

/**
 * Atai — Legacy Top-Up Read Service (historical records only)
 * ============================================================
 *
 * The Mobile Money (MTN/Airtel) gateway is DISCONTINUED — Dodo Payments is
 * the sole supported payment method. All write paths (createTopUp,
 * uploadEvidence, awardCredits, rejectTopUp) have been removed so no code
 * path can grant credits through the legacy gateway.
 *
 * What remains here is read-only access to historical `topups` documents,
 * preserved for auditing, reconciliation, legal obligations, and user
 * support. These helpers never mutate records and never grant credits.
 *
 * @module lib/billing/topup-service
 */

// ─── Get Top-Up ──────────────────────────────────────────────────────────────

export async function getTopUp(topUpId: string, userId?: string): Promise<TopUpDoc | null> {
  const col = await topupsCol()
  if (userId && userId !== "any") {
    return col.findOne({ id: topUpId, userId })
  }
  return col.findOne({ id: topUpId })
}

// ─── List User Top-Ups ──────────────────────────────────────────────────────

export async function listUserTopUps(userId: string, limit = 20): Promise<TopUpDoc[]> {
  const col = await topupsCol()
  return col.find({ userId }).sort({ createdAt: -1 }).limit(limit).toArray()
}

// ─── Admin: List Historical Top-Ups ─────────────────────────────────────────

/**
 * Read-only listing of historical top-ups that were left mid-flow when the
 * gateway was discontinued. They can never be approved or grant credits —
 * retained for admin audit and support only.
 */
export async function listPendingTopUps(limit = 50): Promise<TopUpDoc[]> {
  const col = await topupsCol()
  return col
    .find({ status: { $in: ["payment_submitted", "analyzing", "manual_review"] } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray()
}
