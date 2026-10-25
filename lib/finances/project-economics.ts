import "server-only"
import { creditLedgerCol } from "@/lib/db/collections"
import { runtimeUsageCol, ensureRuntimeIndexes } from "@/lib/db/runtime-collections"
import {
  CREDIT_VALUATION_BASIS,
  CREDIT_VALUATION_VERSION,
  consumedCreditsValueUsd,
} from "@/lib/billing/credit-valuation"
import type { ProviderCostStatus } from "./cost-status"

/**
 * Atai Finance — project economics accounting service (Phase 2).
 *
 * The authoritative, server-side definition of "what this project consumed".
 * Two sources of truth, NEVER summed together (no double counting):
 *
 *  - `credit_ledger`  → the CUSTOMER side: credits actually charged for
 *    project work, net of verified reversals. The ledger is the ONLY source
 *    for credit consumption; `runtime_usage.creditsCharged` is the same
 *    economic movement viewed from the telemetry side and is reported
 *    separately, never added to ledger totals.
 *  - `runtime_usage`  → the PROVIDER side: provider-reported monetary cost,
 *    kept per currency, classified confirmed / estimated / unavailable /
 *    not-applicable (lib/finances/cost-status). Provider cost is NEVER the
 *    credit valuation and never netted against it into a "profit" number.
 *
 * ── Documented aggregate definitions ─────────────────────────────────────
 *
 *  grossConsumedCredits — sum(`amount`) over ledger debit rows whose
 *      transactionType ∈ PROJECT_CREDIT_CONSUMPTION_TYPES and which are
 *      attributed to this project. A charge split across the subscription
 *      and permanent buckets writes TWO rows (`…_sub`, `…_perm`) whose
 *      amounts sum to the charged total — summing amounts is correct and
 *      cannot double-count (each row is a distinct bucket movement).
 *  reversalCredits      — sum(`amount`) over ledger CREDIT rows whose type ∈
 *      PROJECT_CREDIT_REVERSAL_TYPES (runtime_refund / build_release /
 *      other_reversal / refund_reversal). These are the only credit rows
 *      that offset consumption; funding credits (purchases, grants, bonuses,
 *      fork_royalty income) NEVER net against project spend.
 *  netConsumedCredits   — gross − reversals. May legitimately be negative in
 *      malformed data; reported as-is, never floored to hide the anomaly
 *      (it is surfaced in `diagnostics` instead).
 *  referenceValueUsd    — the STANDARD VALUE of netConsumedCredits at
 *      3,750 credits = US$1.00 (CREDIT_VALUATION_VERSION stamped). This is
 *      a reference value, NOT revenue, NOT provider cost, NOT profit.
 *  confirmedByCurrency  — provider-reported cost sums keyed by ISO currency
 *      (uppercased). Currencies are never added together; "unknown" is an
 *      explicit bucket for numeric costs without a currency label.
 *  costCoverageRatio    — events with a numeric provider cost ÷ succeeded
 *      events in the window. Partial coverage is reported honestly.
 *
 * ── Attribution contract ─────────────────────────────────────────────────
 *
 *  An entry belongs to the project when EITHER the first-class `projectId`
 *  matches OR the legacy `referenceType:"project" + referenceId` pair matches
 *  (rows written before first-class attribution existed). Entries with no
 *  attribution are NEVER guessed into the project; they remain account-level
 *  and are counted in diagnostics so the gap is discoverable, never silently
 *  reclassified. No historical balances are rewritten.
 *
 * @module lib/finances/project-economics
 */

// ─── Ledger consumption contract (verified against credit-service.ts) ───────

/** Debit transactionTypes that represent project WORK being consumed.
 *
 *  - runtime_usage / runtime_reservation — metered gateway + reserved ops
 *  - build_reservation                   — the canonical build debit
 *  - build_finalization                  — LEGACY path debit (mongo-store
 *      addTransaction era); a single build writes one or the other, never
 *      both (finalizeBuildAuthorization writes no ledger row)
 *  - ai_collaboration                    — collaborate / studio / seo /
 *      resources feature charges
 *  - infrastructure_purchase             — explicit infra credit purchases */
export const PROJECT_CREDIT_CONSUMPTION_TYPES = [
  "runtime_usage",
  "runtime_reservation",
  "build_reservation",
  "build_finalization",
  "ai_collaboration",
  "infrastructure_purchase",
] as const

/** Credit transactionTypes whose amounts offset project consumption.
 *
 * PHASE 3 ALIGNMENT: this list must stay a superset-twin of
 * `CREDIT_REVERSAL_TRANSACTION_TYPES` (lib/billing/reversal-types.ts) — the
 * shared vocabulary the admin reports use. A credits-back row that project
 * accounting failed to recognise here would silently OVERSTATE net consumption
 * (a historical `build_refund` row is exactly that case), so the alignment is
 * pinned by a regression test. Direction still decides the bucket: the
 * classification only nets CREDIT rows, so a `refund_reversal` written by
 * `reverseCredits` (a DEBIT clawback of purchased credits) stays unclassified
 * and never inflates project spend. */
export const PROJECT_CREDIT_REVERSAL_TYPES = [
  "runtime_refund",
  "build_release",
  "build_refund",
  "other_reversal",
  "refund_reversal",
] as const

/** Credit types that fund the ACCOUNT (never netted against project spend).
 * Anything credit-direction outside the reversal set is treated as funding —
 * this catch-all means a future grant type can never leak into netting. */
const NON_REVERSAL_CREDIT_NOTE =
  "credit-direction entries outside the reversal set are funding (grants/purchases/royalties) and never net against project consumption"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProjectCreditEconomics {
  grossConsumedCredits: number
  reversalCredits: number
  netConsumedCredits: number
  /** Reference value of NET consumed credits at the universal valuation. */
  referenceValueUsd: number
  valuationVersion: string
  valuationBasis: string
  byTransactionType: Array<{
    transactionType: string
    direction: "credit" | "debit" | "unknown"
    bucket: "consumption" | "reversal" | "funding_ignored" | "unclassified"
    entries: number
    credits: number
  }>
  /** Debit rows attributed only via legacy referenceType/referenceId (pre-Phase-1 writers). */
  legacyAttributedEntries: number
  entriesWithFirstClassProjectId: number
}

export interface ProjectProviderCostEconomics {
  confirmedByCurrency: Record<string, number>
  estimatedByCurrency: Record<string, number>
  unavailableEventCount: number
  notApplicableEventCount: number
  /** Succeeded events that reported a numeric provider cost (any currency). */
  eventsWithNumericCost: number
  succeededEvents: number
  failedEvents: number
  refundedEvents: number
  costCoverageRatio: number | null
  byCapability: Array<{
    capability: string
    requests: number
    creditsChargedTelemetry: number
    confirmedUsd: number | null
    unavailableCount: number
  }>
  byProvider: Array<{ provider: string; requests: number; confirmedUsd: number | null; unavailableCount: number }>
  byModel: Array<{ model: string; requests: number; confirmedUsd: number | null; unavailableCount: number }>
  daily: Array<{ date: string; requests: number; confirmedUsd: number | null; unavailableCount: number; nonUsdCount: number }>
  note: string
}

export interface ProjectEconomicsDiagnostics {
  accountLevelCreditsExcludedNote: string
  /** Succeeded billable usage events whose creditsCharged > 0 but which carry
   * no ledgerIdempotencyKey — reconciliation candidates, never silently 0. */
  billableUsageWithoutLedgerKey: { count: number; sampleRequestIds: string[] }
  /** Net < 0 means reversals exceeded consumption in the window. */
  negativeNetConsumption: boolean
  nonUsdProviderCostEvents: number
  note: string
}

export interface ProjectEconomics {
  projectId: string
  generatedAt: number
  window: { from: number; to: number }
  credits: ProjectCreditEconomics
  providerCost: ProjectProviderCostEconomics
  diagnostics: ProjectEconomicsDiagnostics
  /** Explicitly uncalculated: recognized revenue needs payment-side
   * recognition rules that no current accounting record provides. Attributed
   * Dodo earnings (a DIFFERENT number — gross collected, not recognized)
   * live in lib/finances/dodo-earnings for the finance pages. */
  recognizedRevenue: {
    status: "not_supported"
    note: string
  }
}

export interface ComputeProjectEconomicsParams {
  projectId: string
  /** The OWNER-checked user id. When provided, ledger queries additionally
   * filter by userId — defense-in-depth against cross-user attribution. */
  userId?: string
  from?: number
  to?: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_RANGE_MS = 90 * DAY_MS

function clampWindow(from?: number, to?: number): { from: number; to: number } {
  const end = to && Number.isFinite(to) ? Math.min(to, Date.now() + 60_000) : Date.now()
  let start = from && Number.isFinite(from) ? from : end - MAX_RANGE_MS
  if (end - start > MAX_RANGE_MS) start = end - MAX_RANGE_MS
  if (start > end) start = end - DAY_MS
  return { from: start, to: end }
}

// ─── Pure classification (unit-tested without Mongo) ────────────────────────

export type LedgerBucket = "consumption" | "reversal" | "funding_ignored" | "unclassified"

/**
 * Classify one ledger `$group` row into the accounting contract.
 * Direction comes from the entry itself; unknown directions are
 * unclassified, never guessed into either bucket.
 */
export function classifyLedgerRow(
  direction: string,
  transactionType: string,
): LedgerBucket {
  if (direction === "debit") {
    return (PROJECT_CREDIT_CONSUMPTION_TYPES as readonly string[]).includes(transactionType)
      ? "consumption"
      : "unclassified"
  }
  if (direction === "credit") {
    if ((PROJECT_CREDIT_REVERSAL_TYPES as readonly string[]).includes(transactionType)) return "reversal"
    return "funding_ignored"
  }
  return "unclassified"
}

export interface LedgerGroupRow {
  _id: { transactionType: string; direction: string } | null
  entries: number
  credits: number
  withProjectId?: number
}

export interface UsageCostGroupRow {
  _id: { numeric: boolean; source: string; currency: string; statusHint: string } | null
  events: number
  amount: number
}

/** Fold grouped ledger rows into the credit economics contract. */
export function foldLedgerRows(rows: LedgerGroupRow[]): {
  economics: Pick<
    ProjectCreditEconomics,
    | "grossConsumedCredits"
    | "reversalCredits"
    | "netConsumedCredits"
    | "byTransactionType"
    | "legacyAttributedEntries"
    | "entriesWithFirstClassProjectId"
  >
  negativeNet: boolean
} {
  let gross = 0
  let reversals = 0
  let firstClass = 0
  let legacyOnly = 0
  const byType: ProjectCreditEconomics["byTransactionType"] = []
  for (const row of rows) {
    const transactionType = row._id?.transactionType ?? "unknown"
    const direction = row._id?.direction === "debit" || row._id?.direction === "credit" ? row._id.direction : "unknown"
    const bucket = classifyLedgerRow(row._id?.direction ?? "", transactionType)
    const amount = typeof row.credits === "number" ? row.credits : 0
    const withProjectId = row.withProjectId ?? 0
    firstClass += withProjectId
    legacyOnly += Math.max(0, row.entries - withProjectId)
    if (bucket === "consumption") gross += amount
    else if (bucket === "reversal") reversals += amount
    byType.push({ transactionType, direction, bucket, entries: row.entries, credits: amount })
  }
  byType.sort((a, b) => b.credits - a.credits)
  return {
    economics: {
      grossConsumedCredits: gross,
      reversalCredits: reversals,
      netConsumedCredits: gross - reversals,
      byTransactionType: byType,
      legacyAttributedEntries: legacyOnly,
      entriesWithFirstClassProjectId: firstClass,
    },
    // Anomaly flag is defined strictly as net < 0 (reversals exceeding
    // consumption in the window); unclassified rows are reported in
    // byTransactionType instead of being folded into the flag.
    negativeNet: gross - reversals < 0,
  }
}

/** Derive a cost status from grouped usage-row parts (same rules as
 * deriveCostStatus, expressed over aggregation dimensions for Mongo rows). */
export function costStatusFromGroupParts(parts: {
  numeric: boolean
  source: string
  currency: string
  statusHint: string
}): ProviderCostStatus {
  // Same precedence as deriveCostStatus: an explicit persisted status is
  // authoritative, derivation only fills in for pre-Phase-2 rows.
  if (
    parts.statusHint === "confirmed" ||
    parts.statusHint === "estimated" ||
    parts.statusHint === "unavailable" ||
    parts.statusHint === "not_applicable"
  ) {
    return parts.statusHint
  }
  if (!parts.numeric) return "unavailable"
  if (parts.source === "provider_estimated") return "estimated"
  // Numeric rows persisted before the status vocabulary were only ever
  // written from provider-reported amounts.
  return "confirmed"
}

/** Fold grouped provider-cost rows into per-currency sums + counts. */
export function foldProviderCostRows(rows: UsageCostGroupRow[]): {
  confirmedByCurrency: Record<string, number>
  estimatedByCurrency: Record<string, number>
  unavailableEventCount: number
  notApplicableEventCount: number
  eventsWithNumericCost: number
  nonUsdEvents: number
} {
  const confirmedByCurrency: Record<string, number> = {}
  const estimatedByCurrency: Record<string, number> = {}
  let unavailable = 0
  let notApplicable = 0
  let numericEvents = 0
  let nonUsdEvents = 0
  for (const row of rows) {
    const parts = row._id ?? { numeric: false, source: "unknown", currency: "unknown", statusHint: "" }
    const status = costStatusFromGroupParts(parts)
    const currency = parts.currency && parts.currency !== "" ? parts.currency.toUpperCase() : "unknown"
    if (status === "unavailable") {
      unavailable += row.events
      continue
    }
    if (status === "not_applicable") {
      notApplicable += row.events
      continue
    }
    numericEvents += row.events
    if (currency !== "USD") nonUsdEvents += row.events
    const target = status === "estimated" ? estimatedByCurrency : confirmedByCurrency
    target[currency] = (target[currency] ?? 0) + row.amount
  }
  return {
    confirmedByCurrency,
    estimatedByCurrency,
    unavailableEventCount: unavailable,
    notApplicableEventCount: notApplicable,
    eventsWithNumericCost: numericEvents,
    nonUsdEvents,
  }
}

// ─── Service ────────────────────────────────────────────────────────────────

const NUMERIC_COST_TYPES = ["double", "int", "long", "decimal"]

export async function computeProjectEconomics(
  params: ComputeProjectEconomicsParams,
): Promise<ProjectEconomics> {
  const { projectId, userId } = params
  const window = clampWindow(params.from, params.to)
  await ensureRuntimeIndexes()

  const [
    ledgerRows,
    usageTotals,
    usageCostRows,
    byCapabilityRows,
    byProviderRows,
    byModelRows,
    daily,
    orphanCount,
    orphanSamples,
  ] = await Promise.all([
      aggregateLedger(projectId, userId, window),
      aggregateUsageTotals(projectId, window),
      aggregateUsageCosts(projectId, window),
      aggregateUsageGrouped(projectId, window, "capability", 50),
      aggregateUsageGrouped(projectId, window, "provider", 20),
      aggregateUsageGrouped(projectId, window, "model", 50),
      aggregateUsageDaily(projectId, window),
      countOrphanBillableUsage(projectId, window),
      sampleOrphanBillableUsage(projectId, window),
    ])

  const folded = foldLedgerRows(ledgerRows)
  const foldedCost = foldProviderCostRows(usageCostRows)
  const net = folded.economics.netConsumedCredits

  return {
    projectId,
    generatedAt: Date.now(),
    window,
    credits: {
      ...folded.economics,
      // AGGREGATE FIRST (integer credits), CONVERT ONCE — established
      // precision contract of lib/billing/credit-valuation.ts.
      referenceValueUsd: consumedCreditsValueUsd(net),
      valuationVersion: CREDIT_VALUATION_VERSION,
      valuationBasis: CREDIT_VALUATION_BASIS,
    },
    providerCost: {
      confirmedByCurrency: foldedCost.confirmedByCurrency,
      estimatedByCurrency: foldedCost.estimatedByCurrency,
      unavailableEventCount: foldedCost.unavailableEventCount,
      notApplicableEventCount: foldedCost.notApplicableEventCount,
      eventsWithNumericCost: foldedCost.eventsWithNumericCost,
      succeededEvents: usageTotals.succeeded,
      failedEvents: usageTotals.failed,
      refundedEvents: usageTotals.refunded,
      costCoverageRatio:
        usageTotals.succeeded > 0 ? foldedCost.eventsWithNumericCost / usageTotals.succeeded : null,
      byCapability: byCapabilityRows.map((r) => ({
        capability: r.key,
        requests: r.requests,
        creditsChargedTelemetry: r.creditsChargedTelemetry,
        confirmedUsd: r.confirmedUsd,
        unavailableCount: r.unavailableCount,
      })),
      byProvider: byProviderRows.map((r) => ({
        provider: r.key,
        requests: r.requests,
        confirmedUsd: r.confirmedUsd,
        unavailableCount: r.unavailableCount,
      })),
      byModel: byModelRows.map((r) => ({
        model: r.key,
        requests: r.requests,
        confirmedUsd: r.confirmedUsd,
        unavailableCount: r.unavailableCount,
      })),
      daily,
      note: "Provider-reported monetary cost, kept per currency and per classification. 'unavailable' means the provider never reported a cost — it is NOT zero. No FX normalization is applied: no documented exchange-rate source exists in this repository (Phase 2 rule).",
    },
    diagnostics: {
      accountLevelCreditsExcludedNote:
        `Account-level ledger movements (purchases, grants, renewals, expirations, refund clawbacks) carry no project attribution and are excluded from every project figure above. ${NON_REVERSAL_CREDIT_NOTE}.`,
      billableUsageWithoutLedgerKey: { count: orphanCount, sampleRequestIds: orphanSamples },
      negativeNetConsumption: folded.negativeNet,
      nonUsdProviderCostEvents: foldedCost.nonUsdEvents,
      note: "These diagnostics are discoverability aids for future reconciliation — the underlying records are never rewritten here.",
    },
    recognizedRevenue: {
      status: "not_supported",
      note:
        "Recognized project revenue is not derivable from current accounting records: Dodo payments are account-level purchases of credits, and attributed app-side earnings (lib/finances/dodo-earnings) are gross collected amounts, not recognized revenue. No profit/margin figure is calculated from the credit valuation (it is a reference value, not revenue).",
    },
  }
}

// ─── Mongo aggregation (bounded) ────────────────────────────────────────────

/** Ledger rows grouped by (transactionType, direction). */
async function aggregateLedger(
  projectId: string,
  userId: string | undefined,
  window: { from: number; to: number },
): Promise<LedgerGroupRow[]> {
  const col = await creditLedgerCol()
  const match: Record<string, unknown> = {
    createdAt: { $gte: window.from, $lte: window.to },
    // First-class attribution OR the legacy reference pair (pre-Phase-1
    // feature writers). Never a client-supplied guess — both halves are
    // server-stamped fields.
    $or: [{ projectId }, { referenceType: "project", referenceId: projectId }],
  }
  if (userId) match.userId = userId
  return col
    .aggregate<LedgerGroupRow>([
      { $match: match },
      {
        $group: {
          _id: { transactionType: "$transactionType", direction: "$direction" },
          entries: { $sum: 1 },
          credits: { $sum: "$amount" },
          withProjectId: { $sum: { $cond: [{ $ifNull: ["$projectId", false] }, 1, 0] } },
        },
      },
      { $sort: { credits: -1 } },
      { $limit: 100 },
    ])
    .toArray()
}

async function aggregateUsageTotals(
  projectId: string,
  window: { from: number; to: number },
): Promise<{ succeeded: number; failed: number; refunded: number; requests: number }> {
  const col = await runtimeUsageCol()
  const [row] = await col
    .aggregate<{ requests: number; succeeded: number; failed: number; refunded: number }>([
      { $match: { projectId, createdAt: { $gte: window.from, $lte: window.to } } },
      {
        $group: {
          _id: null,
          requests: { $sum: 1 },
          succeeded: { $sum: { $cond: [{ $eq: ["$status", "succeeded"] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
          refunded: {
            $sum: { $cond: [{ $eq: ["$costMetadata.refundedAfterPrecharge", true] }, 1, 0] },
          },
        },
      },
    ])
    .toArray()
  return {
    requests: row?.requests ?? 0,
    succeeded: row?.succeeded ?? 0,
    failed: row?.failed ?? 0,
    refunded: row?.refunded ?? 0,
  }
}

/** Group provider-cost rows by (numeric, source, currency, persisted status). */
async function aggregateUsageCosts(
  projectId: string,
  window: { from: number; to: number },
): Promise<UsageCostGroupRow[]> {
  const col = await runtimeUsageCol()
  const numericCond = { $in: [{ $type: "$costMetadata.providerCost" }, NUMERIC_COST_TYPES] }
  // `$toLower` normalizes the grouping dimensions so "USD"/"usd" cannot split
  // into two buckets; foldProviderCostRows re-uppercases currencies and
  // costStatusFromGroupParts matches the lowercased source/statusHint values.
  return col
    .aggregate<UsageCostGroupRow>([
      { $match: { projectId, createdAt: { $gte: window.from, $lte: window.to }, status: "succeeded" } },
      {
        $group: {
          _id: {
            numeric: numericCond,
            source: { $toLower: { $ifNull: ["$costMetadata.providerCostSource", "unknown"] } },
            currency: { $toLower: { $ifNull: ["$costMetadata.providerCostCurrency", "unknown"] } },
            statusHint: { $toLower: { $ifNull: ["$costMetadata.costStatus", ""] } },
          },
          events: { $sum: 1 },
          amount: { $sum: { $cond: [numericCond, { $multiply: ["$costMetadata.providerCost", 1] }, 0] } },
        },
      },
      { $limit: 200 },
    ])
    .toArray()
}

interface UsageGroupRow {
  key: string
  requests: number
  creditsChargedTelemetry: number
  confirmedUsd: number | null
  unavailableCount: number
}

async function aggregateUsageGrouped(
  projectId: string,
  window: { from: number; to: number },
  field: "capability" | "provider" | "model",
  limit: number,
): Promise<UsageGroupRow[]> {
  const col = await runtimeUsageCol()
  const numericCond = { $in: [{ $type: "$costMetadata.providerCost" }, NUMERIC_COST_TYPES] }
  const rows = await col
    .aggregate<{
      _id: string
      requests: number
      creditsCharged: number
      usd: number
      unavailableCount: number
    }>([
      { $match: { projectId, createdAt: { $gte: window.from, $lte: window.to } } },
      {
        $group: {
          _id: { $ifNull: [`$${field}`, "unknown"] },
          requests: { $sum: 1 },
          creditsCharged: { $sum: "$creditsCharged" },
          // Confirmed-USD only sums (currency honesty); estimated/unavailable
          // stay in their own buckets from the dedicated cost aggregation.
          usd: {
            $sum: {
              $cond: [
                { $and: [numericCond, { $eq: ["$costMetadata.providerCostCurrency", "USD"] }] },
                "$costMetadata.providerCost",
                0,
              ],
            },
          },
          unavailableCount: { $sum: { $cond: [numericCond, 0, 1] } },
        },
      },
      { $sort: { requests: -1 } },
      { $limit: limit },
    ])
    .toArray()
  return rows.map((r) => ({
    key: String(r._id),
    requests: r.requests,
    creditsChargedTelemetry: r.creditsCharged,
    confirmedUsd: r.usd > 0 ? r.usd : null,
    unavailableCount: r.unavailableCount,
  }))
}

async function aggregateUsageDaily(
  projectId: string,
  window: { from: number; to: number },
): Promise<ProjectProviderCostEconomics["daily"]> {
  const col = await runtimeUsageCol()
  const numericCond = { $in: [{ $type: "$costMetadata.providerCost" }, NUMERIC_COST_TYPES] }
  const rows = await col
    .aggregate<{
      _id: string
      requests: number
      usd: number
      unavailableCount: number
      nonUsdCount: number
    }>([
      { $match: { projectId, createdAt: { $gte: window.from, $lte: window.to } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: { $dateTrunc: { date: { $add: [new Date(0), "$createdAt"] }, unit: "day" } },
            },
          },
          requests: { $sum: 1 },
          usd: {
            $sum: {
              $cond: [
                { $and: [numericCond, { $eq: ["$costMetadata.providerCostCurrency", "USD"] }] },
                "$costMetadata.providerCost",
                0,
              ],
            },
          },
          unavailableCount: { $sum: { $cond: [numericCond, 0, 1] } },
          nonUsdCount: {
            $sum: { $cond: [{ $and: [numericCond, { $ne: ["$costMetadata.providerCostCurrency", "USD"] }] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 92 },
    ])
    .toArray()
  return rows.map((r) => ({
    date: r._id,
    requests: r.requests,
    confirmedUsd: r.usd > 0 ? r.usd : null,
    unavailableCount: r.unavailableCount,
    nonUsdCount: r.nonUsdCount,
  }))
}

/** Billable succeeded usage rows that carry no ledger correlation key. */
async function countOrphanBillableUsage(
  projectId: string,
  window: { from: number; to: number },
): Promise<number> {
  const col = await runtimeUsageCol()
  return col.countDocuments({
    projectId,
    status: "succeeded",
    creditsCharged: { $gt: 0 },
    createdAt: { $gte: window.from, $lte: window.to },
    $or: [
      { "costMetadata.ledgerIdempotencyKey": { $exists: false } },
      { "costMetadata.ledgerIdempotencyKey": null },
    ],
  })
}

async function sampleOrphanBillableUsage(
  projectId: string,
  window: { from: number; to: number },
): Promise<string[]> {
  const col = await runtimeUsageCol()
  const rows = await col
    .find(
      {
        projectId,
        status: "succeeded",
        creditsCharged: { $gt: 0 },
        createdAt: { $gte: window.from, $lte: window.to },
        $or: [
          { "costMetadata.ledgerIdempotencyKey": { $exists: false } },
          { "costMetadata.ledgerIdempotencyKey": null },
        ],
      },
      { projection: { requestId: 1 }, limit: 5, sort: { createdAt: -1 } },
    )
    .toArray()
  return rows.map((r) => r.requestId)
}
