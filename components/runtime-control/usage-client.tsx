"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { jsonFetcher } from "@/lib/client/api"
import { Button } from "@/components/ui/button"
import { formatCredits, formatUsd, formatWhen, formatPct } from "./format"

interface EventRow {
  id: string
  requestId: string
  environment: string
  capability: string
  operation?: string
  model?: string
  provider?: string
  status: string
  latencyMs?: number
  creditsCharged: number
  cost: { status: "available" | "unavailable"; amount?: number }
  createdAt: number
}

interface BreakdownRow {
  key: string
  requests: number
  succeeded: number
  failed: number
  creditsCharged: number
  avgLatencyMs: number | null
  providerCostUsd: number | null
  providerCostUnavailableCount: number
}

interface PeriodEstimate {
  kind: "estimate"
  projectedRequests: number
  projectedCredits: number
  projectedProviderCostUsd: number | null
  observedRequests: number
  from: number
  to: number
  basis: string
  insufficientData: boolean
}

interface UsagePayload {
  events: EventRow[]
  nextCursor: string | null
  summary: {
    requests: number
    succeeded: number
    failed: number
    creditsCharged: number
    providerCostUsd: number | null
    providerCostUnavailableCount: number
    from: number
    to: number
  }
  byApiKey: BreakdownRow[]
  byCapability: BreakdownRow[]
  byModel: BreakdownRow[]
  byProvider: BreakdownRow[]
  byError: BreakdownRow[]
  estimate: PeriodEstimate
}

const PAGE_SIZE = 25

/** Preset time ranges — all within the server-side 90-day export/list clamp. */
const RANGES = [
  { label: "Last 24 hours", ms: 24 * 60 * 60 * 1000 },
  { label: "Last 7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  { label: "Last 30 days", ms: 30 * 24 * 60 * 60 * 1000 },
  { label: "Last 90 days", ms: 90 * 24 * 60 * 60 * 1000 },
] as const

function breakdownTable(title: string, rows: BreakdownRow[] | undefined, keyHeader: string, modelLinkBase?: string) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      {rows === undefined ? (
        <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No data in this window.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1.5 pr-3 font-medium">{keyHeader}</th>
                <th className="py-1.5 pr-3 text-right font-medium">Requests</th>
                <th className="py-1.5 pr-3 text-right font-medium">Failed</th>
                <th className="py-1.5 pr-3 text-right font-medium">Credits</th>
                <th className="py-1.5 pr-3 text-right font-medium">Avg latency</th>
                <th className="py-1.5 text-right font-medium">Provider cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-border">
                  <td className="py-1.5 pr-3 font-mono">{row.key}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{row.requests.toLocaleString()}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{row.failed.toLocaleString()}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{Math.round(row.creditsCharged).toLocaleString()}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {row.avgLatencyMs === null ? "—" : `${row.avgLatencyMs.toLocaleString()} ms`}
                  </td>
                  <td className="py-1.5 text-right">
                    {row.providerCostUsd === null ? "Unavailable" : formatUsd(row.providerCostUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function RuntimeUsageClient({ projectId }: { projectId: string }) {
  const [rangeIdx, setRangeIdx] = useState(0)
  const [environment, setEnvironment] = useState("")
  const [status, setStatus] = useState("")
  const [capability, setCapability] = useState("")
  const [model, setModel] = useState("")
  const [apiKeyId, setApiKeyId] = useState("")
  const [requestId, setRequestId] = useState("")
  const [cursors, setCursors] = useState<string[]>([])
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(false)

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    p.set("from", String(Date.now() - RANGES[rangeIdx].ms))
    if (environment) p.set("environment", environment)
    if (status) p.set("status", status)
    if (capability) p.set("capability", capability)
    if (model) p.set("model", model)
    if (apiKeyId) p.set("apiKeyId", apiKeyId)
    if (requestId) p.set("requestId", requestId)
    p.set("limit", String(PAGE_SIZE))
    const cursor = cursors[cursors.length - 1]
    if (cursor) p.set("cursor", cursor)
    return p.toString()
  }, [rangeIdx, environment, status, capability, model, apiKeyId, requestId, cursors])

  const { data, error, isLoading } = useSWR<UsagePayload>(
    `/api/projects/${projectId}/runtime/usage?${qs}`,
    jsonFetcher,
    { keepPreviousData: true },
  )

  function resetAnd(fn: () => void) {
    fn()
    setCursors([])
  }

  /** Downloads the bounded CSV export with the currently active filters. */
  async function exportCsv() {
    setExporting(true)
    setExportError(false)
    try {
      const params = new URLSearchParams(qs)
      params.delete("limit")
      params.delete("cursor")
      const res = await fetch(`/api/projects/${projectId}/runtime/usage/export?${params.toString()}`, {
        credentials: "include",
      })
      if (!res.ok) throw new Error(String(res.status))
      const blob = await res.blob()
      const disposition = res.headers.get("content-disposition") ?? ""
      const match = /filename=(\S+)/.exec(disposition)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = match?.[1] ?? "atai-runtime-usage.csv"
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setExportError(true)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Time range"
          className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
          value={rangeIdx}
          onChange={(e) => resetAnd(() => setRangeIdx(Number(e.target.value)))}
        >
          {RANGES.map((r, i) => (
            <option key={r.label} value={i}>{r.label}</option>
          ))}
        </select>
        <select
          aria-label="Environment"
          className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
          value={environment}
          onChange={(e) => resetAnd(() => setEnvironment(e.target.value))}
        >
          <option value="">All environments</option>
          <option value="development">development</option>
          <option value="production">production</option>
        </select>
        <select
          aria-label="Status"
          className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
          value={status}
          onChange={(e) => resetAnd(() => setStatus(e.target.value))}
        >
          <option value="">All statuses</option>
          <option value="succeeded">succeeded</option>
          <option value="failed">failed</option>
        </select>
        <select
          aria-label="API key"
          className="h-8 max-w-48 rounded-lg border border-border bg-background px-2 text-sm"
          value={apiKeyId}
          onChange={(e) => resetAnd(() => setApiKeyId(e.target.value))}
        >
          <option value="">All API keys</option>
          {(data?.byApiKey ?? []).map((row) => (
            <option key={row.key} value={row.key}>{row.key}</option>
          ))}
        </select>
        <Input label="Capability" value={capability} placeholder="ai.text" onApply={(v) => resetAnd(() => setCapability(v))} />
        <Input label="Model" value={model} placeholder="openai/gpt-4o-mini" onApply={(v) => resetAnd(() => setModel(v))} />
        <Input label="Request ID" value={requestId} placeholder="rtreq_…" onApply={(v) => resetAnd(() => setRequestId(v))} />
      </div>

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Requests" value={data.summary.requests.toLocaleString()} />
            <Stat label="Success rate" value={formatPct(data.summary.requests > 0 ? data.summary.succeeded / data.summary.requests : null)} />
            <Stat label="Atai credits charged" value={formatCredits(data.summary.creditsCharged)} />
            <Stat
              label="Provider cost"
              value={data.summary.providerCostUsd === null ? "Unavailable" : formatUsd(data.summary.providerCostUsd)}
            />
          </div>
          {data.summary.providerCostUnavailableCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              {data.summary.providerCostUnavailableCount.toLocaleString()} event
              {data.summary.providerCostUnavailableCount === 1 ? "" : "s"} without a provider-reported cost — shown as Unavailable, never as $0.
            </p>
          ) : null}

          {data.estimate.insufficientData ? (
            <p className="text-xs text-muted-foreground">
              Not enough usage data to estimate this period yet. {data.estimate.basis}.
            </p>
          ) : (
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
              <p className="font-medium">Estimated period usage — clearly an estimate, not an invoice</p>
              <p className="mt-1 text-xs text-muted-foreground">
                ~{data.estimate.projectedRequests.toLocaleString()} requests · ~{formatCredits(data.estimate.projectedCredits)}
                {data.estimate.projectedProviderCostUsd !== null
                  ? ` · ~${formatUsd(data.estimate.projectedProviderCostUsd)} provider cost`
                  : " · provider cost unavailable"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{data.estimate.basis}.</p>
            </div>
          )}
        </>
      ) : null}

      {isLoading && !data ? <p className="text-sm text-muted-foreground">Loading usage…</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">Could not load usage.</p> : null}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Capability</th>
              <th className="px-3 py-2 font-medium">Model</th>
              <th className="px-3 py-2 font-medium">Env</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Latency</th>
              <th className="px-3 py-2 font-medium">Credits</th>
              <th className="px-3 py-2 font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            {(data?.events ?? []).map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-3 py-2 text-xs">
                  <Link className="text-primary hover:underline" href={`/project/${projectId}/runtime/requests/${row.requestId}`}>
                    {formatWhen(row.createdAt)}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{row.capability}{row.operation ? `/${row.operation}` : ""}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.model ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{row.environment}</td>
                <td className="px-3 py-2 text-xs">{row.status}</td>
                <td className="px-3 py-2 text-xs tabular-nums">{row.latencyMs !== undefined ? `${row.latencyMs.toLocaleString()} ms` : "—"}</td>
                <td className="px-3 py-2 text-xs tabular-nums">{row.creditsCharged.toLocaleString()}</td>
                <td className="px-3 py-2 text-xs">
                  {row.cost.status === "available" ? formatUsd(row.cost.amount) : "Unavailable"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.events.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No runtime activity yet. Once your application starts using the Atai Runtime, requests will appear here.
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={cursors.length === 0 || isLoading}
          onClick={() => setCursors((c) => c.slice(0, -1))}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!data?.nextCursor || isLoading}
          onClick={() => {
            const next = data?.nextCursor
            if (next) setCursors((c) => [...c, next])
          }}
        >
          Next
        </Button>
        {cursors.length > 0 ? <span>Page {cursors.length + 1}</span> : null}
        <span className="grow" />
        {exportError ? <span role="alert" className="text-destructive">Export failed. Please try again.</span> : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={exporting}
          onClick={() => void exportCsv()}
        >
          {exporting ? "Exporting…" : "Export CSV"}
        </Button>
        <p className="w-full text-xs text-muted-foreground">
          Exports up to 1,000 newest events for the selected filters; if more matched, the file itself says what was
          omitted. Narrow the time range for a complete export.
        </p>
      </div>

      {breakdownTable("By capability", data?.byCapability, "Capability")}
      {breakdownTable("By model", data?.byModel, "Model")}
      {breakdownTable("By API key", data?.byApiKey, "API key")}
      {breakdownTable("By provider", data?.byProvider, "Provider")}
      {data?.byError && data.byError.length > 0 ? breakdownTable("Errors", data.byError, "Error category") : null}
    </div>
  )
}

/** Apply-on-enter text filter — avoids a request per keystroke. */
function Input({
  label,
  value,
  placeholder,
  onApply,
}: {
  label: string
  value: string
  placeholder: string
  onApply: (value: string) => void
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span>{label}</span>
      <input
        className="h-8 w-40 rounded-lg border border-border bg-background px-2 text-sm text-foreground"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value
          if (v === "") onApply("")
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") onApply((e.target as HTMLInputElement).value.trim())
        }}
        onBlur={(e) => {
          const v = e.target.value.trim()
          if (v !== value) onApply(v)
        }}
      />
    </label>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  )
}
