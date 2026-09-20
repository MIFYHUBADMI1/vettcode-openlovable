"use client"

import Link from "next/link"
import useSWR from "swr"
import { jsonFetcher } from "@/lib/client/api"
import { formatCredits, formatPct, formatUsd, formatWhen } from "./format"

interface Overview {
  keys: { total: number; active: number; byEnvironment: { development: number; production: number } }
  usage24h: {
    requests: number
    succeeded: number
    failed: number
    creditsCharged: number
    providerCostUsd: number | null
    providerCostUnavailableCount: number
  }
  credits: { total: number }
  health: { successRate: number | null; lastSuccessAt: number | null; failed: number }
  config: { defaultModel?: string; allowEndUserModelSelection: boolean }
  provisioning: {
    development: { status: string }
    production: { status: string }
  }
  platform: { defaultModel: string | null; sdkVersion: string }
}

/** Derive an honest status line from data the backend can actually determine. */
function runtimeStatus(data: Overview): { label: string; tone: "ok" | "warn" | "muted" } {
  const devOrProdReady = data.provisioning.development.status === "READY" || data.provisioning.production.status === "READY"
  if (!devOrProdReady && data.keys.active === 0) {
    return { label: "No runtime activity", tone: "muted" }
  }
  if (data.health.successRate !== null && data.health.successRate < 0.9 && data.health.failed > 0) {
    return { label: "Degraded — recent request failures", tone: "warn" }
  }
  if (data.usage24h.requests > 0 && data.health.successRate === 1) {
    return { label: "Operational", tone: "ok" }
  }
  if (data.usage24h.requests > 0) {
    return { label: "Operational (some recent failures)", tone: "warn" }
  }
  return { label: "Idle — no requests in the last 24h", tone: "muted" }
}

export function RuntimeOverviewClient({ projectId }: { projectId: string }) {
  const { data, error, isLoading } = useSWR<Overview>(
    `/api/projects/${projectId}/runtime/control`,
    jsonFetcher,
  )

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading runtime…</p>
  if (error || !data) {
    return <p role="alert" className="text-sm text-destructive">Could not load runtime overview.</p>
  }

  const cards = [
    { label: "Active keys", value: String(data.keys.active), href: `/project/${projectId}/runtime/keys` },
    { label: "Requests (24h)", value: String(data.usage24h.requests), href: `/project/${projectId}/runtime/requests` },
    { label: "Credits used (24h)", value: formatCredits(data.usage24h.creditsCharged), href: `/project/${projectId}/runtime/usage` },
    { label: "Credits remaining", value: formatCredits(data.credits.total), href: "/settings/billing" },
  ]
  const status = runtimeStatus(data)
  const statusColor =
    status.tone === "ok"
      ? "text-success"
      : status.tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground"

  return (
    <div className="flex flex-col gap-6">
      <p className={`text-sm font-medium ${statusColor}`}>
        <span aria-hidden>●</span> {status.label}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/30"
          >
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{c.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Health (24h)</h2>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Success rate</dt>
            <dd>{formatPct(data.health.successRate)}</dd>
            <dt className="text-muted-foreground">Failed</dt>
            <dd>{data.health.failed}</dd>
            <dt className="text-muted-foreground">Last success</dt>
            <dd>{formatWhen(data.health.lastSuccessAt)}</dd>
            <dt className="text-muted-foreground">Provider cost</dt>
            <dd>
              {data.usage24h.providerCostUsd === null
                ? "Unavailable"
                : formatUsd(data.usage24h.providerCostUsd)}
              {data.usage24h.providerCostUnavailableCount > 0 ? (
                <span className="block text-xs text-muted-foreground">
                  {data.usage24h.providerCostUnavailableCount} request{data.usage24h.providerCostUnavailableCount === 1 ? "" : "s"} without a provider cost
                </span>
              ) : null}
            </dd>
          </dl>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Configuration</h2>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Default model</dt>
            <dd className="font-mono text-xs">
              {data.config.defaultModel || data.platform.defaultModel || "Platform default"}
            </dd>
            <dt className="text-muted-foreground">App may pick model</dt>
            <dd>{data.config.allowEndUserModelSelection ? "Yes" : "No"}</dd>
            <dt className="text-muted-foreground">Dev runtime</dt>
            <dd>{data.provisioning.development.status}</dd>
            <dt className="text-muted-foreground">Prod runtime</dt>
            <dd>{data.provisioning.production.status}</dd>
            <dt className="text-muted-foreground">SDK</dt>
            <dd>@atai/sdk {data.platform.sdkVersion}</dd>
          </dl>
        </section>
      </div>
    </div>
  )
}
