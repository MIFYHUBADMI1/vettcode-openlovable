"use client"

import { useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import {
  AlertTriangle, ArrowLeft, ArrowRight, ExternalLink, RefreshCw, Scale, Shield,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { AdminNav } from "@/components/admin-nav"
import { jsonFetcher } from "@/lib/client/api"
import { cn } from "@/lib/utils"
import type { ReconciliationIssue } from "@/lib/billing/billing-types"

/**
 * Atai Finance — Phase 3 reconciliation surface (Workstream E/G).
 *
 * This page renders the page object produced by `lib/finances/reconciliation`.
 * It is a DIAGNOSTIC view: nothing here can repair a record, and the copy says
 * so, because the brief requires corrections to go through the explicit,
 * validated, idempotent recovery path (`/api/admin/billing/webhooks`) or the
 * admin credit adjustment — never a bulk rewrite from a report.
 */

type Severity = "critical" | "warning" | "info"

type Page = {
  checkedAt: number
  window: { size: number; offset: number; nextCursor: string | null; more: boolean }
  scanned: {
    payments: number
    ledgerEntries: number
    subscriptions: number
    webhookEvents: number
    users: number
  }
  summary: {
    total: number
    critical: number
    warning: number
    info: number
    byType: Record<string, number>
    retryable: number
    requiresManualReview: number
    deferredRecent: number
  }
  truncated: boolean
  readOnly: true
  note: string
  findings: ReconciliationIssue[]
}

const SEVERITY_CLASS: Record<Severity, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/30",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  info: "bg-muted text-muted-foreground border-border",
}

const RESOLUTION_LABEL: Record<string, string> = {
  open: "Open — recoverable",
  under_review: "Under review",
  resolved: "Resolved",
  needs_business_decision: "Needs a business decision",
}

function timeAgo(ts: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - ts) / 60_000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function buildKey(params: { limit: number; cursor: string | null; severity: string; userId: string }): string {
  const q = new URLSearchParams()
  q.set("limit", String(params.limit))
  if (params.cursor) q.set("cursor", params.cursor)
  if (params.severity !== "all") q.set("severity", params.severity)
  const userId = params.userId.trim()
  if (userId) q.set("userId", userId)
  return `/api/admin/billing/reconciliation?${q.toString()}`
}

export default function AdminReconciliationPage() {
  const [limit, setLimit] = useState(250)
  const [severity, setSeverity] = useState<string>("all")
  const [userIdDraft, setUserIdDraft] = useState("")
  const [userId, setUserId] = useState("")
  // Cursor history for one query: keys[0] is the first page, each later entry
  // is built from the previous page's `nextCursor`.
  const [keys, setKeys] = useState<string[]>([])
  const [pageIndex, setPageIndex] = useState(0)

  const signature = buildKey({ limit, cursor: null, severity, userId })
  // Filter change ⇒ the whole walk is stale. Adjust during render (React's
  // documented derived-state pattern) so no mismatched page is ever shown.
  const [prevSignature, setPrevSignature] = useState(signature)
  if (prevSignature !== signature) {
    setPrevSignature(signature)
    setKeys([signature])
    setPageIndex(0)
  }
  const activeKeys = keys.length > 0 ? keys : [signature]
  const activeKey = activeKeys[Math.min(pageIndex, activeKeys.length - 1)]
  const { data, error, isLoading, mutate } = useSWR<Page>(activeKey, jsonFetcher)

  const findings = data?.findings ?? []
  const oldestFinding = findings.reduce<number>((acc, f) => Math.min(acc, f.detectedAt), Number.POSITIVE_INFINITY)
  const nextCursor = data?.window.nextCursor ?? null

  const applyUserFilter = () => setUserId(userIdDraft.trim())

  const goNext = () => {
    if (!nextCursor) return
    const next = buildKey({ limit, cursor: nextCursor, severity, userId })
    setKeys([...activeKeys, next])
    setPageIndex(activeKeys.length)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AdminNav />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Admin</p>
              <Badge variant="secondary" className="gap-1 text-xs">
                <Shield className="size-3" />
                Money
              </Badge>
              <Badge variant="outline" className="gap-1 text-xs">
                <Scale className="size-3" />
                read-only
              </Badge>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Financial reconciliation</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Compares Dodo events against payment records, credit grants, reversals, subscriptions and
              account balances. This is a check, not a write — findings are never repaired here.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void mutate()} className="gap-1.5 self-start">
            <RefreshCw className="size-3.5" />
            Re-check
          </Button>
        </header>

        {/* ── Controls ── */}
        <div className="mt-6 flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted-foreground">
            Records per source
            <select
              className="mt-1 block h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              value={String(limit)}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              {[50, 100, 250, 500, 1000].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Minimum severity
            <select
              className="mt-1 block h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              <option value="all">All</option>
              <option value="critical">Critical only</option>
              <option value="warning">Warning and above</option>
            </select>
          </label>
          <div className="text-xs text-muted-foreground">
            Account ID
            <div className="mt-1 flex gap-2">
              <Input
                value={userIdDraft}
                onChange={(e) => setUserIdDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyUserFilter()}
                placeholder="optional"
                className="h-9 w-48 font-mono text-xs"
              />
              <Button variant="outline" size="sm" onClick={applyUserFilter}>
                Filter
              </Button>
              {userId ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setUserIdDraft("")
                    setUserId("")
                  }}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {isLoading ? <p className="mt-8 text-sm text-muted-foreground">Checking records…</p> : null}
        {error ? (
          <Card className="mt-8 border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="size-5 text-destructive" />
              <div>
                <p className="text-sm font-medium">Reconciliation could not run.</p>
                <p className="text-xs text-muted-foreground">
                  Check that the admin session is still valid, then re-check. No records were touched.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {data ? (
          <>
            {/* ── Headline counts ── */}
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs text-muted-foreground">Discrepancies</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{data.summary.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs text-muted-foreground">Critical</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-destructive">{data.summary.critical}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs text-muted-foreground">Retryable by recovery</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-amber-500">{data.summary.retryable}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-4">
                  <p className="text-xs text-muted-foreground">Needs a human decision</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{data.summary.requiresManualReview}</p>
                </CardContent>
              </Card>
            </div>

            {/* ── Scan coverage: "no findings" is not "the books are clean" ── */}
            <Card className="mt-4">
              <CardContent className="py-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                  <span>
                    Checked {new Date(data.checkedAt).toLocaleString()}
                    {Number.isFinite(oldestFinding) ? ` · oldest finding ${timeAgo(oldestFinding, data.checkedAt)} ago` : ""}
                  </span>
                  <span className="tabular-nums">Payment rows read: {data.scanned.payments}</span>
                  <span className="tabular-nums">Ledger entries read: {data.scanned.ledgerEntries}</span>
                  <span className="tabular-nums">Subscriptions read: {data.scanned.subscriptions}</span>
                  <span className="tabular-nums">Webhook events read: {data.scanned.webhookEvents}</span>
                  <span className="tabular-nums">Accounts read: {data.scanned.users}</span>
                  <span className="tabular-nums">Page offset: {data.window.offset}</span>
                  {data.summary.deferredRecent > 0 ? (
                    <span className="tabular-nums">
                      Recently-created records deferred: {data.summary.deferredRecent}
                    </span>
                  ) : null}
                </div>
                {data.window.more || data.truncated ? (
                  <p className="mt-3 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="size-3.5" />
                    This scan was bounded
                    {data.window.more ? " — more records exist beyond this window" : ""}
                    {data.truncated ? " — the findings list was capped" : ""}. Absence of findings here is not a
                    claim that the books are clean.
                  </p>
                ) : null}
                <p className="mt-3 text-xs text-muted-foreground">{data.note}</p>
              </CardContent>
            </Card>

            {/* ── Counts by discrepancy type ── */}
            {Object.keys(data.summary.byType).length > 0 ? (
              <div className="mt-6">
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  Discrepancies by type
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(data.summary.byType)
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, count]) => (
                      <Badge key={type} variant="outline" className="gap-1.5 font-mono text-[11px]">
                        {type}
                        <span className="tabular-nums text-foreground">{count}</span>
                      </Badge>
                    ))}
                </div>
              </div>
            ) : null}

            {/* ── Findings ── */}
            <div className="mt-6">
              {findings.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center">
                    <Scale className="mx-auto mb-3 size-8 text-muted-foreground" />
                    <p className="text-lg font-medium">No mismatches in the records read</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {data.window.more
                        ? "More records exist beyond this window — load the next page before treating this as clean."
                        : "Every relationship this service can evaluate agreed within the bounded scan."}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <ul className="space-y-2">
                  {findings.map((f) => (
                    <li key={f.id} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                            SEVERITY_CLASS[f.severity],
                          )}
                        >
                          {f.severity}
                        </span>
                        <span className="font-mono text-sm font-medium">{f.type}</span>
                        {f.resolution ? (
                          <Badge variant="outline" className="text-[10px]">
                            {RESOLUTION_LABEL[f.resolution] ?? f.resolution}
                          </Badge>
                        ) : null}
                        <span className="ml-auto text-[11px] text-muted-foreground">
                          detected {timeAgo(f.detectedAt, data.checkedAt)} ago
                        </span>
                      </div>

                      <p className="mt-2 text-sm">{f.description}</p>

                      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                        {f.expected ? (
                          <p className="rounded-md border border-border bg-muted/30 px-3 py-2">
                            <span className="text-muted-foreground">Expected: </span>
                            <span className="break-words">{f.expected}</span>
                          </p>
                        ) : null}
                        {f.observed ? (
                          <p className="rounded-md border border-border bg-muted/30 px-3 py-2">
                            <span className="text-muted-foreground">Observed: </span>
                            <span className="break-words">{f.observed}</span>
                          </p>
                        ) : null}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        {f.referenceId ? (
                          <span className="font-mono">ref {f.referenceId}</span>
                        ) : null}
                        {f.relatedIds && f.relatedIds.length > 0 ? (
                          <span className="font-mono">related {f.relatedIds.slice(0, 4).join(", ")}</span>
                        ) : null}
                        {f.userId ? (
                          <Link href={`/admin/users`} className="inline-flex items-center gap-1 text-primary hover:underline">
                            account {f.userId}
                            <ExternalLink className="size-3" />
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* ── Pagination + where to go to act ── */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={pageIndex === 0}
                  onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
                >
                  <ArrowLeft className="size-3.5" />
                  Previous page
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={!nextCursor}
                  onClick={goNext}
                >
                  Next page
                  <ArrowRight className="size-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground">page {pageIndex + 1}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <Link href="/admin/billing/webhooks" className="text-primary hover:underline">
                  Webhook recovery queue
                </Link>
                <Link href="/admin/ledger" className="text-primary hover:underline">
                  Credit ledger
                </Link>
                <Link href="/admin/billing" className="text-primary hover:underline">
                  Billing overview
                </Link>
              </div>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              To act on a finding: a webhook-shaped problem is re-run by the bounded recovery batch (same idempotent
              logic as the live webhook, so replays cannot double-apply); a balance fix goes through the admin credit
              adjustment. Neither path bulk-rewrites historical records.
            </p>
          </>
        ) : null}
      </div>
    </main>
  )
}
