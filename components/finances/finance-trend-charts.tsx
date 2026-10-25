"use client"

/**
 * Atai Finance — interactive recharts trend components.
 *
 * Values arrive precomputed from lib/finances/* server-side (same honesty
 * rule as the rest of the dashboard: the browser never derives a total —
 * except the cumulative net line, which is a running sum over the same
 * server-provided daily points). Renders nothing until mounted so the
 * server pass stays clean and ResponsiveContainer measures real widths.
 */

import { useEffect, useMemo, useState } from "react"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

export interface MoneyTrendPoint {
  /** UTC date bucket, YYYY-MM-DD. */
  date: string
  /** Runtime credits charged that day (API cost). */
  costCredits: number
  /** Attributed gross earnings that day, major currency units. */
  earnings: number
  /** Provider-reported USD cost that day; null when unreported. */
  providerCostUsd: number | null
}

const COST_COLOR = "var(--primary)"
const EARNINGS_COLOR = "var(--color-emerald-500)"
const NET_COLOR = "var(--color-violet-500)"

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 })
}

function shortDate(date: string): string {
  const [, month, day] = date.split("-")
  return `${month}/${day}`
}

function useMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}

function TrendTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean
  payload?: Array<{ dataKey?: string | number; value?: number | string }>
  label?: string | number
  currency: string | null
}) {
  if (!active || !payload?.length) return null
  const get = (key: string) => payload.find((entry) => entry.dataKey === key)?.value
  const money = (v: number | undefined | null) =>
    v === undefined || v === null ? "—" : `${currency ? `${currency} ` : ""}${fmt(v)}`
  return (
    <div className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <p className="font-medium text-foreground">{label}</p>
      <p className="mt-1 text-muted-foreground">
        Earnings <span className="font-medium text-emerald-600 dark:text-emerald-400">{money(get("earnings") as number)}</span>
      </p>
      <p className="text-muted-foreground">
        API cost <span className="font-medium text-foreground">{fmt((get("costCredits") as number) ?? 0)} credits</span>
        {get("providerCostUsd") != null ? (
          <span className="text-muted-foreground"> · $${fmt(get("providerCostUsd") as number)} provider</span>
        ) : null}
      </p>
      <p className="text-muted-foreground">
        Net (cum.){" "}
        <span className="font-medium text-violet-600 dark:text-violet-400">{money(get("net") as number)}</span>
      </p>
    </div>
  )
}

export function MoneyTrendChart({
  points,
  currency,
  height = 280,
}: {
  points: MoneyTrendPoint[]
  currency: string | null
  height?: number
}) {
  const mounted = useMounted()
  const data = useMemo(() => {
    let running = 0
    return points.map((p) => {
      running += p.earnings - p.costCredits
      return { ...p, label: shortDate(p.date), net: Math.round(running * 100) / 100 }
    })
  }, [points])

  if (!mounted || data.length === 0) return null

  return (
    <div style={{ height }} dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="currentColor" strokeOpacity={0.08} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => fmt(v)}
            width={56}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => fmt(v)}
            width={56}
          />
          <Tooltip content={<TrendTooltip currency={currency} />} />
          <Legend
            verticalAlign="top"
            align="right"
            height={28}
            wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }}
          />
          <Bar
            yAxisId="left"
            dataKey="costCredits"
            name="API cost (credits)"
            fill={COST_COLOR}
            fillOpacity={0.85}
            radius={[2, 2, 0, 0]}
            maxBarSize={14}
            isAnimationActive={false}
          />
          <Bar
            yAxisId="left"
            dataKey="earnings"
            name={currency ? `Earnings (${currency})` : "Earnings"}
            fill={EARNINGS_COLOR}
            fillOpacity={0.9}
            radius={[2, 2, 0, 0]}
            maxBarSize={14}
            isAnimationActive={false}
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="net"
            name="Net (cumulative)"
            stroke={NET_COLOR}
            strokeWidth={2}
            fill={NET_COLOR}
            fillOpacity={0.07}
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export interface BreakdownRow {
  key: string
  value: number
}

export function BreakdownBarsChart({ rows, height }: { rows: BreakdownRow[]; height?: number }) {
  const mounted = useMounted()
  const h = height ?? Math.max(rows.length * 34, 80)
  if (!mounted || rows.length === 0) return null
  return (
    <div style={{ height: h }} dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 4 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="key"
            orientation="left"
            width={150}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--accent)", fillOpacity: 0.35 }}
            formatter={(value: unknown) => [fmt(Number(value ?? 0)), "Credits"]}
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--foreground)" }}
          />
          <Bar dataKey="value" name="Credits" fill={COST_COLOR} fillOpacity={0.8} radius={[0, 3, 3, 0]} maxBarSize={16} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
