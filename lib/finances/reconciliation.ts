import "server-only"
import {
  paymentRecordsCol,
  subscriptionRecordsCol,
  creditLedgerCol,
  webhookEventsCol,
  usersCol,
} from "@/lib/db/collections"
import { CREDIT_REVERSAL_TRANSACTION_TYPES, expectedReversalDirection } from "@/lib/billing/reversal-types"
import { REPROCESSABLE_EVENT_TYPES } from "@/lib/billing/dodo-event-processing"
import { MAX_ATTEMPTS, STALE_RECEIVED_GRACE_MS, PROCESSING_LEASE_MS } from "@/lib/billing/webhook-recovery"
import { isCollectionRow, isRefundRow, moneyCurrency } from "@/lib/finances/revenue-accounting"
import { logger } from "@/lib/logging/logger"
import type { PaymentRecord, CreditLedgerEntry, SubscriptionRecord, ReconciliationIssue } from "@/lib/billing/billing-types"
import type { WebhookEventDoc } from "@/lib/types/db"

/**
 * Atai Finance — Phase 3 read-only financial reconciliation (Workstream E).
 *
 * Compares the records that are SUPPOSED to agree — Dodo webhook events ↔
 * payment records ↔ credit ledger ↔ subscriptions ↔ user balances — and
 * reports where they do not.
 *
 * ── Hard guarantees ─────────────────────────────────────────────────────
 *
 *  1. READ-ONLY. This module performs no writes, ever: no `updateOne`,
 *     `insertOne`, delete or bulk rewrite, no "auto-fix". Corrections go
 *     through the explicit, validated, idempotent paths that already exist:
 *     the recovery worker (`lib/billing/webhook-recovery.ts`, which re-runs
 *     `processDodoEvent`) for webhook-shaped problems, and
 *     `adminAdjustCredits` (ledger-keyed) for human-approved balance fixes.
 *  2. NO FABRICATION. A discrepancy is emitted ONLY when both sides of the
 *     relationship can be evaluated from authoritative records. When a record
 *     lacks the field needed to evaluate the relationship, the finding is
 *     `incomplete_record` (severity `info`, resolution
 *     `needs_business_decision`) — never a guessed accounting error, and
 *     never a silent pass.
 *  3. BOUNDED. Every scan reads one window of at most `windowSize` records
 *     (default 250, hard max 1000) per source, joins with `$in` on indexed
 *     keys (unique `idempotencyKey`, unique `dodoPaymentId`,
 *     `{status, createdAt}`, `{transactionType, createdAt}`), and caps the
 *     emitted findings. `window.more` / `truncated` tell the operator the scan
 *     was not exhaustive, so "no findings" is never misread as
 *     "the books are clean".
 *  4. NO SECRET LEAKAGE. Findings carry identifiers, amounts and bookkeeping
 *     only. Webhook findings never include the payload body — no credentials,
 *     no customer emails, no raw provider payloads.
 *
 * Timing rule: a record younger than `ATTRIBUTION_GRACE_MS` may still be in
 * flight (a webhook can be mid-processing), so unfinished relationships are
 * deferred rather than reported; deferrals are counted in `deferredRecent` so
 * the operator can see the scan chose to wait instead of crying wolf.
 *
 * ── Deliberately NOT reported (false-discrepancy policy) ────────────────
 *
 *  - An active subscription whose user has 0 subscription credits: consuming
 *    the period grant is normal behaviour. (The pre-Phase-3 route flagged it;
 *    that check is replaced by the authoritative period-grant check.)
 *  - A dual-field balance of 0 against a positive legacy `credits` total:
 *    `getBalance()` treats an unpopulated split as a legacy account.
 *  - A `subscription_expiration` ledger entry with amount 0: that is the
 *    documented idempotency no-op written by `expireSubscriptionCredits`.
 *
 * @module lib/finances/reconciliation
 */

export type ReconciliationSeverity = "critical" | "warning" | "info"

/** How much time a record gets to be completed by an in-flight webhook. */
export const ATTRIBUTION_GRACE_MS = 10 * 60 * 1000
/** Default / maximum records read per source per page. */
export const DEFAULT_WINDOW_SIZE = 250
export const MAX_WINDOW_SIZE = 1000
/** Maximum findings returned per page. */
export const MAX_FINDINGS_PER_PAGE = 200
/** Cap on the duplicate-identifier safety-net groups returned per page. */
const DUPLICATE_SCAN_LIMIT = 50

const DAY_MS = 86_400_000

/** Discrepancy types this service can currently evaluate. */
export const RECONCILIATION_TYPES = [
  "payment_without_grant",
  "grant_without_payment",
  "duplicate_payment_records",
  "refund_without_payment",
  "refund_without_reversal",
  "reversal_without_refund",
  "duplicate_refund_records",
  "webhook_unresolved",
  "webhook_failed_recovery",
  "webhook_manual_review",
  "payment_attribution_missing",
  "subscription_period_mismatch",
  "subscription_mismatch",
  "unexpected_ledger_entry",
  "duplicate_credit_grant",
  "ledger_balance_mismatch",
  "incomplete_record",
] as const

// ─── Collection seam (so the service is deterministically testable) ───────────

type Filter = Record<string, unknown>

export interface ReconciliationCursor<T> {
  sort(spec: Record<string, 1 | -1>): ReconciliationCursor<T>
  limit(n: number): ReconciliationCursor<T>
  skip(n: number): ReconciliationCursor<T>
  toArray(): Promise<T[]>
}

export interface ReconciliationCollection<T> {
  find(filter?: Filter, options?: { projection?: Record<string, 0 | 1 | boolean> }): ReconciliationCursor<T>
  findOne(filter?: Filter): Promise<T | null>
  aggregate<R = Record<string, unknown>>(pipeline: unknown[]): { toArray(): Promise<R[]> }
}

/** A user document reduced to the fields reconciliation may read. */
export interface UserCreditDoc {
  id: string
  credits?: number
  subscriptionCredits?: number
  permanentCredits?: number
  deletedAt?: unknown
}

export interface ReconciliationCollections {
  payments(): Promise<ReconciliationCollection<PaymentRecord>>
  ledger(): Promise<ReconciliationCollection<CreditLedgerEntry>>
  subscriptions(): Promise<ReconciliationCollection<SubscriptionRecord>>
  webhooks(): Promise<ReconciliationCollection<WebhookEventDoc>>
  users(): Promise<ReconciliationCollection<UserCreditDoc>>
}

const DEFAULT_COLLECTIONS: ReconciliationCollections = {
  payments: async () => (await paymentRecordsCol()) as unknown as ReconciliationCollection<PaymentRecord>,
  ledger: async () => (await creditLedgerCol()) as unknown as ReconciliationCollection<CreditLedgerEntry>,
  subscriptions: async () => (await subscriptionRecordsCol()) as unknown as ReconciliationCollection<SubscriptionRecord>,
  webhooks: async () => (await webhookEventsCol()) as unknown as ReconciliationCollection<WebhookEventDoc>,
  users: async () => (await usersCol()) as unknown as ReconciliationCollection<UserCreditDoc>,
}

// ─── Public shapes ────────────────────────────────────────────────────────────

export interface ReconciliationOptions {
  /** Records read per source per page (clamped to MAX_WINDOW_SIZE). */
  windowSize?: number
  /** Opaque cursor from a previous page (`nextCursor`). */
  cursor?: string | null
  /** Restrict the scan to one account (per-user admin views). */
  userId?: string
  /** Only return these discrepancy types. */
  types?: readonly string[]
  /** Only return findings at or above this severity. */
  severity?: ReconciliationSeverity
  /** Injectable clock for deterministic tests. */
  now?: number
}

export interface ReconciliationPage {
  checkedAt: number
  window: {
    size: number
    offset: number
    nextCursor: string | null
    /** true when at least one source filled the window — more records exist. */
    more: boolean
  }
  scanned: {
    payments: number
    ledgerEntries: number
    subscriptions: number
    webhookEvents: number
    users: number
  }
  summary: {
    total: number
    critical: number
    warning: number
    info: number
    /** Counts by discrepancy type — the operator-facing triage view. */
    byType: Record<string, number>
    /** Webhook queue posture, kept separate from the money findings. */
    retryable: number
    requiresManualReview: number
    deferredRecent: number
  }
  /** true when MAX_FINDINGS_PER_PAGE cut the findings list. */
  truncated: boolean
  /** Read-only marker, surfaced so no UI can claim it "fixed" anything. */
  readOnly: true
  note: string
  findings: ReconciliationIssue[]
}

/** Everything `push()` fills in for the caller. */
type NewFinding = Omit<ReconciliationIssue, "detectedAt" | "priority" | "resolved">

const PRIORITY: Record<ReconciliationSeverity, number> = { critical: 1, warning: 2, info: 3 }

// ─── Cursor codec ─────────────────────────────────────────────────────────────

function encodeCursor(offset: number): string {
  return Buffer.from(`r1:${offset}`, "utf8").toString("base64url")
}

function decodeCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0
  try {
    const [version, value] = Buffer.from(cursor, "base64url").toString("utf8").split(":")
    if (version !== "r1") return 0
    const offset = Number.parseInt(value, 10)
    return Number.isFinite(offset) && offset > 0 ? offset : 0
  } catch {
    return 0
  }
}

// ─── The service ──────────────────────────────────────────────────────────────

/**
 * Run one bounded, read-only reconciliation page.
 *
 * @param options window/cursor/filter/clock controls — nothing mutates records
 * @param collections injectable for tests; defaults to the real collections
 */
export async function reconcileFinances(
  options: ReconciliationOptions = {},
  collections: ReconciliationCollections = DEFAULT_COLLECTIONS,
): Promise<ReconciliationPage> {
  const now = options.now ?? Date.now()
  const size = Math.max(1, Math.min(options.windowSize ?? DEFAULT_WINDOW_SIZE, MAX_WINDOW_SIZE))
  const offset = decodeCursor(options.cursor)
  const userId = typeof options.userId === "string" && options.userId ? options.userId : undefined
  const scope = <T>(filter: Filter = {}): Filter => (userId ? { ...filter, userId } : filter)

  const [payCol, ledgerCol, subCol, hookCol, userCol] = await Promise.all([
    collections.payments(),
    collections.ledger(),
    collections.subscriptions(),
    collections.webhooks(),
    collections.users(),
  ])

  const windowFor = <T>(col: ReconciliationCollection<T>, filter: Filter, sort: Record<string, 1 | -1>) =>
    col.find(filter).sort(sort).skip(offset).limit(size).toArray()

  const [payments, reversals, grants, subs, webhookEvents] = await Promise.all([
    windowFor(payCol, scope({}), { createdAt: 1, _id: 1 }),
    windowFor(ledgerCol, scope({ transactionType: { $in: [...CREDIT_REVERSAL_TRANSACTION_TYPES] } }), { createdAt: 1, _id: 1 }),
    windowFor(ledgerCol, scope({ transactionType: { $in: ["credit_purchase", "topup_grant"] }, direction: "credit" }), { createdAt: 1, _id: 1 }),
    windowFor(subCol, scope({ status: "active" }), { createdAt: 1, _id: 1 }),
    windowFor(hookCol, scope({ status: { $in: ["failed", "unresolved", "manual_review", "received", "processing"] } }), { receivedAt: 1, _id: 1 }),
  ])

  const more = [payments, reversals, grants, subs, webhookEvents].some((rows) => rows.length >= size)

  const findings: ReconciliationIssue[] = []
  let deferredRecent = 0
  const seenIds = new Set<string>()
  const push = (issue: NewFinding) => {
    if (seenIds.has(issue.id)) return
    seenIds.add(issue.id)
    findings.push({ ...issue, priority: PRIORITY[issue.severity], resolved: false, detectedAt: now })
  }
  const inFlight = (at: number): boolean => {
    if (now - at < ATTRIBUTION_GRACE_MS) {
      deferredRecent++
      return true
    }
    return false
  }

  // ── Indexed joins, batched (never one query per record) ───────────────────
  const packPayments = payments.filter(
    (p) => isCollectionRow(p) && p.paymentType === "permanent_credit_pack" && (p.creditsGranted ?? 0) > 0,
  )
  const refundRows = payments.filter(isRefundRow)
  const grantKeys = packPayments.map((p) => `payment_${p.dodoPaymentId}`)
  const refundKeys = refundRows.map((r) => `refund_${r.refundId ?? r.dodoPaymentId}`)
  const subPeriodKeys = subs
    .filter((s) => typeof s.currentPeriodEnd === "number" && s.currentPeriodEnd > 0 && s.mirrorCredits > 0)
    .map((s) => `sub_grant_${s.dodoSubscriptionId}_period_${Math.floor(s.currentPeriodEnd / DAY_MS)}`)
  const refundOriginalIds = [...new Set(refundRows.map((r) => r.originalPaymentId).filter((id): id is string => Boolean(id)))]
  const grantReferenceIds = [...new Set(grants.map((e) => e.referenceId).filter((id): id is string => Boolean(id)))]
  const reversalReferenceIds = [...new Set(reversals.map((e) => e.referenceId).filter((id): id is string => Boolean(id)))]
  const subUserIds = [...new Set(subs.map((s) => s.userId).filter(Boolean))]

  const [ledgerByKey, originalByRefundId, grantsByPaymentId, reversalRefunds, usersById] = await Promise.all([
    fetchIn(ledgerCol, { idempotencyKey: { $in: [...grantKeys, ...refundKeys, ...subPeriodKeys] } }),
    fetchIn(payCol, { dodoPaymentId: { $in: refundOriginalIds } }),
    fetchIn(payCol, { dodoPaymentId: { $in: grantReferenceIds } }),
    fetchIn(ledgerCol, { transactionType: "refund_reversal", referenceId: { $in: reversalReferenceIds } }),
    fetchIn(userCol, { id: { $in: subUserIds } }, { projection: { id: 1, credits: 1, subscriptionCredits: 1, permanentCredits: 1, deletedAt: 1 } }),
  ])

  const keySet = new Set(ledgerByKey.map((e) => e.idempotencyKey))
  const originalByPaymentId = new Map(originalByRefundId.map((p) => [p.dodoPaymentId, p]))
  const paymentByDodoId = new Map(payments.map((p) => [p.dodoPaymentId, p]))
  const grantPaymentIdSet = new Set(grantsByPaymentId.map((p) => p.dodoPaymentId))
  const reversalByRefundId = new Map(reversalRefunds.map((e) => [e.referenceId as string, e]))
  const userMap = new Map(usersById.map((u) => [u.id, u]))

  // ── 1. Confirmed payment with no corresponding credit grant ───────────────
  for (const p of packPayments) {
    const key = `payment_${p.dodoPaymentId}`
    if (keySet.has(key)) continue
    if (inFlight(p.createdAt)) continue
    push({
      id: `payment_without_grant:${p.dodoPaymentId}`,
      type: "payment_without_grant",
      severity: "critical",
      userId: p.userId || undefined,
      referenceId: p.dodoPaymentId,
      relatedIds: [p.id, key],
      expected: `1 credit_ledger grant keyed "${key}" for ${p.creditsGranted} credits`,
      observed: p.userId ? "no ledger entry with that key" : "no ledger entry, and the payment row has no user attribution",
      description: `Payment ${p.dodoPaymentId} is recorded succeeded with ${p.creditsGranted} credits but the matching credit grant does not exist.`,
      resolution: "open",
    })
  }

  // ── 2. Payment rows with no authoritative attribution ────────────────────
  for (const p of payments) {
    if (!isCollectionRow(p) || p.userId) continue
    push({
      id: `payment_attribution_missing:${p.dodoPaymentId}`,
      type: "payment_attribution_missing",
      severity: "critical",
      referenceId: p.dodoPaymentId,
      relatedIds: [p.id],
      expected: "a payment row identifying the account it belongs to",
      observed: "userId is empty — no safe credit grant is possible",
      description: `Payment ${p.dodoPaymentId} has no user attribution, so it can never be credited automatically.`,
      resolution: "needs_business_decision",
    })
  }

  // ── 3. Credit grant with no matching authoritative payment ────────────────
  for (const entry of grants) {
    const refId = entry.referenceId
    if (!refId) continue
    if (paymentByDodoId.has(refId) || grantPaymentIdSet.has(refId)) continue
    if (inFlight(entry.createdAt)) continue
    push({
      id: `grant_without_payment:${entry.id}`,
      type: "grant_without_payment",
      severity: "critical",
      userId: entry.userId,
      referenceId: refId,
      relatedIds: [entry.id, entry.idempotencyKey],
      expected: `a payment_records row for ${refId}`,
      observed: `credit_ledger entry ${entry.id} granted ${entry.amount} credits with no payment record`,
      description: `A purchase-shaped credit grant references payment ${refId}, which is not in payment_records.`,
    })
  }

  // ── 4. Refund accounting: linkage, reversal, conflicts ────────────────────
  const refundsByOriginal = new Map<string, PaymentRecord[]>()
  for (const r of refundRows) {
    if (!r.originalPaymentId) continue
    const list = refundsByOriginal.get(r.originalPaymentId) ?? []
    list.push(r)
    refundsByOriginal.set(r.originalPaymentId, list)
  }

  for (const r of refundRows) {
    if (!r.originalPaymentId) {
      // Historical rows predate the additive link field: NOT evaluable.
      push({
        id: `incomplete_record:refund_link:${r.dodoPaymentId}`,
        type: "incomplete_record",
        severity: "info",
        userId: r.userId || undefined,
        referenceId: r.dodoPaymentId,
        relatedIds: [r.id],
        expected: "originalPaymentId linking the refund to the payment it reverses",
        observed: "field absent (row predates the additive schema change)",
        description: `Refund ${r.dodoPaymentId} cannot be tied to an original payment from our records alone.`,
        resolution: "needs_business_decision",
      })
      continue
    }
    const original = originalByPaymentId.get(r.originalPaymentId)
    if (!original) {
      push({
        id: `refund_without_payment:${r.dodoPaymentId}`,
        type: "refund_without_payment",
        severity: "critical",
        userId: r.userId || undefined,
        referenceId: r.dodoPaymentId,
        relatedIds: [r.id, r.originalPaymentId],
        expected: `payment_records row ${r.originalPaymentId}`,
        observed: "no such payment record — the refund nets against nothing",
        description: `Refund ${r.dodoPaymentId} references original payment ${r.originalPaymentId}, which is not in payment_records.`,
      })
      continue
    }
    if (r.currency && original.currency && moneyCurrency({ currency: r.currency }) !== moneyCurrency({ currency: original.currency })) {
      push({
        id: `incomplete_record:refund_currency:${r.dodoPaymentId}`,
        type: "incomplete_record",
        severity: "info",
        userId: r.userId || undefined,
        referenceId: r.dodoPaymentId,
        relatedIds: [r.id, original.dodoPaymentId],
        expected: "refund currency equal to the original payment currency",
        observed: `${moneyCurrency({ currency: r.currency })} vs ${moneyCurrency({ currency: original.currency })}`,
        description: `Refund ${r.dodoPaymentId} is in a different currency than its original payment; with no approved FX policy it is excluded from netting.`,
        resolution: "needs_business_decision",
      })
      continue
    }

    // A reversal is REQUIRED only when the original payment actually granted
    // credits (a refunded subscription cycle's credits belong to the period
    // grant, not to the payment row).
    const granted = original.creditsGranted ?? 0
    const key = `refund_${r.refundId ?? r.dodoPaymentId}`
    if (granted > 0 && !keySet.has(key)) {
      if (inFlight(r.createdAt)) continue
      push({
        id: `refund_without_reversal:${r.dodoPaymentId}`,
        type: "refund_without_reversal",
        severity: "critical",
        userId: r.userId || undefined,
        referenceId: r.dodoPaymentId,
        relatedIds: [r.id, original.dodoPaymentId, key],
        expected: `1 credit_ledger reversal keyed "${key}" (up to ${granted} credits)`,
        observed: "confirmed refund row with no reversal entry",
        description: `Dodo confirmed refund ${r.dodoPaymentId} on payment ${original.dodoPaymentId}, but the purchased credits were never reversed.`,
      })
    }

    const siblings = refundsByOriginal.get(r.originalPaymentId) ?? []
    if (siblings.length > 1) {
      const byRefundId = new Map<string, number>()
      for (const sib of siblings) {
        const id = sib.refundId ?? sib.dodoPaymentId
        byRefundId.set(id, (byRefundId.get(id) ?? 0) + 1)
      }
      for (const [id, count] of byRefundId) {
        if (count <= 1) continue
        push({
          id: `duplicate_refund_records:${r.originalPaymentId}:${id}`,
          type: "duplicate_refund_records",
          severity: "critical",
          userId: r.userId || undefined,
          referenceId: id,
          relatedIds: siblings.map((sib) => sib.id),
          expected: "one refund row per Dodo refund id",
          observed: `${count} rows for refund ${id}`,
          description: `Refund ${id} appears ${count} times against payment ${r.originalPaymentId}; the same money could be netted twice.`,
        })
      }
      const originalMinor = typeof original.amount === "number" ? original.amount : null
      const refundedMinor = siblings.reduce((sum, sib) => sum + Math.abs(typeof sib.amount === "number" ? sib.amount : 0), 0)
      if (originalMinor !== null && refundedMinor > originalMinor) {
        push({
          id: `duplicate_refund_records:over:${r.originalPaymentId}`,
          type: "duplicate_refund_records",
          severity: "critical",
          userId: r.userId || undefined,
          referenceId: r.originalPaymentId,
          relatedIds: siblings.map((sib) => sib.dodoPaymentId),
          expected: `total refunded ≤ ${originalMinor} minor units (the original amount)`,
          observed: `refund rows sum to ${refundedMinor} minor units`,
          description: `Refund rows against payment ${r.originalPaymentId} total more than the payment itself.`,
        })
      }
    }
  }

  // ── 5. Reversal shape + reversals without confirmed refund evidence ───────
  for (const entry of reversals) {
    // Direction is part of the vocabulary: a credits-back reversal (`runtime_refund`,
    // `other_reversal`, `build_release`, legacy `build_refund`) is a CREDIT row;
    // a Dodo clawback (`refund_reversal`) is a DEBIT row. Either written the
    // other way round corrupts the reversal totals, so it is reported — but a
    // correctly-directed row is never a finding.
    const expectedDirection = expectedReversalDirection(entry.transactionType)
    if (expectedDirection && entry.direction !== expectedDirection) {
      push({
        id: `unexpected_ledger_entry:direction:${entry.id}`,
        type: "unexpected_ledger_entry",
        severity: "critical",
        userId: entry.userId,
        referenceId: entry.id,
        relatedIds: [entry.id, entry.idempotencyKey],
        expected: `direction "${expectedDirection}" — ${
          expectedDirection === "credit" ? "a refund returns credits to the account" : "a clawback takes granted credits away"
        }`,
        observed: `direction "${entry.direction}"`,
        description: `Ledger entry ${entry.id} (${entry.transactionType}) has an unexpected direction, so the reversal totals would be wrong.`,
      })
    }
    const zeroAllowed = entry.transactionType === "subscription_expiration"
    if (!Number.isInteger(entry.amount) || (entry.amount <= 0 && !zeroAllowed)) {
      push({
        id: `unexpected_ledger_entry:amount:${entry.id}`,
        type: "unexpected_ledger_entry",
        severity: "warning",
        userId: entry.userId,
        referenceId: entry.id,
        relatedIds: [entry.id, entry.idempotencyKey],
        expected: "a positive whole number of credits",
        observed: `amount ${JSON.stringify(entry.amount)}`,
        description: `Ledger entry ${entry.id} has a non-positive or fractional amount, which the credit model never produces.`,
      })
    }
    if (entry.transactionType !== "refund_reversal") continue
    const refundId = entry.referenceId
    if (!refundId) {
      push({
        id: `incomplete_record:reversal_ref:${entry.id}`,
        type: "incomplete_record",
        severity: "info",
        userId: entry.userId,
        referenceId: entry.id,
        relatedIds: [entry.id, entry.idempotencyKey],
        expected: "referenceId carrying the Dodo refund id",
        observed: "field absent — the reversal cannot be tied to a refund",
        description: `Reversal ${entry.id} has no refund reference, so refund confirmation cannot be verified.`,
        resolution: "needs_business_decision",
      })
      continue
    }
    const refundRow = paymentByDodoId.get(refundId) ?? (await payCol.findOne({ dodoPaymentId: refundId }))
    if (refundRow) continue
    if (inFlight(entry.createdAt)) continue
    push({
      id: `reversal_without_refund:${refundId}`,
      type: "reversal_without_refund",
      severity: "warning",
      userId: entry.userId,
      referenceId: refundId,
      relatedIds: [entry.id, entry.idempotencyKey],
      expected: "a confirmed Dodo refund row before credits are clawed back",
      observed: `a reversal of ${entry.amount} credits with no refund record`,
      // §6: the monetary side is NOT "completed" to match the ledger — an
      // unconfirmed refund stays unconfirmed.
      description: `Credits were reversed for refund ${refundId} but no confirmed refund record exists; the monetary refund remains unconfirmed.`,
      resolution: "needs_business_decision",
    })
  }

  // ── 6. Subscription billing periods vs grants ─────────────────────────────
  for (const sub of subs) {
    const user = userMap.get(sub.userId)
    if (!user || user.deletedAt !== undefined) {
      push({
        id: `subscription_mismatch:${sub.dodoSubscriptionId}`,
        type: "subscription_mismatch",
        severity: "critical",
        userId: sub.userId,
        referenceId: sub.dodoSubscriptionId,
        relatedIds: [sub.id],
        expected: "an active subscription owned by an existing account",
        observed: user ? "the account is deleted" : "no such account",
        description: `Subscription ${sub.dodoSubscriptionId} is active but its account is not available.`,
      })
      continue
    }
    if (typeof sub.currentPeriodEnd !== "number" || sub.currentPeriodEnd <= 0 || sub.mirrorCredits <= 0) {
      push({
        id: `incomplete_record:sub_period:${sub.dodoSubscriptionId}`,
        type: "incomplete_record",
        severity: "info",
        userId: sub.userId,
        referenceId: sub.dodoSubscriptionId,
        relatedIds: [sub.id],
        expected: "an authoritative currentPeriodEnd (and a plan with credits)",
        observed: `currentPeriodEnd ${JSON.stringify(sub.currentPeriodEnd)}, mirrorCredits ${JSON.stringify(sub.mirrorCredits)}`,
        description: `Subscription ${sub.dodoSubscriptionId} has no authoritative billing period, so its expected grant cannot be derived.`,
        resolution: "needs_business_decision",
      })
      continue
    }
    const key = `sub_grant_${sub.dodoSubscriptionId}_period_${Math.floor(sub.currentPeriodEnd / DAY_MS)}`
    if (keySet.has(key)) continue
    if (inFlight(Math.max(sub.currentPeriodStart ?? 0, sub.updatedAt))) continue
    push({
      id: `subscription_period_mismatch:${sub.dodoSubscriptionId}`,
      type: "subscription_period_mismatch",
      severity: "warning",
      userId: sub.userId,
      referenceId: sub.dodoSubscriptionId,
      relatedIds: [sub.id, key],
      expected: `a period grant keyed "${key}" for the current billing period (${sub.mirrorCredits} credits)`,
      observed: "no ledger entry with that key",
      description: `Subscription ${sub.dodoSubscriptionId} is active on a billing period with no matching credit grant.`,
    })
  }

  // ── 7. Balance decomposition (dual fields vs legacy total) ───────────────
  for (const u of usersById) {
    if (u.deletedAt !== undefined) continue
    const sub = u.subscriptionCredits ?? 0
    const perm = u.permanentCredits ?? 0
    const total = u.credits ?? 0
    if (sub + perm === total) continue
    if (sub === 0 && perm === 0) continue // legacy account — see the policy note
    push({
      id: `ledger_balance_mismatch:${u.id}`,
      type: "ledger_balance_mismatch",
      severity: "warning",
      userId: u.id,
      referenceId: u.id,
      relatedIds: [],
      expected: `credits == subscriptionCredits + permanentCredits (${sub} + ${perm})`,
      observed: `credits ${total}`,
      description: `Account ${u.id} has a credit split that no longer adds up to its total.`,
      resolution: "needs_business_decision",
    })
  }

  // ── 8. Webhook queue posture: retryable vs manual review ──────────────────
  // Vocabulary is the recovery worker's own: a "received"/"processing" event
  // only becomes a finding once it is STALE (the worker's grace/lease windows),
  // because until then it is genuinely in flight. Findings for stale deliveries
  // are reported as needing recovery, exactly like failed ones.
  let retryable = 0
  let requiresManualReview = 0
  for (const evt of webhookEvents) {
    const attempts = evt.attempts ?? 0
    const reprocessable = REPROCESSABLE_EVENT_TYPES.has(evt.eventType)
    const budgetLeft = attempts < MAX_ATTEMPTS
    const staleReceived = evt.status === "received" && evt.receivedAt < now - STALE_RECEIVED_GRACE_MS
    const expiredLease = evt.status === "processing" && (evt.lastAttemptAt ?? evt.receivedAt) < now - PROCESSING_LEASE_MS
    if (evt.status === "received" && !staleReceived) continue
    if (evt.status === "processing" && !expiredLease) continue

    const autoRecoverable = reprocessable && budgetLeft
    if (autoRecoverable) retryable++
    else requiresManualReview++

    const type =
      evt.status === "manual_review"
        ? "webhook_manual_review"
        : evt.status === "failed" || staleReceived || expiredLease
          ? "webhook_failed_recovery"
          : "webhook_unresolved"
    const ageMinutes = Math.max(0, Math.round((now - evt.receivedAt) / 60_000))
    push({
      id: `${type}:${evt.id}`,
      type,
      severity: evt.status === "manual_review" || !autoRecoverable ? "warning" : "info",
      referenceId: evt.webhookId,
      relatedIds: [evt.id],
      expected: "a verified Dodo event that reaches processed, or an explicit manual-review decision",
      observed: `status ${evt.status}, ${attempts} attempt(s), ${ageMinutes} min old${
        evt.nextAttemptAt ? `, next attempt in ${Math.max(0, Math.round((evt.nextAttemptAt - now) / 60_000))} min` : ", no scheduled retry"
      }`,
      // Deliberately NO payload: identifiers and bookkeeping only.
      description: `${evt.eventType} event ${evt.id} is ${evt.status}${evt.reviewReason ? ` (${evt.reviewReason})` : ""}. ${
        autoRecoverable
          ? "Retryable by the recovery worker."
          : reprocessable
            ? "Attempt budget exhausted — needs an operator decision."
            : "Event type is not safely re-processable — needs an operator decision."
      }`,
      resolution: autoRecoverable ? "open" : "under_review",
    })
  }

  // ── 9. Duplicate-identifier safety nets (pre-index history) ───────────────
  // The unique indexes make these impossible for new writes; the aggregates
  // exist to expose legacy data. Each is capped at DUPLICATE_SCAN_LIMIT rows.
  const [duplicatePaymentIds, duplicateLedgerKeys] = await Promise.all([
    payCol
      .aggregate<{ _id: string; count: number; ids: string[] }>([
        ...(userId ? [{ $match: { userId } }] : []),
        { $group: { _id: "$dodoPaymentId", count: { $sum: 1 }, ids: { $push: "$id" } } },
        { $match: { count: { $gt: 1 } } },
        { $limit: DUPLICATE_SCAN_LIMIT },
      ])
      .toArray(),
    ledgerCol
      .aggregate<{ _id: string; count: number; ids: string[] }>([
        ...(userId ? [{ $match: { userId } }] : []),
        { $group: { _id: "$idempotencyKey", count: { $sum: 1 }, ids: { $push: "$id" } } },
        { $match: { count: { $gt: 1 } } },
        { $limit: DUPLICATE_SCAN_LIMIT },
      ])
      .toArray(),
  ])

  for (const dup of duplicatePaymentIds) {
    if (!dup._id) continue
    push({
      id: `duplicate_payment_records:${dup._id}`,
      type: "duplicate_payment_records",
      severity: "critical",
      referenceId: dup._id,
      relatedIds: dup.ids ?? [],
      expected: "exactly one payment row per Dodo payment id (unique index)",
      observed: `${dup.count} rows`,
      description: `Payment ${dup._id} exists ${dup.count} times — legacy rows predating the unique index, or a write that bypassed the payment handler.`,
    })
  }
  for (const dup of duplicateLedgerKeys) {
    if (!dup._id) continue
    push({
      id: `duplicate_credit_grant:${dup._id}`,
      type: "duplicate_credit_grant",
      severity: "critical",
      referenceId: dup._id,
      relatedIds: dup.ids ?? [],
      expected: "exactly one ledger entry per idempotency key (unique index)",
      observed: `${dup.count} entries`,
      description: `Idempotency key "${dup._id}" has ${dup.count} ledger entries — history predating the unique index, or a write that bypassed the credit service.`,
    })
  }

  // ── Assemble the page ──────────────────────────────────────────────────────
  const byType = countByType(findings)
  const filtered = findings.filter((f) => {
    if (options.types?.length && !options.types.includes(f.type)) return false
    if (options.severity && PRIORITY[f.severity] > PRIORITY[options.severity]) return false
    return true
  })
  const ordered = filtered
    .sort(
      (a, b) =>
        (a.priority ?? 3) - (b.priority ?? 3) ||
        a.type.localeCompare(b.type) ||
        String(a.referenceId ?? "").localeCompare(String(b.referenceId ?? "")),
    )
    .slice(0, MAX_FINDINGS_PER_PAGE)

  logger.info("finance.reconciliation", "reconciliation page computed", {
    offset,
    size,
    findings: ordered.length,
    deferredRecent,
    readOnly: true,
  })

  return {
    checkedAt: now,
    window: { size, offset, nextCursor: more ? encodeCursor(offset + size) : null, more },
    scanned: {
      payments: payments.length,
      ledgerEntries: reversals.length + grants.length,
      subscriptions: subs.length,
      webhookEvents: webhookEvents.length,
      users: usersById.length,
    },
    summary: {
      total: ordered.length,
      critical: ordered.filter((f) => f.severity === "critical").length,
      warning: ordered.filter((f) => f.severity === "warning").length,
      info: ordered.filter((f) => f.severity === "info").length,
      byType,
      retryable,
      requiresManualReview,
      deferredRecent,
    },
    truncated: filtered.length > ordered.length,
    readOnly: true,
    note: "Read-only diagnostics. Nothing was created, updated, or repaired. Corrections run through the idempotent recovery worker (webhook-shaped problems) or an explicit admin credit adjustment (ledger-shaped problems).",
    findings: ordered,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Batched `$in` join on a unique/indexed key. Callers pass id lists already
 * bounded by the window size, so this stays one query per join.
 */
async function fetchIn<T>(
  col: ReconciliationCollection<T>,
  filter: Filter,
  options?: { projection?: Record<string, 0 | 1 | boolean> },
): Promise<T[]> {
  const values = Object.values(filter).find((v) => v && typeof v === "object" && Array.isArray((v as { $in?: unknown }).$in)) as
    | { $in: unknown[] }
    | undefined
  if (!values || values.$in.length === 0) return []
  return col.find(filter, options).limit(MAX_WINDOW_SIZE).toArray()
}

/** Findings by type, for operator triage (Workstream G). */
export function countByType(findings: readonly ReconciliationIssue[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const f of findings) out[f.type] = (out[f.type] ?? 0) + 1
  return out
}
