import { requireAdmin } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { logger } from "@/lib/logging/logger"
import {
  getRecoveryQueueStats,
  runRecoveryBatch,
  MAX_BATCH_LIMIT,
} from "@/lib/billing/webhook-recovery"

export const runtime = "nodejs"

/**
 * Atai Finance — Phase 3 webhook recovery operator surface (Workstreams B + G).
 *
 * GET  → read-only queue health: counts by state, how many are eligible right
 *        now, oldest eligible age, next scheduled attempt. Lets an operator
 *        distinguish retryable backlog from items parked in `manual_review`.
 * POST → run ONE bounded recovery batch through the SAME idempotent processing
 *        the live webhook uses (lib/billing/webhook-recovery). No bulk rewrite
 *        of historical financial records — recovery only applies the missing,
 *        valid, idempotent operation per event.
 *
 * Authorization: requireAdmin() (403 otherwise), matching the repo's existing
 * admin convention. CSRF: same SameSite=lax httpOnly session cookie posture as
 * every other admin mutation route here (no separate token precedent).
 * Nothing here self-fires — the repository has no cron/job substrate, so a
 * batch runs only when an authorized operator triggers it.
 */

function currentNow(): number {
  return Date.now()
}

export async function GET() {
  try {
    await requireAdmin()
    const stats = await getRecoveryQueueStats(currentNow())
    return ok({ stats })
  } catch (e) {
    return handleRouteError("api.admin.billing.webhooks.get", e)
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()

    // Bounded, validated batch size. Default 10; hard cap MAX_BATCH_LIMIT.
    // Accepts a JSON body { limit } or a ?limit= query param.
    let limit = 10
    const raw =
      (await req.json().catch(() => null)) as { limit?: unknown } | null
    const rawLimit =
      raw?.limit ?? new URL(req.url).searchParams.get("limit")
    if (rawLimit !== undefined && rawLimit !== null) {
      const parsed = Number(rawLimit)
      if (!Number.isFinite(parsed) || parsed < 1) {
        return fail("VALIDATION", "limit must be a positive integer.", 400)
      }
      limit = Math.min(Math.floor(parsed), MAX_BATCH_LIMIT)
    }

    const result = await runRecoveryBatch({ limit, now: currentNow() })

    // Record the operator + outcome (bounded, secret-free audit line). Never
    // log payloads, payment credentials, or personal data.
    logger.info("admin.billing.webhooks.recovery", "operator ran recovery batch", {
      adminId: admin.id,
      limit,
      processed: result.processed,
      resolved: result.resolved,
      stillPending: result.stillPending,
      escalatedToManualReview: result.escalatedToManualReview,
      hasMore: result.hasMore,
    })

    return ok({ result })
  } catch (e) {
    return handleRouteError("api.admin.billing.webhooks.post", e)
  }
}
