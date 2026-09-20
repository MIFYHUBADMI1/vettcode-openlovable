"use client"

import { useState } from "react"
import useSWR from "swr"
import { jsonFetcher, postJson } from "@/lib/client/api"
import { Button } from "@/components/ui/button"
import { formatPct, formatWhen } from "./format"

interface Overview {
  health: {
    requests: number
    succeeded: number
    failed: number
    successRate: number | null
    lastSuccessAt: number | null
    lastFailureAt: number | null
    recentErrors: Array<{
      requestId: string
      createdAt: number
      capability: string
      errorCategory?: string
    }>
  }
  provisioning: {
    development: { status: string; error?: string }
    production: { status: string; error?: string }
  }
  platform: { sdkVersion: string; maxInFlightPerProcess: number }
}

export function RuntimeHealthClient({ projectId }: { projectId: string }) {
  const { data, error, isLoading, mutate } = useSWR<Overview>(
    `/api/projects/${projectId}/runtime/control`,
    jsonFetcher,
  )
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function retryProvision(environment?: "development" | "production") {
    setBusy(true)
    setMsg(null)
    try {
      await postJson(`/api/projects/${projectId}/runtime`, environment ? { environment } : {})
      await mutate()
      setMsg("Provisioning retry started.")
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Retry failed")
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading health…</p>
  if (error || !data) return <p role="alert" className="text-sm text-destructive">Could not load health.</p>

  const h = data.health

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <Tile label="Success rate (24h)" value={formatPct(h.successRate)} />
        <Tile label="Last success" value={formatWhen(h.lastSuccessAt)} />
        <Tile label="Last failure" value={formatWhen(h.lastFailureAt)} />
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Runtime install</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          SDK @atai/sdk {data.platform.sdkVersion}. Provider internals are not exposed here.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">Development</dt>
          <dd>{data.provisioning.development.status}{data.provisioning.development.error ? ` — ${data.provisioning.development.error}` : ""}</dd>
          <dt className="text-muted-foreground">Production</dt>
          <dd>{data.provisioning.production.status}{data.provisioning.production.error ? ` — ${data.provisioning.production.error}` : ""}</dd>
        </dl>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => retryProvision("development")}>
            Retry development
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => retryProvision("production")}>
            Retry production
          </Button>
        </div>
        {msg ? <p className="mt-2 text-xs text-muted-foreground">{msg}</p> : null}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium">Recent errors (24h)</h2>
        {h.recentErrors.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No failed requests in the last 24 hours.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border text-sm">
            {h.recentErrors.map((e) => (
              <li key={`${e.requestId}-${e.createdAt}`} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="font-mono text-xs">{e.capability}</span>
                <span className="text-xs text-muted-foreground">{e.errorCategory ?? "error"} · {formatWhen(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  )
}
