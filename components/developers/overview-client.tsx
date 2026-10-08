"use client"

import Link from "next/link"
import useSWR from "swr"
import { useSearchParams } from "next/navigation"
import { jsonFetcher } from "@/lib/client/api"
import { formatCredits, formatPct, formatWhen } from "@/components/runtime-control/format"

interface Overview {
  keys: { total: number; active: number; byEnvironment: { development: number; production: number } }
  usage24h: {
    requests: number
    succeeded: number
    failed: number
    creditsCharged: number
  }
  credits: { total: number }
  health: { successRate: number | null; lastSuccessAt: number | null; failed: number }
  provisioning: { development: { status: string }; production: { status: string } }
}

export function DevelopersOverviewClient() {
  const params = useSearchParams()
  const projectId = params.get("project")

  const { data, error, isLoading } = useSWR<Overview>(
    projectId ? `/api/projects/${projectId}/runtime/control` : null,
    jsonFetcher,
  )

  if (!projectId) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm font-medium">Select a project to get started</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Pick one of your projects above to see its API keys, runtime usage, health, and the live playground.
        </p>
      </div>
    )
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading overview…</p>
  if (error || !data) {
    return <p role="alert" className="text-sm text-destructive">Could not load the runtime overview for this project.</p>
  }

  const cards = [
    { label: "Active keys", value: String(data.keys.active) },
    { label: "Requests (24h)", value: data.usage24h.requests.toLocaleString() },
    { label: "Success rate (24h)", value: formatPct(data.health.successRate) },
    { label: "Credits used (24h)", value: formatCredits(data.usage24h.creditsCharged) },
    { label: "Credits remaining", value: formatCredits(data.credits.total) },
    { label: "Failed (24h)", value: data.health.failed.toLocaleString() },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Runtime status</h2>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Dev runtime</dt>
            <dd>{data.provisioning.development.status}</dd>
            <dt className="text-muted-foreground">Prod runtime</dt>
            <dd>{data.provisioning.production.status}</dd>
            <dt className="text-muted-foreground">Last success</dt>
            <dd>{formatWhen(data.health.lastSuccessAt)}</dd>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <Link href={`/developers/keys?project=${projectId}`} className="rounded-lg border border-border px-3 py-1.5 hover:border-primary/30">
              Manage API keys →
            </Link>
            <Link href={`/developers/playground?project=${projectId}`} className="rounded-lg border border-border px-3 py-1.5 hover:border-primary/30">
              Open playground →
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Quick start</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            Point the SDK at the runtime with any active key:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-muted/40 p-3 font-mono text-[11px] leading-5">
{`import { Atai } from "@atai-group/sdk"

const atai = new Atai({ apiKey: process.env.ATAI_API_KEY! })
const health = await atai.health.check()`}
          </pre>
          <p className="mt-2 text-xs text-muted-foreground">
            Docs: <Link href="/sdk" className="text-primary hover:underline">SDK &amp; API reference</Link>
          </p>
        </section>
      </div>
    </div>
  )
}
