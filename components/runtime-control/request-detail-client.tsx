"use client"

import useSWR from "swr"
import { jsonFetcher } from "@/lib/client/api"
import { formatCredits, formatUsd, formatWhen } from "./format"

interface EventRow {
  id: string
  requestId: string
  apiKeyId: string
  environment: string
  capability: string
  operation?: string
  provider: string
  model?: string
  status: string
  latencyMs: number
  creditsCharged: number
  errorCategory?: string
  createdAt: number
  usage?: Record<string, number>
  cost: { status: "available" | "unavailable"; amount?: number; currency?: string }
}

export function RuntimeRequestDetailClient({
  projectId,
  requestId,
}: {
  projectId: string
  requestId: string
}) {
  const { data, error, isLoading } = useSWR<{ requestId: string; events: EventRow[] }>(
    `/api/projects/${projectId}/runtime/requests/${encodeURIComponent(requestId)}`,
    jsonFetcher,
  )

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading request…</p>
  if (error || !data) return <p role="alert" className="text-sm text-destructive">Request not found.</p>

  return (
    <div className="flex flex-col gap-4">
      <p className="font-mono text-xs text-muted-foreground">{data.requestId}</p>
      {data.events.map((e) => (
        <section key={e.id} className="rounded-xl border border-border bg-card p-4 text-sm">
          <dl className="grid grid-cols-2 gap-2">
            <dt className="text-muted-foreground">When</dt>
            <dd>{formatWhen(e.createdAt)}</dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd>{e.status}</dd>
            <dt className="text-muted-foreground">Environment</dt>
            <dd>{e.environment}</dd>
            <dt className="text-muted-foreground">Capability</dt>
            <dd className="font-mono text-xs">{e.capability}{e.operation ? ` / ${e.operation}` : ""}</dd>
            <dt className="text-muted-foreground">Provider</dt>
            <dd>{e.provider}</dd>
            <dt className="text-muted-foreground">Model</dt>
            <dd className="font-mono text-xs">{e.model ?? "—"}</dd>
            <dt className="text-muted-foreground">Latency</dt>
            <dd>{e.latencyMs} ms</dd>
            <dt className="text-muted-foreground">Credits</dt>
            <dd>{formatCredits(e.creditsCharged)}</dd>
            <dt className="text-muted-foreground">Provider cost</dt>
            <dd>{e.cost.status === "available" ? formatUsd(e.cost.amount) : "Unavailable"}</dd>
            <dt className="text-muted-foreground">API key</dt>
            <dd className="font-mono text-xs">{e.apiKeyId}</dd>
            {e.errorCategory ? (
              <>
                <dt className="text-muted-foreground">Error</dt>
                <dd>{e.errorCategory}</dd>
              </>
            ) : null}
          </dl>
        </section>
      ))}
    </div>
  )
}
