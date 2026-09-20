"use client"

import useSWR from "swr"
import { useState } from "react"
import {
  Loader2, AlertTriangle, Shield, RefreshCw, Activity, Coins, Server,
  CheckCircle2, XCircle, HelpCircle, Route,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { jsonFetcher } from "@/lib/client/api"
import { AdminNav } from "@/components/admin-nav"

interface UsageRecord {
  id: string
  requestId: string
  userId: string
  userName?: string
  userEmail?: string
  projectId: string
  projectName?: string
  apiKeyId: string
  environment: string
  capability: string
  operation?: string
  provider: string
  model?: string
  status: "succeeded" | "failed"
  latencyMs: number
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }
  creditsCharged: number
  pricingRuleId: string | null
  pricingSource: string | null
  ledgerIdempotencyKey: string | null
  providerCost: number | null
  providerCostCurrency: string | null
  providerCostSource: string
  errorCategory?: string
  createdAt: number
}

interface Financials {
  summary: { requests: number; succeeded: number; failed: number; creditsCharged: number }
  breakdown: {
    byProvider: { _id: string; requests: number; creditsCharged: number; providerCost: number; providerCostKnown: number }[]
    byCapability: { _id: string; requests: number; creditsCharged: number }[]
    byOperation: { _id: { capability: string; operation: string }; requests: number; creditsCharged: number }[]
    daily: { _id: string; requests: number; creditsCharged: number }[]
  }
}

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function statusIcon(status: string, providerCostSource: string) {
  if (status === "failed") return <XCircle className="size-3.5 text-destructive" />
  if (providerCostSource === "unavailable") return <HelpCircle className="size-3.5 text-muted-foreground" />
  return <CheckCircle2 className="size-3.5 text-green-500" />
}

export default function AdminRuntimePage() {
  const [environment, setEnvironment] = useState("")
  const financialsKey = `/api/admin/runtime/financials${environment ? `?environment=${environment}` : ""}`
  const usageKey = `/api/admin/runtime/usage?limit=25${environment ? `&environment=${environment}` : ""}`

  const { data: fin, error: finError, isLoading: finLoading, mutate: mutateFin } = useSWR<Financials>(
    financialsKey, jsonFetcher, { refreshInterval: 30000 },
  )
  const { data: usage, error: usageError, isLoading: usageLoading, mutate: mutateUsage } = useSWR<{ records: UsageRecord[]; total: number }>(
    usageKey, jsonFetcher, { refreshInterval: 30000 },
  )

  const loading = finLoading || usageLoading
  const error = finError || usageError

  if (loading) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <AdminNav />
        <div className="mx-auto max-w-6xl px-6 py-10 text-center">
          <AlertTriangle className="size-10 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-semibold">Access Denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">You don&apos;t have permission to access this page.</p>
        </div>
      </main>
    )
  }

  const summary = fin?.summary ?? { requests: 0, succeeded: 0, failed: 0, creditsCharged: 0 }
  const records = usage?.records ?? []

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AdminNav />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Admin</p>
              <Badge variant="secondary" className="gap-1 text-xs">
                <Shield className="size-3" />
                Runtime
              </Badge>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Runtime Financials</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Runtime API requests, Atai credits charged, and provider cost visibility.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="Filter by environment"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">All environments</option>
              <option value="production">Production</option>
              <option value="development">Development</option>
            </select>
            <Button variant="outline" size="sm" onClick={() => { mutateFin(); mutateUsage() }} className="gap-1.5">
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
          </div>
        </header>

        {/* ── Summary ── */}
        <div className="mt-8 grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="size-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Runtime requests</p>
              </div>
              <p className="text-2xl font-semibold">{summary.requests.toLocaleString()}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {summary.succeeded.toLocaleString()} succeeded · {summary.failed.toLocaleString()} failed
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-1">
                <Coins className="size-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Atai credits charged</p>
              </div>
              <p className="text-2xl font-semibold text-primary">{summary.creditsCharged.toLocaleString()}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Deducted from customer balances</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-1">
                <Server className="size-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Provider cost reported</p>
              </div>
              <p className="text-2xl font-semibold">
                {(() => {
                  const known = fin?.breakdown.byProvider.filter((p) => p.providerCostKnown > 0) ?? []
                  return known.length
                    ? `$${known.reduce((s, p) => s + p.providerCost, 0).toFixed(2)}`
                    : "—"
                })()}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {(() => {
                  const known = fin?.breakdown.byProvider.reduce((s, p) => s + p.providerCostKnown, 0) ?? 0
                  return `${known.toLocaleString()} of ${summary.requests.toLocaleString()} requests`
                })()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-1">
                <HelpCircle className="size-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Cost unavailable</p>
              </div>
              <p className="text-2xl font-semibold text-muted-foreground">
                {(summary.requests - (fin?.breakdown.byProvider.reduce((s, p) => s + p.providerCostKnown, 0) ?? 0)).toLocaleString()}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Requests without provider cost data (not $0)</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Breakdowns ── */}
        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="py-5">
              <p className="font-medium mb-3">By provider</p>
              {fin?.breakdown.byProvider.length ? (
                <div className="space-y-2">
                  {fin.breakdown.byProvider.map((p) => (
                    <div key={p._id} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-xs">{p._id}</span>
                      <span className="text-muted-foreground text-xs">
                        {p.requests.toLocaleString()} req · {p.creditsCharged.toLocaleString()} credits
                        {p.providerCostKnown > 0 && <> · ${p.providerCost.toFixed(2)} cost</>}
                        {p.providerCostKnown === 0 && <> · cost unavailable</>}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No usage yet.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-5">
              <p className="font-medium mb-3">Top capabilities</p>
              {fin?.breakdown.byCapability.length ? (
                <div className="space-y-2">
                  {fin.breakdown.byCapability.map((c) => (
                    <div key={c._id} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-xs">{c._id}</span>
                      <span className="text-muted-foreground text-xs">
                        {c.requests.toLocaleString()} req · {c.creditsCharged.toLocaleString()} credits
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No usage yet.</p>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ── Recent usage ── */}
        <section className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Recent Requests (of {usage?.total.toLocaleString() ?? 0})
            </p>
          </div>
          {records.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Route className="size-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-lg font-medium">No runtime usage yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Runtime requests from generated applications will appear here with their charges.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 text-xs font-mono uppercase text-muted-foreground">When</th>
                        <th className="text-left py-3 text-xs font-mono uppercase text-muted-foreground">Project</th>
                        <th className="text-left py-3 text-xs font-mono uppercase text-muted-foreground">Capability</th>
                        <th className="text-left py-3 text-xs font-mono uppercase text-muted-foreground">Provider / Model</th>
                        <th className="text-left py-3 text-xs font-mono uppercase text-muted-foreground">Status</th>
                        <th className="text-right py-3 text-xs font-mono uppercase text-muted-foreground">Credits</th>
                        <th className="text-right py-3 text-xs font-mono uppercase text-muted-foreground">Provider cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r) => (
                        <tr key={r.id} className="border-b border-border last:border-0">
                          <td className="py-3 text-xs text-muted-foreground" title={new Date(r.createdAt).toLocaleString()}>{timeAgo(r.createdAt)}</td>
                          <td className="py-3">
                            <p className="text-xs font-medium">{r.projectName ?? r.projectId.slice(0, 14)}</p>
                            <p className="text-[10px] text-muted-foreground">{r.environment}</p>
                          </td>
                          <td className="py-3 font-mono text-xs">
                            {r.capability}
                            {r.operation && <span className="text-muted-foreground"> / {r.operation}</span>}
                          </td>
                          <td className="py-3 font-mono text-xs">
                            {r.provider}
                            {r.model && <p className="text-[10px] text-muted-foreground">{r.model}</p>}
                          </td>
                          <td className="py-3">
                            <span className="inline-flex items-center gap-1.5">
                              {statusIcon(r.status, r.providerCostSource)}
                              <span className="text-xs">{r.status === "succeeded" ? "OK" : r.errorCategory ?? "failed"}</span>
                            </span>
                          </td>
                          <td className="py-3 text-right font-mono text-primary">
                            {r.creditsCharged > 0 ? r.creditsCharged.toLocaleString() : <span className="text-muted-foreground">0</span>}
                          </td>
                          <td className="py-3 text-right font-mono text-xs">
                            {r.providerCost !== null ? (
                              <span title={`source: ${r.providerCostSource}`}>
                                {r.providerCostCurrency === "USD" ? "$" : ""}{r.providerCost.toFixed(4)}{r.providerCostCurrency && r.providerCostCurrency !== "USD" ? ` ${r.providerCostCurrency}` : ""}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">unavailable</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        <p className="mt-6 text-[11px] text-muted-foreground">
          Metric definitions: “requests” counts recorded runtime request events (succeeded + failed); “credits charged”
          counts Atai credits actually deducted; “provider cost” counts only provider-reported monetary costs in their
          reported currency — unavailable cost is never counted as $0. Credits and provider cost are separate metrics.
        </p>
      </div>
    </main>
  )
}
