import {
  CircleAlert,
  Info,
  Landmark,
  TrendingUp,
  Wallet,
} from "lucide-react"
import type { ReactNode } from "react"
import type { ProjectFinances } from "@/lib/finances/project-finances"
import { DailyBarChart, ShareBar } from "./finance-charts"

/**
 * Atai Finance — project-scoped finance dashboard (server-rendered).
 *
 * Every number is computed server-side in lib/finances/* and rendered here —
 * the browser never derives a total. Estimates are labeled, unavailable data
 * shows setup states, and zero data shows zeros — nothing is fabricated.
 */

/** Minor units → major-unit money string (Dodo reports minor units). */
export function money(minor: number | null, currency: string | null): string {
  if (minor === null) return "—"
  const major = minor / 100
  const formatted = major.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return currency ? `${currency} ${formatted}` : formatted
}

export function compact(n: number): string {
  return n.toLocaleString("en-US")
}

function shortDate(date: string): string {
  const [, month, day] = date.split("-")
  return `${month}/${day}`
}

export function when(ms: number | null): string {
  if (ms === null) return "—"
  return new Date(ms).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
}

export function KpiCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string
  value: string
  sub: string
  icon: ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}

export function ProjectFinancesView({ finances }: { finances: ProjectFinances }) {
  const { totals, window: win } = finances

  // Net position: attributed earnings minus in-window credit spend — an API
  // position, never double-counting non-API costs the platform bears.
  const netMinor =
    totals.earningsMinor !== null ? totals.earningsMinor : null
  const projection = finances.projection
  const arr = finances.arr

  const chartPoints = finances.daily.slice(-60).map((d) => [
    { label: "API cost (credits)", value: d.creditsCharged, className: "fill-primary" },
    { label: "Earnings", value: d.earningsMinor / 100, className: "fill-emerald-500" },
  ])

  const topCapabilityCredits = Math.max(
    ...finances.byCapability.map((r) => r.creditsCharged),
    1,
  )

  const conversion =
    totals.checkoutAttempts > 0 && totals.succeededPayments > 0
      ? totals.succeededPayments / totals.checkoutAttempts
      : null

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-border bg-card p-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Business finances</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Last {win.days} days · runtime API costs, attributed payments collected through your
            API keys, and trend estimates. Computed {when(finances.generatedAt)}.
          </p>
        </div>
        {finances.earningsStatus === "unavailable" ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <span>
              <strong className="text-foreground">Earnings feed not configured.</strong>{" "}
              {finances.earningsNote} Runtime costs are complete; earnings on this page appear once
              the platform payment provider is set up.
            </span>
          </p>
        ) : finances.earningsStatus === "error" ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <span>{finances.earningsNote}</span>
          </p>
        ) : null}
        {totals.currencies.length > 1 ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Note: attributed payments arrived in multiple currencies ({totals.currencies.join(", ")}).
            Totals sum nominal amounts across currencies — check the payments table for details.
          </p>
        ) : null}
      </section>

      {/* KPI row */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Finance KPIs">
        <KpiCard
          label="Runtime API spend (credits)"
          value={compact(totals.creditsCharged)}
          sub={`${compact(totals.requests)} API call${totals.requests === 1 ? "" : "s"} in the window`}
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
          sub={
            conversion !== null
              ? `${Math.round(conversion * 100)}% checkout conversion (${totals.checkoutAttempts} attempts)`
              : `${totals.checkoutAttempts} checkout attempt${totals.checkoutAttempts === 1 ? "" : "s"} · no completed payments yet`
          }
          icon={<Info aria-hidden />}
        />
      </section>

      {/* Daily chart */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Daily flow — API spend vs attributed earnings</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          UTC days · last {Math.min(60, finances.daily.length)} active days of the {win.days}-day
          window. Earnings are in the payment currency&apos;s minor units scaled for display.
        </p>
        {chartPoints.length > 0 ? (
          <div className="mt-4">
            <DailyBarChart points={chartPoints} />
          </div>
        ) : (
          <p className="mt-4 rounded-lg bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
            No runtime activity yet — call the runtime API with one of this project&apos;s keys and
            the daily chart fills in.
          </p>
        )}
      </section>

      {/* Capability breakdown */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Where the credits go</h2>
        <p className="mt-1 text-xs text-muted-foreground">Runtime capability spend in the window.</p>
        {finances.byCapability.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-medium">Capability</th>
                  <th className="py-2 pr-3 font-medium">Calls</th>
                  <th className="py-2 pr-3 font-medium">Credits</th>
                  <th className="py-2 pr-3 font-medium">Provider cost</th>
                  <th className="py-2 font-medium">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {finances.byCapability.map((r) => (
                  <tr key={r.key}>
                    <td className="py-2 pr-3 font-mono text-[11px]">{r.key}</td>
                    <td className="py-2 pr-3">{compact(r.requests)}</td>
                    <td className="py-2 pr-3 font-medium">{compact(r.creditsCharged)}</td>
                    <td className="py-2 pr-3">
                      {r.providerCostUsd !== null ? `$${r.providerCostUsd.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-2">
                      <ShareBar fraction={r.creditsCharged / topCapabilityCredits} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 rounded-lg bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
            No billed capability calls in this window yet.
          </p>
        )}
      </section>

      {/* Trends, projections, & valuation estimates */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium">30-day outlook (estimate)</h2>
          {projection.insufficientData ? (
            <p className="mt-3 rounded-lg bg-muted/20 px-3 py-4 text-xs text-muted-foreground">
              {projection.basis}
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-3 text-xs">
              <div className="flex items-baseline justify-between gap-2 rounded-lg bg-muted/20 px-3 py-2.5">
                <span className="text-muted-foreground">Projected credits (next 30d)</span>
                <span className="text-base font-semibold tracking-tight">
                  {projection.projected30dCredits !== null ? compact(projection.projected30dCredits) : "—"}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2 rounded-lg bg-muted/20 px-3 py-2.5">
                <span className="text-muted-foreground">Projected earnings (next 30d)</span>
                <span className="text-base font-semibold tracking-tight">
                  {projection.projected30dEarningsMinor !== null
                    ? money(projection.projected30dEarningsMinor, totals.currencies[0] ?? null)
                    : "—"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">{projection.basis}</p>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Recurring revenue & valuation (rough estimate)</h2>
          {arr.mrrMinor === null ? (
            <p className="mt-3 rounded-lg bg-muted/20 px-3 py-4 text-xs text-muted-foreground">
              {arr.basis}
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-3 text-xs">
              <div className="flex items-baseline justify-between gap-2 rounded-lg bg-muted/20 px-3 py-2.5">
                <span className="text-muted-foreground">
                  MRR
                  {arr.mrrCurrency ? ` (${arr.mrrCurrency})` : ""}
                </span>
                <span className="text-base font-semibold tracking-tight">
                  {money(arr.mrrMinor, arr.mrrCurrency)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2 rounded-lg bg-muted/20 px-3 py-2.5">
                <span className="text-muted-foreground">ARR (MRR × 12)</span>
                <span className="text-base font-semibold tracking-tight">
                  {money(arr.arrMinor, arr.mrrCurrency)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2 rounded-lg bg-muted/20 px-3 py-2.5">
                <span className="text-muted-foreground">Rough valuation (ARR × {VALUATION_MULTIPLE_LABEL})</span>
                <span className="text-base font-semibold tracking-tight">{money(arr.valuationMinor, arr.mrrCurrency)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">{arr.basis}</p>
            </div>
          )}
        </div>
      </section>

      {/* Recent attributed payments */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Payments collected through the runtime</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Attributed to this project — the runtime stamps the project id server-side on every
          checkout and subscription it creates. Payouts (account-level settlement) are never
          attributed here.
        </p>
        {finances.recentPayments.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-medium">Payment</th>
                  <th className="py-2 pr-3 font-medium">Amount</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Customer</th>
                  <th className="py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {finances.recentPayments.map((p) => (
                  <tr key={p.paymentId}>
                    <td className="py-2 pr-3 font-mono text-[11px]">{p.paymentId}</td>
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
                    <td className="py-2 pr-3 max-w-48 truncate">{p.customerEmail ?? "—"}</td>
                    <td className="py-2">{when(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 rounded-lg bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
            {finances.earningsStatus === "ok"
              ? "No attributed payments in the window yet — create a checkout or connection in the playground (Payments capability) to test the flow end-to-end."
              : "No earnings feed on this deployment yet."}
          </p>
        )}
      </section>
    </div>
  )
}

const VALUATION_MULTIPLE_LABEL = "2.5"
