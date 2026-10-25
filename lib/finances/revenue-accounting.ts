import "server-only"
import type { Document } from "mongodb"

/**
 * Atai Finance — Phase 3 revenue accounting (Workstream D).
 *
 * ONE authoritative definition of how Dodo payment rows become the monetary
 * figures an operator reads as "revenue", shared by the admin reporting
 * aggregation (`app/api/admin/billing/overview/route.ts`) and the read-only
 * reconciliation service (`lib/finances/reconciliation.ts`). Both consumers use
 * the SAME vocabulary, so a report and a discrepancy finding can never disagree
 * about what counts as money in.
 *
 * ── Documented basis (required before any formula change) ───────────────
 *
 * The pre-Phase-3 `revenue.total` field summed `payment_records.amount` over
 * rows with `status: "succeeded"`. That raw field is neither gross nor net:
 * it was GROSS CASH COLLECTED expressed in the provider's own MINOR units,
 * with every currency added together, and refunds were not represented at all
 * (refund rows did not exist yet). Phase 3 keeps the same underlying measure —
 * gross collections — and makes the three distinct concepts explicit:
 *
 *   gross   = money IN as Dodo confirmed it (collection rows in a collected
 *             state). A payment that was later refunded STAYS in gross: the
 *             cash really was collected.
 *   refunds = the separate, traceable rows Dodo confirmed as refunds (stored
 *             with a negative amount by the webhook handler).
 *   net     = gross + refunds = cash actually kept.
 *
 * `net` is a cash-kept figure. It is NOT recognized revenue: no
 * revenue-recognition policy, no deferred-revenue model and no provider-fee
 * ledger exist here, so nothing in this module may be labelled as either.
 * Profit/margin derived from the 3,750-credits-per-USD reference valuation is
 * explicitly out of scope (see lib/billing/credit-valuation.ts).
 *
 * ── Rules enforced by this module ───────────────────────────────────────
 *
 *  1. Failed / cancelled / pending / refunded-status-but-not-a-refund-row
 *     payments are never counted as collections.
 *  2. Refund rows are never counted as collections, and collections are never
 *     removed when refunded — so a refund is subtracted EXACTLY once.
 *  3. Currencies are never added together (no approved FX source exists);
 *     every figure is keyed by upper-cased currency code.
 *  4. Minor units are converted to major units at the boundary
 *     (`MINOR_UNITS_PER_MAJOR`); the provider's own unit convention (Dodo
 *     reports `total_amount` in cents) is documented once, here.
 *  5. A row with no amount is reported in `unknownAmountRows` — never summed
 *     as a confirmed zero (missing ≠ zero).
 *
 * @module lib/finances/revenue-accounting
 */

/** Payment statuses in which Dodo confirmed that money was collected. */
export const COLLECTED_STATUSES = ["succeeded", "partially_refunded", "refunded"] as const
export type CollectedStatus = (typeof COLLECTED_STATUSES)[number]

/** Dodo reports monetary amounts in minor units (cents). */
export const MINOR_UNITS_PER_MAJOR = 100

/** The `paymentType` value the webhook handler writes on refund rows. */
export const REFUND_PAYMENT_TYPE = "refund"

/** The monetary subset of a payment row this module reasons about. */
export interface PaymentMoneyRow {
  paymentType?: string | null
  status?: string | null
  currency?: string | null
  amount?: number | null
  createdAt?: number | null
}

/** Per-currency money figures, already converted to MAJOR units. */
export interface MoneyFigure {
  /** Cash collected (collection rows only). */
  gross: number
  /** Confirmed refunds as a positive magnitude (subtract once, for net). */
  refunds: number
  /** gross − refunds = cash kept. Not recognized revenue. */
  net: number
  rows: number
  collectionRows: number
  refundRows: number
  /** Rows whose amount the provider never supplied — reported, not zeroed. */
  unknownAmountRows: number
}

export const EMPTY_MONEY_FIGURE: MoneyFigure = {
  gross: 0,
  refunds: 0,
  net: 0,
  rows: 0,
  collectionRows: 0,
  refundRows: 0,
  unknownAmountRows: 0,
}

export function emptyMoneyFigure(): MoneyFigure {
  return { ...EMPTY_MONEY_FIGURE }
}

export function isRefundRow(row: PaymentMoneyRow): boolean {
  return row.paymentType === REFUND_PAYMENT_TYPE
}

/** A row representing money IN that Dodo confirmed (never a refund row). */
export function isCollectionRow(row: PaymentMoneyRow): boolean {
  if (isRefundRow(row)) return false
  return (COLLECTED_STATUSES as readonly string[]).includes(row.status ?? "")
}

/**
 * Pure truth of the monetary population: every row that belongs in a
 * gross/refund/net breakdown. `moneyMatch()` below is the database-side
 * expression of exactly this predicate (a regression test pins the two
 * together, so report and reconciliation cannot drift apart).
 */
export function isMoneyBearing(row: PaymentMoneyRow, sinceMs?: number): boolean {
  if (sinceMs !== undefined) {
    const at = typeof row.createdAt === "number" ? row.createdAt : Number.NaN
    if (!Number.isFinite(at) || at < sinceMs) return false
  }
  return isCollectionRow(row) || isRefundRow(row)
}

/** MongoDB `$match` filter form of `isMoneyBearing`. */
export function moneyMatch(sinceMs?: number): Record<string, unknown> {
  return {
    ...(sinceMs !== undefined ? { createdAt: { $gte: sinceMs } } : {}),
    $or: [
      { paymentType: { $ne: REFUND_PAYMENT_TYPE }, status: { $in: [...COLLECTED_STATUSES] } },
      { paymentType: REFUND_PAYMENT_TYPE },
    ],
  }
}

/** Normalized currency code for grouping; unknown when the provider omitted it. */
export function moneyCurrency(row: PaymentMoneyRow): string {
  const raw = typeof row.currency === "string" ? row.currency.trim() : ""
  return raw ? raw.toUpperCase() : "UNKNOWN"
}

function addMajor(target: number, minor: number): number {
  return target + minor / MINOR_UNITS_PER_MAJOR
}

/** The shape produced by `moneyPipeline()`'s `$group` stage. */
export interface MoneyGroupRow {
  _id: { currency: string; kind: "collection" | "refund" }
  minor: number
  rows: number
  unknownAmountRows: number
}


/**
 * Aggregation pipeline that groups the monetary population per currency and
 * per kind. Used by the admin report, which must not pull every payment row
 * into memory.
 */
export function moneyPipeline(sinceMs?: number): Document[] {
  return [
    { $match: moneyMatch(sinceMs) },
    {
      $group: {
        _id: {
          currency: { $toUpper: { $ifNull: ["$currency", "UNKNOWN"] } },
          kind: {
            $cond: [{ $eq: [{ $ifNull: ["$paymentType", "unknown"] }, REFUND_PAYMENT_TYPE] }, "refund", "collection"],
          },
        },
        minor: { $sum: { $ifNull: ["$amount", 0] } },
        rows: { $sum: 1 },
        // Absent OR null both compare equal to `null` in MongoDB — either way
        // the provider never gave an amount, so the row is not summable.
        unknownAmountRows: { $sum: { $cond: [{ $eq: ["$amount", null] }, 1, 0] } },
      },
    },
    { $sort: { "_id.currency": 1, "_id.kind": 1 } },
  ]
}

/** Reduce the database-side grouped rows into per-currency figures. */
export function moneyFiguresFromGroups(rows: readonly MoneyGroupRow[]): Record<string, MoneyFigure> {
  const out: Record<string, MoneyFigure> = {}
  for (const row of rows) {
    const currency = row._id?.currency ?? "UNKNOWN"
    const fig = (out[currency] ??= emptyMoneyFigure())
    fig.rows += row.rows
    fig.unknownAmountRows += row.unknownAmountRows
    // Refund amounts are stored negative; report their magnitude as refunds.
    if (row._id?.kind === "refund") {
      fig.refundRows += row.rows
      fig.refunds += -row.minor / MINOR_UNITS_PER_MAJOR
    } else {
      fig.collectionRows += row.rows
      fig.gross += row.minor / MINOR_UNITS_PER_MAJOR
    }
    fig.net += row.minor / MINOR_UNITS_PER_MAJOR
  }
  return out
}

/**
 * Pure in-memory equivalent of `moneyPipeline()` +
 * `moneyFiguresFromGroups()` over raw rows. Used by reconciliation (which
 * already holds a bounded page of records) and by the revenue regression
 * tests, so both reason with the same arithmetic as the report.
 */
export function moneyFiguresFromRows(rows: readonly PaymentMoneyRow[]): Record<string, MoneyFigure> {
  const out: Record<string, MoneyFigure> = {}
  for (const row of rows) {
    if (!isMoneyBearing(row)) continue
    const fig = (out[moneyCurrency(row)] ??= emptyMoneyFigure())
    const minor = typeof row.amount === "number" && Number.isFinite(row.amount) ? row.amount : null
    fig.rows += 1
    // The sub-row counters count ROWS, independent of whether an amount was
    // supplied — the database-side reduction (moneyFiguresFromGroups) cannot
    // distinguish them, so the two reductions must agree here.
    if (isRefundRow(row)) fig.refundRows += 1
    else fig.collectionRows += 1
    if (minor === null) {
      fig.unknownAmountRows += 1
      continue
    }
    if (isRefundRow(row)) {
      fig.refunds += -minor / MINOR_UNITS_PER_MAJOR
      fig.net += minor / MINOR_UNITS_PER_MAJOR
    } else {
      fig.gross += minor / MINOR_UNITS_PER_MAJOR
      fig.net += minor / MINOR_UNITS_PER_MAJOR
    }
  }
  return out
}

/**
 * Split per-currency figures into the USD headline and everything else.
 * Non-USD activity is NEVER folded into a USD total — no approved exchange
 * rate, timestamp convention, or conversion policy exists in this repository.
 */
export function splitCurrencyFigures(
  figures: Record<string, MoneyFigure>,
  headlineCurrency = "USD",
): { headline: MoneyFigure; headlineCurrency: string; otherCurrencies: Array<{ currency: string } & MoneyFigure> } {
  const otherCurrencies = Object.entries(figures)
    .filter(([currency]) => currency !== headlineCurrency)
    .map(([currency, fig]) => ({ currency, ...fig }))
    .sort((a, b) => a.currency.localeCompare(b.currency))
  return { headline: figures[headlineCurrency] ?? emptyMoneyFigure(), headlineCurrency, otherCurrencies }
}

/**
 * Confirmed refunded progress on the ORIGINAL payment row, expressed in that
 * payment's own currency minor units. Returns null when either side is
 * unknown — an unreported refund is never presented as "0 refunded" and a
 * partially-tracked payment is never presented as fully refunded.
 */
export function remainingNetMinor(originalAmountMinor: number | null | undefined, refundedAmountMinor: number | null | undefined): number | null {
  if (typeof originalAmountMinor !== "number" || !Number.isFinite(originalAmountMinor)) return null
  if (refundedAmountMinor == null) return originalAmountMinor
  if (!Number.isFinite(refundedAmountMinor)) return null
  return originalAmountMinor - refundedAmountMinor
}
