import { webhookEventsCol } from "@/lib/db/collections"
import { processDodoEvent, REPROCESSABLE_EVENT_TYPES } from "@/lib/billing/dodo-event-processing"
// Re-exported for the reconciliation service (`lib/finances/reconciliation.ts`),
// which shares the same eligibility vocabulary — one definition, never a copy.
export { REPROCESSABLE_EVENT_TYPES }
import { logger } from "@/lib/logging/logger"
import type { WebhookEventDoc } from "@/lib/types/db"

/**
 * Atai Finance — Phase 3 durable webhook recovery (Workstream B).
 *
 * Failed and unresolved Dodo events are discoverable and safely recoverable:
 * this worker re-runs them through the SAME idempotent business logic as the
 * live webhook route (`lib/billing/dodo-event-processing`). There is no
 * second, weaker replay path.
 *
 * ── Why replays are safe (the guarantees rest on these facts) ───────────
 *
 *  - Every financial effect inside a handler is keyed on a stable business
 *    id (payment_/refund_/sub_grant_…); the unique credit_ledger idempotency
 *    index makes a re-applied effect a recognized no-op (success = already
 *    applied) — so "crashed after the ledger write, before the status
 *    update" replays cannot double-grant.
 *  - Events in this queue were persisted ONLY after signature verification,
 *    so provenance is authoritative (payload + payloadHash preserved);
 *    recovery does not re-trust anything external.
 *  - Claiming uses findOneAndUpdate (atomic): two workers can never hold the
 *    same event. A worker that dies mid-attempt leaves status "processing",
 *    which becomes re-claimable after the lease window — nothing is lost.
 *  - "Never blindly replay just because status is failed": eligibility also
 *    requires the event TYPE to be in REPROCESSABLE_EVENT_TYPES and the
 *    attempt budget to be unexhausted; the handler then reconciles against
 *    CURRENT financial state and only the missing, valid, idempotent
 *    operation is applied (e.g. a refund that arrived before its payment is
 *    unresolved; it resolves once the payment row exists, and grants nothing
 *    if attribution is still absent).
 *  - Events that cannot be resolved automatically reach the terminal
 *    `manual_review` state after the attempt budget — retryable vs
 *    needs-a-human stays distinguishable to operators.
 *
 * Scheduling boundary (honest): this repository has NO job substrate/cron
 * runtime (documented since Phase 0), so batches are executed by an authorized
 * operator via `app/api/admin/billing/webhooks/route.ts` (requireAdmin) or by
 * whatever scheduler is introduced when one exists. Nothing here self-fires.
 *
 * @module lib/billing/webhook-recovery
 */

const MINUTE = 60_000
const HOUR = 60 * MINUTE

/** Attempt budget per event (live delivery counts as attempt 1). */
export const MAX_ATTEMPTS = 6
/** Backoff: 5 min, 20 min, 80 min, 5.3 h, 21.3 h (capped at 24 h). */
const BASE_BACKOFF_MS = 5 * MINUTE
const MAX_BACKOFF_MS = 24 * HOUR
/** A delivery that crashed between insert and outcome-update sits "received". */
export const STALE_RECEIVED_GRACE_MS = 5 * MINUTE
/** A claimed attempt older than this is considered crashed-mid-processing. */
export const PROCESSING_LEASE_MS = 15 * MINUTE
/** Hard cap on events per batch (bounded by HTTP realities). */
export const MAX_BATCH_LIMIT = 50

function backoffMs(attempts: number): number {
  return Math.min(BASE_BACKOFF_MS * Math.pow(4, Math.max(0, attempts - 1)), MAX_BACKOFF_MS)
}

export interface RecoveryEventResult {
  eventId: string
  eventType: string
  attempts: number
  outcome: "processed" | "unresolved" | "failed" | "manual_review"
  /** Safe, secret-free reason when not processed. */
  reason?: string
}

export interface RecoveryBatchResult {
  startedAt: number
  processed: number
  resolved: number
  stillPending: number
  escalatedToManualReview: number
  claimedButSkipped: number
  results: RecoveryEventResult[]
  /** true when the batch hit its limit and more eligible events likely remain. */
  hasMore: boolean
}

/** Shared eligibility shape: reprocessable type + attempt budget + a state
 * from which recovery is meaningful + (applied separately) the backoff gate. */
function eligibleFilter(now: number): Record<string, unknown> {
  return {
    eventType: { $in: [...REPROCESSABLE_EVENT_TYPES] },
    // Attempt budget: historical docs have no attempts field → treated as 0
    // ($not $gte matches documents where the field is missing OR < MAX).
    attempts: { $not: { $gte: MAX_ATTEMPTS } },
    $or: [
      // Failed or unattributable events.
      { status: { $in: ["failed", "unresolved"] } },
      // Live deliveries that crashed between insert and outcome-update.
      { status: "received", receivedAt: { $lt: now - STALE_RECEIVED_GRACE_MS } },
      // Recovery workers that died mid-attempt (lease expired).
      { status: "processing", lastAttemptAt: { $lt: now - PROCESSING_LEASE_MS } },
    ],
  }
}

/** Eligibility + elapsed backoff (absent nextAttemptAt on pre-Phase-3 docs
 * means "due"). One shape used by both the claim and the stats aggregation. */
function claimableFilter(now: number): Record<string, unknown> {
  return {
    ...eligibleFilter(now),
    $and: [
      { $or: [{ nextAttemptAt: { $exists: false } }, { nextAttemptAt: { $lte: now } }] },
    ],
  }
}

/** Otherwise-eligible events still sitting in their backoff window. Needed for
 * `nextScheduledAttemptAt`: a not-yet-due event is BY DEFINITION absent from
 * `claimableFilter`, so deriving that field from the claimable set alone could
 * only ever report `null`. */
function waitingFilter(now: number): Record<string, unknown> {
  return { ...eligibleFilter(now), nextAttemptAt: { $gt: now } }
}

/** Atomic claim: exactly one worker wins each event (same findOneAndUpdate
 * discipline as `claimPendingAction` — the repo's double-approval guard). */
async function claimNextEvent(now: number): Promise<WebhookEventDoc | null> {
  const col = await webhookEventsCol()
  const doc = await col.findOneAndUpdate(
    claimableFilter(now) as never,
    { $inc: { attempts: 1 }, $set: { status: "processing", lastAttemptAt: now } },
    { returnDocument: "after", sort: { receivedAt: 1 } },
  )
  return doc ?? null
}

async function settle(
  event: WebhookEventDoc,
  now: number,
  status: "processed" | "unresolved" | "failed" | "manual_review",
  reason?: string,
): Promise<void> {
  const col = await webhookEventsCol()
  const attempts = event.attempts ?? 1
  const set: Record<string, unknown> = { status, error: reason ?? null }
  if (status === "processed") {
    set.processedAt = now
    set.nextAttemptAt = null
    set.reviewReason = null
  } else if (status === "manual_review") {
    set.processedAt = now
    set.reviewReason = reason ?? "attempt budget exhausted"
    set.nextAttemptAt = null
  } else {
    set.nextAttemptAt = now + backoffMs(attempts)
  }
  await col.updateOne({ _id: event._id }, { $set: set })
}

/**
 * Run one bounded recovery batch. Returns per-event outcomes. Read-only with
 * respect to FINANCIAL records: this function only creates the same ledger /
 * payment effects the live handler would (idempotently); it never mutates
 * historical ledger rows.
 */
export async function runRecoveryBatch(params: { limit?: number; now?: number } = {}): Promise<RecoveryBatchResult> {
  const limit = Math.max(1, Math.min(params.limit ?? 10, MAX_BATCH_LIMIT))
  const now = params.now ?? Date.now()
  const results: RecoveryEventResult[] = []
  let claimedButSkipped = 0
  let resolved = 0
  let escalated = 0

  for (let i = 0; i < limit; i++) {
    const event = await claimNextEvent(now)
    if (!event) break

    // Defensive: an event claimed at the exact boundary of the type set.
    if (!REPROCESSABLE_EVENT_TYPES.has(event.eventType)) {
      await settle(event, now, "manual_review", "event type is not safely re-processable")
      claimedButSkipped++
      continue
    }

    const data = event.payload?.data as Record<string, unknown> | undefined
    try {
      const outcome = await processDodoEvent(event.eventType, data, event.id)
      if (outcome.status === "processed") {
        await settle(event, now, "processed")
        resolved++
        results.push({ eventId: event.id, eventType: event.eventType, attempts: event.attempts ?? 1, outcome: "processed" })
      } else {
        const attempts = event.attempts ?? 1
        if (attempts >= MAX_ATTEMPTS) {
          await settle(event, now, "manual_review", outcome.reason)
          escalated++
          results.push({ eventId: event.id, eventType: event.eventType, attempts, outcome: "manual_review", reason: outcome.reason })
        } else {
          await settle(event, now, "unresolved", outcome.reason)
          results.push({ eventId: event.id, eventType: event.eventType, attempts, outcome: "unresolved", reason: outcome.reason })
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const attempts = event.attempts ?? 1
      if (attempts >= MAX_ATTEMPTS) {
        await settle(event, now, "manual_review", message)
        escalated++
        results.push({ eventId: event.id, eventType: event.eventType, attempts, outcome: "manual_review", reason: message })
      } else {
        await settle(event, now, "failed", message)
        results.push({ eventId: event.id, eventType: event.eventType, attempts, outcome: "failed", reason: message })
      }
      logger.warn("webhook.recovery", "recovery attempt failed", { eventId: event.id, eventType: event.eventType, attempts, error: message })
    }
  }

  const claimed = results.length + claimedButSkipped
  return {
    startedAt: now,
    processed: claimed,
    resolved,
    stillPending: results.filter((r) => r.outcome === "failed" || r.outcome === "unresolved").length,
    escalatedToManualReview: escalated,
    claimedButSkipped,
    results,
    hasMore: claimed >= limit,
  }
}

export interface RecoveryQueueStats {
  counts: {
    failed: number
    unresolved: number
    processing: number
    manual_review: number
    /** verified events stuck in "received" beyond the grace window. */
    stale_received: number
  }
  /** Eligible right now (backoff elapsed, budget left, reprocessable type). */
  eligibleNow: number
  oldestEligibleReceivedAt: number | null
  /** Earliest `nextAttemptAt` among events that are otherwise eligible but
   * still in their backoff window — i.e. when the queue wakes up next. `null`
   * when nothing is waiting. */
  nextScheduledAttemptAt: number | null
}

/** Operator-facing queue health (read-only, bounded). */
export async function getRecoveryQueueStats(now: number = Date.now()): Promise<RecoveryQueueStats> {
  const col = await webhookEventsCol()
  const [failed, unresolved, processing, manualReview, staleReceived, eligibleAgg, waitingAgg] = await Promise.all([
    col.countDocuments({ status: "failed" }),
    col.countDocuments({ status: "unresolved" }),
    col.countDocuments({ status: "processing" }),
    col.countDocuments({ status: "manual_review" }),
    col.countDocuments({ status: "received", receivedAt: { $lt: now - STALE_RECEIVED_GRACE_MS } }),
    col
      .aggregate<{ _id: null; oldest: number | null; eligible: number }>([
        { $match: claimableFilter(now) as never },
        {
          $group: {
            _id: null,
            oldest: { $min: "$receivedAt" },
            eligible: { $sum: 1 },
          },
        },
      ])
      .toArray(),
    // The next attempt belongs to the events that are NOT claimable yet —
    // otherwise this aggregation can only ever return null.
    col
      .aggregate<{ _id: null; nextAttempt: number | null }>([
        { $match: waitingFilter(now) as never },
        { $group: { _id: null, nextAttempt: { $min: "$nextAttemptAt" } } },
      ])
      .toArray(),
  ])
  const row = eligibleAgg[0]
  return {
    counts: { failed, unresolved, processing, manual_review: manualReview, stale_received: staleReceived },
    eligibleNow: row?.eligible ?? 0,
    oldestEligibleReceivedAt: row?.oldest ?? null,
    nextScheduledAttemptAt: waitingAgg[0]?.nextAttempt ?? null,
  }
}

export { MAX_ATTEMPTS as RECOVERY_MAX_ATTEMPTS, backoffMs as recoveryBackoffMs }
