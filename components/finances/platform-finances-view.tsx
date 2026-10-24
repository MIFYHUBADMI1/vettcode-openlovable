import {
  CircleAlert,
  FolderKanban,
  Info,
  Landmark,
  TrendingUp,
  Wallet,
} from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import type { PlatformFinances } from "@/lib/finances/platform-finances"
import { KpiCard, compact, money, when } from "./project-finances-view"
import { DailyBarChart, ShareBar } from "./finance-charts"

/**
 * Atai Finance — whole-business roll-up view (server-rendered).
 *
 * The portfolio-level twin of the per-project finance view: same KPI cards,
 * same daily chart, same estimate labels — aggregated across ALL of the
 * user's projects, with a per-project table linking into each project's own
 * finance page. Every number is computed server-side in lib/finances/*;
 * the browser never derives a total.
 */

export function PlatformFinancesView({ finances }: { finances: PlatformFinances }) {
  const { totals, window: win } = finances
  const netMinor = totals.earningsMinor !== null ? totals.earningsMinor : null

  const chartPoints = finances.daily.slice(-60).map((d) => [
    { label: "API cost (credits)", value: d.creditsCharged, className: "fill-primary" },
    { label: "Earnings", value: d.earningsMinor / 100, className: "fill-emerald-500" },
  ])

  const topProjectCredits = Math.max(...finances.byProject.map((r) => r.creditsCharged), 1)
  const mixedCurrencies = totals.currencies.length > 1

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-border bg-card p-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Business finances</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Last {win.days} days across all {finances.projectsCount} project{finances.projectsCount === 1 ? "" : "s"} ·
            runtime API costs and attributed payments collected through every project&apos;s API keys. Computed
            {" "}{when(finances.generatedAt)}.
          </p>
        </div>
        {!finances.earningsSweepComplete ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <span>
              Earnings sweep covers your {finances.byProject.length} most recently updated projects
              (page-load bound) — older projects open their own finance page for the full history. Runtime
              cost totals cover all projects.
            </span>
          </p>
        ) : null}
        {finances.earningsStatus === "unavailable" && finances.projectsCount > 0 ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <span>
              <strong className="text-foreground">Earnings feed not configured.</strong>{" "}
              {finances.earningsNote} Runtime costs are complete; earnings appear once the platform payment
              provider is set up.
            </span>
          </p>
        ) : finances.earningsStatus === "error" ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <span>{finances.earningsNote}</span>
          </p>
        ) : null}
        {mixedCurrencies ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Note: attributed payments arrived in multiple currencies ({totals.currencies.join(", ")}). Portfolio
            totals sum nominal amounts across currencies — open a project&apos;s finance page for its details.
          </p>
        ) : null}
      </section>

      {/* KPI row — same four cards as the per-project page, portfolio totals */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Portfolio finance KPIs">
        <KpiCard
          label="Runtime API spend (credits)"
          value={compact(totals.creditsCharged)}
          sub={`${compact(totals.requests)} API call${totals.requests === 1 ? "" : "s"} across ${finances.byProject.length || finances.projectsCount} project${(finances.byProject.length || finances.projectsCount) === 1 ? "" : "s"}`}
          icon={<Wallet aria-hidden />}
        />
        <KpiCard
          label="Provider cost (USD, reported)"
          value={totals.providerCostUsd !== null ? `$${totals.providerCostUsd.toFixed(2)}` : "unavailable"}
          sub={
            totals.providerCostUsd !== null
              ? "What providers charged for these calls"
              : `${compact(totals.providerCostUnavailableCount)} call${totals.providerCostUnavailableCount === 1 ? "" : "s"} did not report a numeric cost`
          }
          icon={<Landmark aria-hidden />}
        />
        <KpiCard
          label="Attributed earnings"
          value={totals.earningsUnavailable ? "unavailable" : money(totals.earningsMinor, totals.currencies[0] ?? null)}
          sub={
            totals.earningsUnavailable
              ? "Payment provider not configured"
              : `${compact(totals.succeededPayments)} succeeded · ${compact(totals.pendingPayments)} pending`
          }
          icon={<TrendingUp aria-hidden />}
        />
        <KpiCard
          label="Net (earnings − credits)"
          value={netMinor === null ? "—" : money(netMinor, totals.currencies[0] ?? null)}
          sub={`Portfolio-wide rollup — per-project breakdown below`}
          icon={<Info aria-hidden />}
        />
      </section>

      {/* Daily chart — same shared SVG chart component as the project page */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Daily flow — API spend vs attributed earnings</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          UTC days · all projects combined · last {Math.min(60, finances.daily.length)} active days of the
          {` ${win.days}-day`} window. Earnings are in payment minor units scaled for display.
        </p>
        {chartPoints.length > 0 ? (
          <div className="mt-4">
            <DailyBarChart points={chartPoints} />
          </div>
        ) : (
          <p className="mt-4 rounded-lg bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
            No runtime activity yet — call the runtime API with any project&apos;s keys and the daily chart
            fills in.
          </p>
        )}
      </section>

      {/* By-project table — the roll-up starts here, each row links deeper */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium">By project</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Every project&apos;s slice of the window. Open a project&apos;s finance page for its capability
          breakdown, payments, and per-project estimates.
        </p>
        {finances.byProject.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-medium">Project</th>
                  <th className="py-2 pr-3 font-medium">Calls</th>
                  <th className="py-2 pr-3 font-medium">Credits</th>
                  <th className="py-2 pr-3 font-medium">Provider cost</th>
                  <th className="py-2 pr-3 font-medium">Earnings</th>
                  <th className="py-2 pr-3 font-medium">Weight</th>
                  <th className="py-2 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {finances.byProject.map((r) => (
                  <tr key={r.projectId}>
                    <td className="py-2 pr-3 max-w-40 truncate font-medium">{r.projectName}</td>
                    <td className="py-2 pr-3">{compact(r.requests)}</td>
                    <td className="py-2 pr-3 font-medium">{compact(r.creditsCharged)}</td>
                    <td className="py-2 pr-3">
                      {r.providerCostUsd !== null ? `$${r.providerCostUsd.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {r.earningsMinor !== null ? money(r.earningsMinor, r.currency) : <span className="text-muted-foreground">unavailable</span>}
                    </td>
                    <td className="py-2 pr-3">
                      <ShareBar fraction={r.creditsCharged / topProjectCredits} />
                    </td>
                    <td className="py-2">
                      <Link
                        href={`/project/${r.projectId}/finances`}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        Open <FolderKanban className="size-3" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 rounded-lg bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
            No projects yet — create one and this table (and every portfolio number above) fills in.
          </p>
        )}
      </section>

      {/* Portfolio outlook + recurring revenue — same estimates as a project page */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium">30-day outlook (estimate)</h2>
          {finances.projection.insufficientData ? (
            <p className="mt-3 rounded-lg bg-muted/20 px-3 py-4 text-xs text-muted-foreground">
              {finances.projection.basis}
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-3 text-xs">
              <div className="flex items-baseline justify-between gap-2 rounded-lg bg-muted/20 px-3 py-2.5">
                <span className="text-muted-foreground">Projected credits (next 30d)</span>
                <span className="text-base font-semibold tracking-tight">
                  {finances.projection.projected30dCredits !== null
                    ? compact(finances.projection.projected30dCredits)
                    : "—"}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2 rounded-lg bg-muted/20 px-3 py-2.5">
                <span className="text-muted-foreground">Projected earnings (next 30d)</span>
                <span className="text-base font-semibold tracking-tight">
                  {finances.projection.projected30dEarningsMinor !== null
                    ? money(finances.projection.projected30dEarningsMinor, totals.currencies[0] ?? null)
                    : "—"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">{finances.projection.basis}</p>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Recurring revenue &amp; valuation (rough estimate)</h2>
          {finances.arr.mrrMinor === null ? (
            <p className="mt-3 rounded-lg bg-muted/20 px-3 py-4 text-xs text-muted-foreground">
              {finances.arr.basis}
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-3 text-xs">
              <RecurringLine label="MRR" value={money(finances.arr.mrrMinor, finances.arr.mrrCurrency)} />
              <RecurringLine label="ARR (MRR × 12)" value={money(finances.arr.arrMinor, finances.arr.mrrCurrency)} />
              <RecurringLine
                label={`Rough valuation (ARR × ${VALUATION_MULTIPLE_LABEL})`}
                value={money(finances.arr.valuationMinor, finances.arr.mrrCurrency)}
              />
              <p className="text-[11px] text-muted-foreground">{finances.arr.basis}</p>
            </div>
          )}
        </div>
      </section>

      {/* Recent payments — across every project, tagged with which one */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Payments collected across your projects</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Attributed by the runtime server-side on every checkout and subscription it created — tagged here
          with the project that earned them. Payouts (account-level settlement) are never attributed.
        </p>
        {finances.recentPayments.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-medium">Payment</th>
                  <th className="py-2 pr-3 font-medium">Project</th>
                  <th className="py-2 pr-3 font-medium">Amount</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {finances.recentPayments.map((p) => (
                  <tr key={p.paymentId}>
                    <td className="py-2 pr-3 font-mono text-[11px]">{p.paymentId}</td>
                    <td className="py-2 pr-3 max-w-32 truncate">{p.projectName}</td>
                    <td className="py-2 pr-3 font-medium">
                      {p.amountMinor !== null ? money(p.amountMinor, p.currency) : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={
                          p.status === "succeeded"
                            ? "font-medium text-emerald-600 dark:text-emerald-400"
                            : p.status === "failed" || p.status === "cancelled"
                              ? "font-medium text-destructive"
                              : "font-medium text-amber-600 dark:text-amber-400"
                        }
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{p.subscriptionId !== null ? "subscription" : "one-time"}</td>
                    <td className="py-2">{when(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 rounded-lg bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
            {finances.earningsStatus === "ok"
              ? "No attributed payments in the window yet — create a checkout (Payments capability) in any project to test the flow end-to-end."
              : "No earnings feed on this deployment yet."}
          </p>
        )}
      </section>
    </div>
  )
}

/** Small helper row for the recurring revenue card. */
function RecurringLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 rounded-lg bg-muted/20 px-3 py-2.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-base font-semibold tracking-tight">{value}</span>
    </div>
  )
}

const VALUATION_MULTIPLE_LABEL = "2.5"
