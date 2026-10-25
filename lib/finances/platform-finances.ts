import "server-only"
import { runtimeUsageCol, ensureRuntimeIndexes } from "@/lib/db/runtime-collections"
import { store } from "@/lib/store/store"
import {
  getProjectEarnings,
  type EarningsResult,
  type ProjectPayment,
} from "./dodo-earnings"
import {
  buildTotals,
  estimateArr,
  mergeDailySeries,
  projectNext30d,
  FINANCE_WINDOW_MS,
  type ArrEstimate,
  type DailyFinancePoint,
  type FinanceProjection,
  type FinanceTotals,
  type ProjectFinances,
} from "./project-finances"

/**
 * Atai Finance — platform-level ("whole business") roll-up (server-only).
 *
 * The user's finances across ALL of their projects, assembled from the same
 * building blocks as the per-project finance page: `runtime_usage` metering
 * (expenses), attributed Dodo payments (earnings), and the shared pure
 * metrics (daily merge, 30-day OLS projection, MRR/ARR estimate).
 *
 * Honesty rules are inherited, unchanged:
 *  - provider cost is never fabricated (missing numeric costs count as
 *    "unavailable", never rewritten to 0),
 *  - unconfigured payment provider → explicit "unavailable" state,
 *  - projections/ARR are labeled ESTIMATES with their basis.
 *
 * Bounds: earnings sweep attributes at most MAX_EARNINGS_PROJECTS projects
 * (each Dodo sync is itself bounded to 3 provider pages); the flag
 * `earningsSweepComplete` reports honestly when a portfolio is larger.
 *
 * @module lib/finances/platform-finances
 */

const DAY_MS = 24 * 60 * 60 * 1000
/** How many projects may sync earnings on one page load. */
export const MAX_EARNINGS_PROJECTS = 25
/** How many projects a portfolio roll-up considers at all. */
const MAX_PROJECTS = 50
/**
 * How many earnings syncs may hit the payment provider at once. A portfolio
 * sweep maps every project to up to MAX_PAGES provider reads; unbounded
 * parallelism fired dozens of simultaneous requests per page load, which the
 * provider throttles (slow responses / 429) and which stalls the page long
 * after the local aggregation has finished.
 */
const EARNINGS_CONCURRENCY = 4

export interface PlatformProjectFinanceRow {
  projectId: string
  projectName: string
  requests: number
  creditsCharged: number
  providerCostUsd: number | null
  /** Attributed earnings in minor units; null when the provider is unavailable. */
  earningsMinor: number | null
  succeededPayments: number
  /** First currency seen among the project's attributed payments sorted. */
  currency: string | null
  lastPaymentAt: number | null
}

export interface PlatformPaymentRow {
  projectId: string
  projectName: string
  paymentId: string
  amountMinor: number | null
  currency: string | null
  status: string
  createdAt: number | null
  subscriptionId: string | null
  customerEmail: string | null
}

export interface PlatformFinances {
  generatedAt: number
  window: { from: number; to: number; days: number }
  daily: DailyFinancePoint[]
  byProject: PlatformProjectFinanceRow[]
  totals: FinanceTotals
  /** Combined over all swept projects (see combineEarningsStatus). */
  earningsStatus: "ok" | "unavailable" | "error"
  earningsNote: string | null
  recentPayments: PlatformPaymentRow[]
  projection: FinanceProjection
  arr: ArrEstimate
  projectsCount: number
  /** false when the portfolio exceeded MAX_EARNINGS_PROJECTS. */
  earningsSweepComplete: boolean
}

// ─── Pure roll-up helpers (unit-tested) ─────────────────────────────────────

export interface ExpenseDayProjectRow {
  /** UTC date bucket (YYYY-MM-DD). */
  date: string
  projectId: string
  requests: number
  succeeded: number
  failed: number
  creditsCharged: number
  providerCostUsd: number
  providerCostUnavailableCount: number
  /** Numeric provider costs in a non-USD currency (counted, never summed in). */
  providerCostNonUsdCount?: number
}

export interface ProjectExpenseTotals {
  requests: number
  creditsCharged: number
  providerCostUsd: number
  providerCostUnavailableCount: number
  providerCostNonUsdCount?: number
}

export interface CollapsedExpenses {
  /** Day-collapsed series (sums across projects) — mergeDailySeries input. */
  daily: Array<{
    date: string
    requests: number
    succeeded: number
    failed: number
    creditsCharged: number
    providerCostUsd: number
    providerCostUnavailableCount: number
    providerCostNonUsdCount?: number
  }>
  /** Platform totals — buildTotals input (checkoutAttempts is always 0: the
   * roll-up does not aggregate per-project checkout attempts). */
  totals: {
    requests: number
    succeeded: number
    failed: number
    creditsCharged: number
    providerCostUsd: number
    providerCostUnavailableCount: number
    providerCostNonUsdCount?: number
    checkoutAttempts: 0
  }
  /** Per-project expense sums keyed by projectId. */
  byProject: Map<string, ProjectExpenseTotals>
}

/** Collapse per-day-per-project expense rows into day totals + project totals. */
export function collapseExpenseRows(rows: ExpenseDayProjectRow[]): CollapsedExpenses {
  const byDate = new Map<string, CollapsedExpenses["daily"][number]>()
  const projects = new Map<string, ProjectExpenseTotals>()

  for (const row of rows) {
    const day =
      byDate.get(row.date) ??
      {
        date: row.date,
        requests: 0,
        succeeded: 0,
        failed: 0,
        creditsCharged: 0,
        providerCostUsd: 0,
        providerCostUnavailableCount: 0,
        providerCostNonUsdCount: 0,
      }
    day.requests += row.requests
    day.succeeded += row.succeeded
    day.failed += row.failed
    day.creditsCharged += row.creditsCharged
    day.providerCostUsd += row.providerCostUsd
    day.providerCostUnavailableCount += row.providerCostUnavailableCount
    day.providerCostNonUsdCount = (day.providerCostNonUsdCount ?? 0) + (row.providerCostNonUsdCount ?? 0)
    byDate.set(row.date, day)

    const project =
      projects.get(row.projectId) ??
      { requests: 0, creditsCharged: 0, providerCostUsd: 0, providerCostUnavailableCount: 0, providerCostNonUsdCount: 0 }
    project.requests += row.requests
    project.creditsCharged += row.creditsCharged
    project.providerCostUsd += row.providerCostUsd
    project.providerCostUnavailableCount += row.providerCostUnavailableCount
    project.providerCostNonUsdCount = (project.providerCostNonUsdCount ?? 0) + (row.providerCostNonUsdCount ?? 0)
    projects.set(row.projectId, project)
  }

  const dailyValues = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return {
    daily: dailyValues,
    totals: {
      requests: dailyValues.reduce((a, r) => a + r.requests, 0),
      succeeded: dailyValues.reduce((a, r) => a + r.succeeded, 0),
      failed: dailyValues.reduce((a, r) => a + r.failed, 0),
      creditsCharged: dailyValues.reduce((a, r) => a + r.creditsCharged, 0),
      providerCostUsd: dailyValues.reduce((a, r) => a + r.providerCostUsd, 0),
      providerCostUnavailableCount: dailyValues.reduce((a, r) => a + r.providerCostUnavailableCount, 0),
      providerCostNonUsdCount: dailyValues.reduce((a, r) => a + (r.providerCostNonUsdCount ?? 0), 0),
      checkoutAttempts: 0,
    },
    byProject: projects,
  }
}

export interface EarningsStatusInput {
  status: EarningsResult["status"]
  note?: string | null
}

/**
 * Combine per-project earnings feed statuses, honestly:
 *  - ANY "ok" → ok (at least one project read real payments),
 *  - else any "error" → error (provider reachable but refused/faulted),
 *  - else (all "unavailable") → unavailable, with the shared setup note.
 * No input is treated as "unavailable" with no note (zero projects swept is
 * a distinct state the view explains).
 */
export function combineEarningsStatus(entries: EarningsStatusInput[]): {
  status: "ok" | "unavailable" | "error"
  note: string | null
} {
  const hasOk = entries.some((e) => e.status === "ok")
  if (hasOk) return { status: "ok", note: null }
  const firstError = entries.find((e) => e.status === "error")
  if (firstError) {
    return { status: "error", note: firstError.note ?? "The payment provider could not be reached for this portfolio." }
  }
  const firstUnavailable = entries.find((e) => e.status === "unavailable")
  return {
    status: "unavailable",
    note: firstUnavailable?.note ?? null,
  }
}

export interface PortfolioEntry {
  projectId: string
  projectName: string
  expense: {
    requests: number
    creditsCharged: number
    providerCostUsd: number
    providerCostUnavailableCount: number
  }
  earnings: EarningsResult
}

/** One portfolio-table row per project; sorted by credit spend, descending. */
export function portfolioProjectRows(entries: PortfolioEntry[]): PlatformProjectFinanceRow[] {
  const rows: PlatformProjectFinanceRow[] = []
  for (const entry of entries) {
    const okPayments = entry.earnings.status === "ok" ? entry.earnings.payments : []
    let earningsMinor = 0
    let succeededPayments = 0
    let lastPaymentAt: number | null = null
    for (const p of okPayments) {
      if (p.status === "succeeded" && typeof p.amountMinor === "number") earningsMinor += p.amountMinor
      if (p.status === "succeeded") succeededPayments += 1
      if (p.createdAt !== null && (lastPaymentAt === null || p.createdAt > lastPaymentAt)) {
        lastPaymentAt = p.createdAt
      }
    }
    const currencies = [...new Set(okPayments.map((p) => p.currency).filter((c): c is string => Boolean(c)))].sort()
    const providerCostUsd =
      entry.expense.providerCostUnavailableCount < entry.expense.requests || entry.expense.providerCostUsd > 0
        ? entry.expense.providerCostUsd
        : null
    rows.push({
      projectId: entry.projectId,
      projectName: entry.projectName,
      requests: entry.expense.requests,
      creditsCharged: entry.expense.creditsCharged,
      providerCostUsd,
      // Distinct from 0: null = the portfolio's feed state does not cover
      // this project's earnings truthfully (unconfigured or failed).
      earningsMinor: entry.earnings.status === "ok" ? earningsMinor : null,
      succeededPayments,
      currency: currencies[0] ?? null,
      lastPaymentAt,
    })
  }
  return rows.sort((a, b) => b.creditsCharged - a.creditsCharged)
}

/** Merge recent attributed payments across projects; tagged, newest first. */
export function mergeRecentPayments(entries: PortfolioEntry[], limit = 20): PlatformPaymentRow[] {
  const rows: PlatformPaymentRow[] = []
  for (const entry of entries) {
    if (entry.earnings.status !== "ok") continue
    for (const p of entry.earnings.payments) {
      rows.push({
        projectId: entry.projectId,
        projectName: entry.projectName,
        paymentId: p.paymentId,
        amountMinor: p.amountMinor,
        currency: p.currency,
        status: p.status,
        createdAt: p.createdAt,
        subscriptionId: p.subscriptionId,
        customerEmail: p.customerEmail,
      })
    }
  }
  // Un-parseable dates sort last (they never claim recency they don't have).
  return rows
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, limit)
}

/** Run `fn` over `items` with at most `limit` in flight; order is preserved. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (let index = next++; index < items.length; index = next++) {
      results[index] = await fn(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

// ─── Expenses: one bounded aggregation across all projects ─────────────────

const NUMERIC_PROVIDER_TYPES: string[] = ["double", "int", "long", "decimal"]
const EPOCH_DATE = new Date(0)

async function aggregatePlatformExpenses(
  projectIds: string[],
  from: number,
  to: number,
): Promise<CollapsedExpenses> {
  if (projectIds.length === 0) return collapseExpenseRows([])
  await ensureRuntimeIndexes()
  const col = await runtimeUsageCol()

  const numericCostCond = { $in: [{ $type: "$costMetadata.providerCost" }, NUMERIC_PROVIDER_TYPES] }
  // Phase 2 currency honesty: only USD-denominated provider reports sum into
  // providerCostUsd; other currencies are counted, never mixed or converted.
  const providerCostExpr = {
    $cond: [
      { $and: [numericCostCond, { $eq: ["$costMetadata.providerCostCurrency", "USD"] }] },
      "$costMetadata.providerCost",
      0,
    ],
  }
  const providerNonUsdExpr = {
    $cond: [{ $and: [numericCostCond, { $ne: ["$costMetadata.providerCostCurrency", "USD"] }] }, 1, 0],
  }
  const providerMissingExpr = {
    $cond: [numericCostCond, 0, 1],
  }

  const rows = await col
    .aggregate<ExpenseDayProjectRow>([
      { $match: { projectId: { $in: projectIds }, createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: { $dateTrunc: { date: { $add: [EPOCH_DATE, "$createdAt"] }, unit: "day" } },
              },
            },
            projectId: "$projectId",
          },
          requests: { $sum: 1 },
          succeeded: { $sum: { $cond: [{ $eq: ["$status", "succeeded"] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
          creditsCharged: { $sum: "$creditsCharged" },
          providerCostUsd: { $sum: providerCostExpr },
          providerNonUsd: { $sum: providerNonUsdExpr },
          providerUnavailable: { $sum: providerMissingExpr },
        },
      },
      { $sort: { "_id.date": 1 } },
      { $project: { _id: 0, date: "$_id.date", projectId: "$_id.projectId", requests: 1, succeeded: 1, failed: 1, creditsCharged: 1, providerCostUsd: 1, providerCostUnavailableCount: "$providerUnavailable", providerCostNonUsdCount: "$providerNonUsd" } },
    ])
    .toArray()

  return collapseExpenseRows(rows)
}

// ─── Assembly ───────────────────────────────────────────────────────────────

/** Assemble the whole-business finance view for one user. Read-only. */
export async function getPlatformFinances(userId: string): Promise<PlatformFinances> {
  const to = Date.now()
  const from = to - FINANCE_WINDOW_MS

  const projects = await store.listProjects(userId, MAX_PROJECTS)
  const projectIds = projects.map((p) => p.id)
  // The earnings sweep is bounded: each project sync costs up to 3 provider
  // pages, so a large portfolio syncs only its most recently-updated slice
  // and reports the truncation honestly instead of blocking the page.
  const sweep = projects.slice(0, MAX_EARNINGS_PROJECTS)

  // The expense aggregation and the provider sweep run concurrently, but the
  // portfolio rows are assembled only AFTER `Promise.all` resolves — reading
  // the `expenses` binding from inside the map callbacks is a temporal dead
  // zone error (it is not initialized until the destructuring completes).
  const [expenses, earningsResults] = await Promise.all([
    aggregatePlatformExpenses(projectIds, from, to),
    mapWithConcurrency(sweep, EARNINGS_CONCURRENCY, (p) => getProjectEarnings(p.id, from)),
  ])

  const entries: PortfolioEntry[] = sweep.map((p, index) => ({
    projectId: p.id,
    projectName: p.name,
    expense:
      expenses.byProject.get(p.id) ??
      { requests: 0, creditsCharged: 0, providerCostUsd: 0, providerCostUnavailableCount: 0 },
    earnings: earningsResults[index],
  }))

  const allPayments: ProjectPayment[] = entries.flatMap((e) =>
    e.earnings.status === "ok" ? e.earnings.payments : [],
  )
  const combined =
    entries.length === 0
      ? { status: "unavailable" as const, note: "You have no projects yet — your portfolio finances roll up here once you create one." }
      : combineEarningsStatus(
          entries.map((e): EarningsStatusInput =>
            e.earnings.status === "ok"
              ? { status: "ok" }
              : { status: e.earnings.status, note: e.earnings.note },
          ),
        )

  const daily = mergeDailySeries(expenses.daily, allPayments)
  const totals = buildTotals(
    { daily: expenses.daily, totals: expenses.totals },
    { status: combined.status, payments: allPayments },
    from,
    to,
  )
  const projection = projectNext30d(daily)
  const arr = estimateArr(allPayments)

  return {
    generatedAt: to,
    window: { from, to, days: Math.round(FINANCE_WINDOW_MS / DAY_MS) },
    daily,
    byProject: portfolioProjectRows(entries),
    totals,
    earningsStatus: combined.status,
    earningsNote: combined.note,
    recentPayments: mergeRecentPayments(entries),
    projection,
    arr,
    projectsCount: projects.length,
    earningsSweepComplete: projects.length <= MAX_EARNINGS_PROJECTS,
  }
}

/** Keep the re-export surface explicit: the view builds on ProjectFinances types. */
export type { ProjectFinances }

// ─── Home-dashboard mini trend ─────────────────────────────────────────────

/** Days the dashboard mini-card trend covers. */
export const SPEND_TREND_DAYS = 28

export interface SpendTrend {
  /** UTC date buckets (oldest first), zero-filled — honest, gapless days. */
  daily: Array<{ date: string; creditsCharged: number; earningsMinor: number }>
  creditsTotal14d: number
  creditsPrior14d: number
  /** Percent change of the last 14 days vs the prior 14; null when the prior
   * window saw zero spend (no honest percentage exists). */
  changePct: number | null
  /** Attributed earnings over the same last-14-days window, minor units;
   * null when no project's earnings feed reported "ok" — unavailable ≠ 0. */
  earningsTotal14d: number | null
  netTotal14d: number | null
  /** Currencies seen in the swept attributed earnings (for honest display). */
  earningsCurrencies: string[]
}

/**
 * Week-over-week spending direction from a zero-filled daily series — the
 * small honest math the dashboard mini-card titles itself with.
 */
export function spendTrend(daily: Array<{ date: string; creditsCharged: number }>): Pick<SpendTrend, "creditsTotal14d" | "creditsPrior14d" | "changePct"> {
  const last14 = daily.slice(-14)
  const prior14 = daily.slice(-28, -14)
  const sum = (rows: Array<{ creditsCharged: number }>) => rows.reduce((a, r) => a + r.creditsCharged, 0)
  const total = sum(last14)
  const prior = sum(prior14)
  return {
    creditsTotal14d: total,
    creditsPrior14d: prior,
    changePct: prior === 0 ? null : Math.round(((total - prior) / prior) * 100),
  }
}

/**
 * Fold successful attributed payments into the zero-filled daily trend
 * buckets (same honesty rules as the finance pages: only succeeded amounts
 * count, un-parseable dates are not day-bucketed). Pure and unit-tested.
 */
export function mergeEarningsIntoDaily(
  daily: Array<{ date: string; creditsCharged: number }>,
  payments: Array<Pick<ProjectPayment, "amountMinor" | "currency" | "status" | "createdAt">>,
): Array<{ date: string; creditsCharged: number; earningsMinor: number }> {
  const earningsByDate = new Map<string, number>()
  for (const p of payments) {
    if (p.status !== "succeeded" || typeof p.amountMinor !== "number" || p.createdAt === null) continue
    const date = new Date(p.createdAt).toISOString().slice(0, 10)
    earningsByDate.set(date, (earningsByDate.get(date) ?? 0) + p.amountMinor)
  }
  return daily.map((d) => ({ ...d, earningsMinor: earningsByDate.get(d.date) ?? 0 }))
}

/**
 * Bounded portfolio spending + earnings trend for the home dashboard
 * mini-card: one Mongo aggregation (all owned projects, 28 days, UTC day
 * buckets), zero-filled, the week-over-window spend comparison, and the
 * attributed earnings over the same window via the SAME bounded sweep the
 * platform finance page uses (≤ MAX_EARNINGS_PROJECTS projects, each its
 * own cached sync). Read-only.
 */
export async function getPortfolioSpendTrend(userId: string): Promise<SpendTrend> {
  const to = Date.now()
  const from = to - SPEND_TREND_DAYS * DAY_MS

  const projects = await store.listProjects(userId, MAX_PROJECTS)
  const projectIds = projects.map((p) => p.id)

  let dayRows: Array<{ _id: string; creditsCharged: number }> = []
  let earningsDaily: Array<{ date: string; creditsCharged: number; earningsMinor: number }> = []
  let earningsTotal14d: number | null = null
  let netTotal14d: number | null = null
  const earningsCurrencies = new Set<string>()

  if (projectIds.length > 0) {
    const sweep = projects.slice(0, MAX_EARNINGS_PROJECTS)
    const [earningsResults] = await Promise.all([
      mapWithConcurrency(sweep, EARNINGS_CONCURRENCY, (p) => getProjectEarnings(p.id, from)),
      (async () => {
        await ensureRuntimeIndexes()
        const col = await runtimeUsageCol()
        dayRows = await col
          .aggregate<{ _id: string; creditsCharged: number }>([
            { $match: { projectId: { $in: projectIds }, createdAt: { $gte: from, $lte: to } } },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: { $dateTrunc: { date: { $add: [EPOCH_DATE, "$createdAt"] }, unit: "day" } },
                  },
                },
                creditsCharged: { $sum: "$creditsCharged" },
              },
            },
            { $sort: { _id: 1 } },
          ])
          .toArray()
      })(),
    ])

    // Zero-fill every day of the window — gaps are honest zeros. Oldest first.
    const creditsByDate = new Map(dayRows.map((r) => [r._id, r.creditsCharged]))
    const creditsDaily: Array<{ date: string; creditsCharged: number }> = []
    for (let day = SPEND_TREND_DAYS - 1; day >= 0; day--) {
      const date = new Date(to - day * DAY_MS).toISOString().slice(0, 10)
      creditsDaily.push({ date, creditsCharged: creditsByDate.get(date) ?? 0 })
    }

    // Earnings: only feeds that reported "ok" contribute. If none did, the
    // earnings fields stay null — unavailable, never a fabricated zero.
    const okResults = earningsResults.filter((r) => r.status === "ok")
    const allPayments = okResults.flatMap((r) => r.payments)
    earningsDaily = mergeEarningsIntoDaily(creditsDaily, allPayments)
    if (okResults.length > 0) {
      for (const p of allPayments) {
        if (p.currency) earningsCurrencies.add(p.currency)
      }
      const earnings14 = earningsDaily.slice(-14).reduce((a, r) => a + r.earningsMinor, 0)
      const credits14 = earningsDaily.slice(-14).reduce((a, r) => a + r.creditsCharged, 0)
      earningsTotal14d = earnings14
      netTotal14d = earnings14 - credits14
    }
  }

  const daily = earningsDaily.length > 0 ? earningsDaily : Array.from({ length: SPEND_TREND_DAYS }, (_, i) => ({
    date: new Date(to - (SPEND_TREND_DAYS - 1 - i) * DAY_MS).toISOString().slice(0, 10),
    creditsCharged: 0,
    earningsMinor: 0,
  }))

  return {
    daily,
    ...spendTrend(daily),
    earningsTotal14d,
    netTotal14d,
    earningsCurrencies: [...earningsCurrencies].sort(),
  }
}
