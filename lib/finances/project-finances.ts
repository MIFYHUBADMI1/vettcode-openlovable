import "server-only"
import {
  breakdownByCapability,
} from "@/lib/runtime/control/breakdown"
import { runtimeUsageCol, ensureRuntimeIndexes } from "@/lib/db/runtime-collections"
import {
  getProjectEarnings,
  type ProjectPayment,
} from "./dodo-earnings"

/**
 * Atai Finance — project-scoped finance assembly (server-authoritative).
 *
 * Combines the two real data sources a project's money story has today:
 *
 *  1. EXPENSES — `runtime_usage` (per-request metering): every runtime call
 *     the project's API keys made, with the credits they charged and the
 *     provider-reported monetary cost where the provider offered one.
 *  2. EARNINGS — attributed Dodo payments: completed payments the project's
 *     generated applications collected through the runtime `payments`
 *     capability (attribution stamped server-side by the adapter).
 *
 * Honesty rules (mirroring the runtime's finance audit):
 *  - Provider cost is NEVER fabricated: a day with no numeric provider cost
 *    records "unavailable", not 0.
 *  - Unconfigured payment provider → explicit "unavailable" state.
 *  - Projections are labeled ESTIMATES with their basis; insufficient data
 *    yields "insufficientData" instead of a fabricated trend.
 *  - ARR/valuation are ROUGH ESTIMATES derived from attributed subscription
 *    payments only — never presented as actuals.
 *
 * @module lib/finances/project-finances
 */

const DAY_MS = 24 * 60 * 60 * 1000
/** Analysis window: 90 days of history (matches the usage analytics cap). */
export const FINANCE_WINDOW_MS = 90 * DAY_MS
/** Basis of the recurring-revenue estimate. */
const VALUATION_MULTIPLE = 2.5
const UTC_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface DailyFinancePoint {
  /** UTC date bucket (YYYY-MM-DD). */
  date: string
  requests: number
  creditsCharged: number
  /** Sum of numeric provider costs that day; null when none reported one. */
  providerCostUsd: number | null
  /** How many events that day reported no numeric provider cost. */
  providerCostUnavailableCount: number
  /** Attributed gross earnings that day, minor units (0 when none). */
  earningsMinor: number
  paymentsCount: number
}

export interface FinanceTotals {
  from: number
  to: number
  requests: number
  succeeded: number
  failed: number
  creditsCharged: number
  providerCostUsd: number | null
  providerCostUnavailableCount: number
  /** Number of payments.createCheckout/createSubscription calls in the window. */
  checkoutAttempts: number
  /** Attributed earnings in the window; null when the provider is unavailable. */
  earningsMinor: number | null
  earningsUnavailable: boolean
  succeededPayments: number
  pendingPayments: number
  /** Distinct currencies seen in attributed payments. */
  currencies: string[]
}

export interface CapabilityFinanceRow {
  key: string
  requests: number
  creditsCharged: number
  providerCostUsd: number | null
}

export interface FinanceProjection {
  kind: "estimate"
  projected30dCredits: number | null
  projected30dEarningsMinor: number | null
  insufficientData: boolean
  basis: string
}

export interface ArrEstimate {
  kind: "estimate"
  /** Monthly recurring revenue in minor units (dominant currency). */
  mrrMinor: number | null
  mrrCurrency: string | null
  arrMinor: number | null
  valuationMinor: number | null
  mixedCurrency: boolean
  recurringPaymentsObserved: number
  basis: string
}

export interface ProjectFinances {
  projectId: string
  generatedAt: number
  window: { from: number; to: number; days: number }
  daily: DailyFinancePoint[]
  byCapability: CapabilityFinanceRow[]
  totals: FinanceTotals
  earningsStatus: "ok" | "unavailable" | "error"
  earningsNote: string | null
  recentPayments: Array<{
    paymentId: string
    amountMinor: number | null
    currency: string | null
    status: string
    createdAt: number | null
    subscriptionId: string | null
    customerEmail: string | null
  }>
  projection: FinanceProjection
  arr: ArrEstimate
}

/** Assemble the full finance view for one owned project. */
export async function getProjectFinances(projectId: string): Promise<ProjectFinances> {
  const to = Date.now()
  const from = to - FINANCE_WINDOW_MS

  const [expenses, earnings, capabilityRows] = await Promise.all([
    aggregateDailyExpenses(projectId, from, to),
    getProjectEarnings(projectId, from),
    capabilityFinanceRows(projectId, from, to),
  ])

  const daily = mergeDailySeries(expenses.daily, earnings.payments)
  const totals = buildTotals(expenses, earnings, from, to)
  const projection = projectNext30d(daily)
  const arr = estimateArr(earnings.payments)

  return {
    projectId,
    generatedAt: to,
    window: { from, to, days: Math.round(FINANCE_WINDOW_MS / DAY_MS) },
    daily,
    byCapability: capabilityRows,
    totals,
    earningsStatus: earnings.status,
    earningsNote: earnings.status === "ok" ? null : earnings.note,
    recentPayments: earnings.payments
      .slice()
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, 20)
      .map((p) => ({
        paymentId: p.paymentId,
        amountMinor: p.amountMinor,
        currency: p.currency,
        status: p.status,
        createdAt: p.createdAt,
        subscriptionId: p.subscriptionId,
        customerEmail: p.customerEmail,
      })),
    projection,
    arr,
  }
}

// ─── Expenses: runtime_usage aggregation ────────────────────────────────────

interface ExpenseAggregate {
  daily: Array<{
    date: string
    requests: number
    creditsCharged: number
    providerCostUsd: number
    providerCostUnavailableCount: number
  }>
  totals: {
    requests: number
    succeeded: number
    failed: number
    creditsCharged: number
    providerCostUsd: number
    providerCostUnavailableCount: number
    checkoutAttempts: number
  }
}

const NUMERIC_PROVIDER_TYPES: string[] = ["double", "int", "long", "decimal"]

/**
 * Bounded Mongo aggregation over the project's runtime_usage records.
 * Buckets are UTC days via $dateTrunc (createdAt is stored as epoch-ms).
 */
async function aggregateDailyExpenses(
  projectId: string,
  from: number,
  to: number,
): Promise<ExpenseAggregate> {
  await ensureRuntimeIndexes()
  const col = await runtimeUsageCol()
  const match = { projectId, createdAt: { $gte: from, $lte: to } }

  const providerCostExpr = {
    $cond: [
      { $in: [{ $type: "$costMetadata.providerCost" }, NUMERIC_PROVIDER_TYPES] },
      "$costMetadata.providerCost",
      0,
    ],
  }
  const providerMissingExpr = {
    $cond: [
      { $in: [{ $type: "$costMetadata.providerCost" }, NUMERIC_PROVIDER_TYPES] },
      0,
      1,
    ],
  }

  const [dayRows, totalsRows] = await Promise.all([
    col
      .aggregate<ExpenseDailyRow>([
        { $match: match },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: { $dateTrunc: { date: { $add: [EPOCH_DATE, "$createdAt"] }, unit: "day" } },
              },
            },
            requests: { $sum: 1 },
            succeeded: { $sum: { $cond: [{ $eq: ["$status", "succeeded"] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
            creditsCharged: { $sum: "$creditsCharged" },
            providerCostUsd: { $sum: providerCostExpr },
            providerMissing: { $sum: providerMissingExpr },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
    col
      .aggregate<ExpenseTotalsRow>([
        { $match: match },
        {
          $group: {
            _id: null,
            requests: { $sum: 1 },
            succeeded: { $sum: { $cond: [{ $eq: ["$status", "succeeded"] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
            creditsCharged: { $sum: "$creditsCharged" },
            providerCostUsd: { $sum: providerCostExpr },
            providerMissing: { $sum: providerMissingExpr },
            checkoutAttempts: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ["$capability", "payments"] },
                      { $eq: ["$operation", "createCheckout"] },
                      { $eq: ["$operation", "createSubscription"] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ])
      .toArray(),
  ],
  )

  return {
    daily: dayRows.map((r) => ({
      date: r._id,
      requests: r.requests,
      creditsCharged: r.creditsCharged,
      providerCostUsd: r.providerCostUsd,
      providerCostUnavailableCount: r.providerMissing,
    })),
    totals: {
      requests: totalsRows[0]?.requests ?? 0,
      succeeded: totalsRows[0]?.succeeded ?? 0,
      failed: totalsRows[0]?.failed ?? 0,
      creditsCharged: totalsRows[0]?.creditsCharged ?? 0,
      providerCostUsd: totalsRows[0]?.providerCostUsd ?? 0,
      providerCostUnavailableCount: totalsRows[0]?.providerMissing ?? 0,
      checkoutAttempts: totalsRows[0]?.checkoutAttempts ?? 0,
    },
  }
}

/** The epoch literal used to turn epoch-ms numbers into BSON dates. */
const EPOCH_DATE = new Date(0)

interface ExpenseDailyRow {
  _id: string
  requests: number
  succeeded: number
  failed: number
  creditsCharged: number
  providerCostUsd: number
  providerMissing: number
}

interface ExpenseTotalsRow extends Omit<ExpenseDailyRow, "_id"> {
  _id: null
  checkoutAttempts: number
}

interface CapabilityDailyRow {
  _id: string
  requests: number
  creditsCharged: number
  providerCostUsd: number
  providerMissing: number
}

async function capabilityFinanceRows(
  projectId: string,
  from: number,
  to: number,
): Promise<CapabilityFinanceRow[]> {
  const rows = await breakdownByCapability(projectId, { from, to })
  return rows.map((r) => ({
    key: r.key,
    requests: r.requests,
    creditsCharged: r.creditsCharged,
    providerCostUsd: r.providerCostUsd,
  }))
}

// ─── Series merging & metrics (pure, unit-tested) ──────────────────────────

function utcDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/**
 * Merge the daily expense buckets with attributed payments into one series
 * covering EVERY day of the window (zero-filled — gaps are honest zeros, not
 * missing days). Payments with no parseable date are not day-bucketed.
 */
export function mergeDailySeries(
  expenses: Array<{ date: string; creditsCharged: number; providerCostUsd: number | null; providerCostUnavailableCount: number; requests?: number }>,
  payments: ProjectPayment[],
): DailyFinancePoint[] {
  const byDate = new Map<string, DailyFinancePoint>()
  for (const expense of expenses) {
    if (!UTC_DATE_RE.test(expense.date)) continue
    byDate.set(expense.date, {
      date: expense.date,
      requests: expense.requests ?? 0,
      creditsCharged: expense.creditsCharged,
      providerCostUsd: expense.providerCostUsd,
      providerCostUnavailableCount: expense.providerCostUnavailableCount,
      earningsMinor: 0,
      paymentsCount: 0,
    })
  }

  for (const payment of payments) {
    if (payment.createdAt === null) continue
    const date = utcDateKey(payment.createdAt)
    const point = byDate.get(date)
    const entry: DailyFinancePoint =
      point ??
      {
        date,
        requests: 0,
        creditsCharged: 0,
        providerCostUsd: null,
        providerCostUnavailableCount: 0,
        earningsMinor: 0,
        paymentsCount: 0,
      }
    entry.paymentsCount += 1
    if (payment.status === "succeeded" && typeof payment.amountMinor === "number") {
      entry.earningsMinor += payment.amountMinor
    }
    byDate.set(date, entry)
  }

  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/** Shared with the platform-level roll-up (same honesty rules). */
export function buildTotals(
  expenses: ExpenseAggregate,
  earnings: { status: "ok" | "unavailable" | "error"; payments: ProjectPayment[] },
  from: number,
  to: number,
): FinanceTotals {
  const earningsAvailable = earnings.status === "ok"
  let earningsMinor = 0
  let succeeded = 0
  let pending = 0
  const currencies = new Set<string>()
  for (const p of earnings.payments) {
    if (p.status === "succeeded") {
      succeeded += 1
      if (typeof p.amountMinor === "number") earningsMinor += p.amountMinor
    } else if (p.status !== "failed" && p.status !== "cancelled") {
      pending += 1
    }
    if (p.currency) currencies.add(p.currency)
  }
  return {
    from,
    to,
    requests: expenses.totals.requests,
    succeeded: expenses.totals.succeeded,
    failed: expenses.totals.failed,
    creditsCharged: expenses.totals.creditsCharged,
    providerCostUsd:
      expenses.totals.providerCostUnavailableCount < expenses.totals.requests || expenses.totals.providerCostUsd > 0
        ? expenses.totals.providerCostUsd
        : null,
    providerCostUnavailableCount: expenses.totals.providerCostUnavailableCount,
    checkoutAttempts: expenses.totals.checkoutAttempts,
    earningsMinor: earningsAvailable ? earningsMinor : null,
    earningsUnavailable: !earningsAvailable,
    succeededPayments: succeeded,
    pendingPayments: pending,
    currencies: [...currencies].sort(),
  }
}

/**
 * Linear least-squares trend over the daily series, projected 30 days ahead.
 * Fewer than 4 observed days (or all-zero series) → insufficientData — the
 * dashboard shows the honest state instead of a fabricated forecast.
 */
export function projectNext30d(
  daily: DailyFinancePoint[],
): FinanceProjection {
  const points = daily.filter(
    (d) => d.requests > 0 || d.paymentsCount > 0,
  )
  if (points.length < 4 || daily.length < 7) {
    return {
      kind: "estimate",
      projected30dCredits: null,
      projected30dEarningsMinor: null,
      insufficientData: true,
      basis: `Not enough history for a trend yet (${points.length} active day${points.length === 1 ? "" : "s"} of ${daily.length || 0} observed).`,
    }
  }

  // Index by day distance from the first observed day.
  const startIndex = daily.findIndex((d) => d.date === points[0]?.date)
  const xs: number[] = []
  const cs: number[] = []
  const es: number[] = []
  for (const point of points) {
    xs.push(daily.findIndex((d) => d.date === point.date) - startIndex)
    cs.push(point.creditsCharged)
    es.push(point.earningsMinor)
  }

  const linearProjection = (xs: number[], ys: number[]): number => {
    const slope = linearSlope(xs, ys)
    const meanX = xs.reduce((a, b) => a + b, 0) / xs.length
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length
    // OLS line y = intercept + slope·x; the 30-day forecast is the sum of the
    // fitted daily rates for the 30 days after the last observation.
    const intercept = meanY - slope * meanX
    const lastX = xs[xs.length - 1]
    let total = 0
    for (let t = 1; t <= 30; t++) total += intercept + slope * (lastX + t)
    return Math.max(0, Math.round(total))
  }

  const lastEarnings = es.reduce((a, b) => a + b, 0)

  return {
    kind: "estimate",
    projected30dCredits: linearProjection(xs, cs),
    // A series with zero earnings in every observed day legitimately projects
    // no earnings (null), not zero — different from "trend says zero".
    projected30dEarningsMinor: lastEarnings === 0 ? null : linearProjection(xs, es),
    insufficientData: false,
    basis: `Least-squares trend over ${xs.length} active day${xs.length === 1 ? "" : "s"} since ${points[0]?.date ?? "?"}, projected onto the next 30 days — ESTIMATE, not a forecast guarantee.`,
  }
}

/** Ordinary least squares slope; 0 for degenerate input. */
export function linearSlope(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n < 2) return 0
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  for (let i = 0; i < n; i++) {
    sumX += xs[i]
    sumY += ys[i]
    sumXY += xs[i] * ys[i]
    sumXX += xs[i] * xs[i]
  }
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return 0
  return (n * sumXY - sumX * sumY) / denom
}

/**
 * Recurring-revenue estimate from attributed payments: successful
 * subscription-attributed payments observed in the last 31 days, collapsed
 * to the DOMINANT currency (mixed currencies are flagged, never silently
 * summed). ARR = MRR × 12; valuation is a ROUGH multiple of ARR.
 */
export function estimateArr(payments: ProjectPayment[]): ArrEstimate {
  const cutoff = Date.now() - 31 * DAY_MS
  const recurring = payments.filter(
    (p) =>
      p.subscriptionId !== null &&
      p.status === "succeeded" &&
      p.createdAt !== null &&
      p.createdAt >= cutoff &&
      typeof p.amountMinor === "number",
  )

  if (recurring.length === 0) {
    return {
      kind: "estimate",
      mrrMinor: null,
      mrrCurrency: null,
      arrMinor: null,
      valuationMinor: null,
      mixedCurrency: false,
      recurringPaymentsObserved: 0,
      basis: "No attributed subscription payments in the last 31 days yet — recurring revenue shows once subscriptions start paying.",
    }
  }

  const byCurrency = new Map<string, number>()
  const counts = new Map<string, number>()
  for (const p of recurring) {
    const cur = p.currency ?? "unknown"
    byCurrency.set(cur, (byCurrency.get(cur) ?? 0) + (p.amountMinor as number))
    counts.set(cur, (counts.get(cur) ?? 0) + 1)
  }
  let dominantCurrency = "unknown"
  let dominantCount = 0
  for (const [cur, n] of counts) {
    if (n > dominantCount) {
      dominantCurrency = cur
      dominantCount = n
    }
  }
  const mixedCurrency = counts.size > 1
  const mrrMinor = byCurrency.get(dominantCurrency) ?? 0
  const arrMinor = mrrMinor * 12

  return {
    kind: "estimate",
    mrrMinor,
    mrrCurrency: dominantCurrency === "unknown" ? null : dominantCurrency,
    arrMinor,
    valuationMinor: Math.round(arrMinor * VALUATION_MULTIPLE),
    mixedCurrency,
    recurringPaymentsObserved: recurring.length,
    basis: `Rough estimate: MRR from ${recurring.length} attributed subscription payment${recurring.length === 1 ? "" : "s"} in the last 31 days (dominant currency ${dominantCurrency}), ARR = MRR × 12, valuation = ARR × ${VALUATION_MULTIPLE}${mixedCurrency ? " — mixed currencies: only the dominant currency is included" : ""}. Not an actual valuation.`,
  }
}
