"use client"

import { useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import {
  Loader2, AlertTriangle, Shield, RefreshCw, Webhook, CheckCircle2,
  XCircle, Clock, AlertCircle, Search, Download, ExternalLink,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { jsonFetcher, postJson } from "@/lib/client/api"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { AdminNav } from "@/components/admin-nav"

interface WebhookEvent {
  id: string
  provider: string
  eventType: string
  eventId: string
  status: string
  payloadHash: string
  receivedAt: number
  processedAt?: number
  error?: string
  metadata?: Record<string, unknown>
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  processed: { label: "Processed", color: "text-green-500 border-green-500/30", icon: CheckCircle2 },
  pending: { label: "Pending", color: "text-amber-500 border-amber-500/30", icon: Clock },
  failed: { label: "Failed", color: "text-red-500 border-red-500/30", icon: XCircle },
  duplicate: { label: "Duplicate", color: "text-muted-foreground border-border", icon: AlertCircle },
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/** Queue health as reported by `getRecoveryQueueStats` (lib/billing/webhook-recovery). */
interface RecoveryStats {
  counts: {
    failed: number
    unresolved: number
    processing: number
    manual_review: number
    stale_received: number
  }
  eligibleNow: number
  oldestEligibleReceivedAt: number | null
  nextScheduledAttemptAt: number | null
}

interface RecoveryEventResult {
  eventId: string
  eventType: string
  attempts: number
  outcome: "processed" | "unresolved" | "failed" | "manual_review"
  reason?: string
}

interface RecoveryBatchResult {
  startedAt: number
  processed: number
  resolved: number
  stillPending: number
  escalatedToManualReview: number
  claimedButSkipped: number
  results: RecoveryEventResult[]
  hasMore: boolean
}

export default function AdminWebhooksPage() {
  const [search, setSearch] = useState("")
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null)
  const [batchLimit, setBatchLimit] = useState(10)
  const [confirmRecovery, setConfirmRecovery] = useState(false)
  const [recoveryRunning, setRecoveryRunning] = useState(false)
  const [recoveryResult, setRecoveryResult] = useState<RecoveryBatchResult | null>(null)
  const [recoveryError, setRecoveryError] = useState<string | null>(null)

  const { data, error, isLoading, mutate } = useSWR<{ events: WebhookEvent[]; total: number }>(
    "/api/admin/billing/audit-log?type=webhook",
    jsonFetcher,
    { refreshInterval: 15000 },
  )

  // Recovery queue posture (Workstream B/G) — read-only counts from the same
  // staleness rules the worker uses. Nothing here fires on a timer: this repo
  // has no job substrate, so a batch runs only when an operator triggers it.
  const { data: queue, mutate: mutateQueue } = useSWR<{ stats: RecoveryStats }>(
    "/api/admin/billing/webhooks",
    jsonFetcher,
  )

  const runRecoveryBatch = async () => {
    setRecoveryRunning(true)
    setRecoveryError(null)
    try {
      const res = await postJson<{ result: RecoveryBatchResult }>("/api/admin/billing/webhooks", { limit: batchLimit })
      setRecoveryResult(res.result)
      toast.success(
        res.result.resolved > 0
          ? `Recovery batch resolved ${res.result.resolved} event(s).`
          : "Recovery batch ran — no event reached processed.",
      )
      void mutate()
      void mutateQueue()
    } catch (e) {
      setRecoveryError(e instanceof Error ? e.message : "Recovery batch failed.")
      toast.error("Recovery batch failed.")
    } finally {
      setRecoveryRunning(false)
      setConfirmRecovery(false)
    }
  }


  if (isLoading) {
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

  const events = data?.events ?? []
  const filtered = events.filter((e) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      e.eventType.toLowerCase().includes(q) ||
      e.eventId.toLowerCase().includes(q) ||
      e.status.toLowerCase().includes(q) ||
      e.provider.toLowerCase().includes(q)
    )
  })

  const processed = events.filter((e) => e.status === "processed").length
  const failed = events.filter((e) => e.status === "failed").length
  const pending = events.filter((e) => e.status === "pending").length

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AdminNav />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Admin</p>
              <Badge variant="secondary" className="gap-1 text-xs">
                <Shield className="size-3" />
                Billing
              </Badge>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Webhook Events</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Monitor Dodo payment webhook events and their processing status.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => mutate()} className="gap-1.5">
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </header>

        {/* ── Summary Cards ── */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Total Events</p>
              <p className="mt-2 text-2xl font-semibold">{data?.total ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Processed</p>
              <p className="mt-2 text-2xl font-semibold text-green-500">{processed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Failed</p>
              <p className="mt-2 text-2xl font-semibold text-red-500">{failed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="mt-2 text-2xl font-semibold text-amber-500">{pending}</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Recovery queue (Phase 3 Workstream B/G) ── */}
        <div className="mt-8">
          <Card>
            <CardContent className="py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    Durable recovery
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">Webhook recovery queue</h2>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    Failed, unresolved and stale deliveries stay discoverable. A batch re-runs them through the same
                    idempotent logic as the live webhook, so a replay that already applied its effect is a no-op —
                    never a second grant. Nothing self-fires: this repository has no scheduler, so a batch runs only
                    when an authorized operator triggers it.
                  </p>
                </div>
                <div className="flex items-end gap-2">
                  <label className="text-xs text-muted-foreground">
                    Batch size
                    <select
                      className="mt-1 block h-9 rounded-md border border-border bg-background px-2 text-sm"
                      value={String(batchLimit)}
                      onChange={(e) => setBatchLimit(Number(e.target.value))}
                    >
                      {[5, 10, 25, 50].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button size="sm" className="gap-1.5" disabled={recoveryRunning} onClick={() => setConfirmRecovery(true)}>
                    {recoveryRunning ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                    Run one batch
                  </Button>
                </div>
              </div>

              {queue ? (
                <>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {[
                      ["Failed", queue.stats.counts.failed, "text-red-500"],
                      ["Unresolved", queue.stats.counts.unresolved, "text-amber-500"],
                      ["Processing", queue.stats.counts.processing, "text-sky-500"],
                      ["Manual review", queue.stats.counts.manual_review, "text-foreground"],
                      ["Stale received", queue.stats.counts.stale_received, "text-amber-500"],
                      ["Eligible now", queue.stats.eligibleNow, "text-green-500"],
                    ].map(([label, value, cls]) => (
                      <div key={String(label)} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">{label}</p>
                        <p className={cn("mt-1 text-xl font-semibold tabular-nums", String(cls))}>{value as number}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Oldest eligible event:{" "}
                      {queue.stats.oldestEligibleReceivedAt ? timeAgo(queue.stats.oldestEligibleReceivedAt) : "none"}
                    </span>
                    <span>
                      Next scheduled attempt:{" "}
                      {queue.stats.nextScheduledAttemptAt
                        ? new Date(queue.stats.nextScheduledAttemptAt).toLocaleString()
                        : "nothing waiting on backoff"}
                    </span>
                    <Link href="/admin/billing/reconciliation" className="text-primary hover:underline">
                      See reconciliation findings
                    </Link>
                  </div>
                </>
              ) : null}

              {recoveryError ? (
                <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {recoveryError}
                </p>
              ) : null}

              {recoveryResult ? (
                <div className="mt-4 rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-sm font-medium">
                    Last batch — {recoveryResult.processed} claimed, {recoveryResult.resolved} resolved,{" "}
                    {recoveryResult.stillPending} still pending, {recoveryResult.escalatedToManualReview} escalated to
                    manual review.
                  </p>
                  {recoveryResult.hasMore ? (
                    <p className="mt-1 text-xs text-amber-500">
                      The batch hit its limit — more eligible events likely remain.
                    </p>
                  ) : null}
                  <ul className="mt-3 space-y-1">
                    {recoveryResult.results.map((r) => (
                      <li key={r.eventId} className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {r.outcome}
                        </Badge>
                        <span className="font-mono">{r.eventType}</span>
                        <span className="text-muted-foreground">{r.attempts} attempt(s)</span>
                        <span className="font-mono text-muted-foreground">{r.eventId.slice(0, 16)}…</span>
                        {r.reason ? <span className="text-muted-foreground">— {r.reason}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* ── Search ── */}
        <div className="mt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search events by type, ID, or status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* ── Events List ── */}
        <div className="mt-6">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Webhook className="size-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-lg font-medium">No webhook events</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search ? "Try a different search term." : "No webhook events have been received yet."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((event) => {
                const statusConfig = STATUS_CONFIG[event.status] ?? { label: event.status, color: "text-muted-foreground", icon: Clock }
                const StatusIcon = statusConfig.icon

                return (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    className="w-full text-left rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-accent/50"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusConfig.color}`}>
                            <StatusIcon className="size-3 mr-1" />
                            {statusConfig.label}
                          </span>
                          <span className="font-mono text-sm font-medium">{event.eventType}</span>
                          <Badge variant="outline" className="text-[10px]">{event.provider}</Badge>
                        </div>
                        <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="font-mono">ID: {event.eventId.slice(0, 16)}...</span>
                          <span>{formatDate(event.receivedAt)}</span>
                          <span>{timeAgo(event.receivedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Event Detail Dialog ── */}
      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Webhook className="size-4" />
                  Webhook Event
                </DialogTitle>
                <DialogDescription>{selectedEvent.eventType} · {selectedEvent.provider}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="outline" className={STATUS_CONFIG[selectedEvent.status]?.color}>
                      {STATUS_CONFIG[selectedEvent.status]?.label ?? selectedEvent.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Provider</span>
                    <span>{selectedEvent.provider}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Event Type</span>
                    <span className="font-mono">{selectedEvent.eventType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Event ID</span>
                    <span className="font-mono text-xs">{selectedEvent.eventId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Internal ID</span>
                    <span className="font-mono text-xs">{selectedEvent.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Received At</span>
                    <span>{formatDate(selectedEvent.receivedAt)}</span>
                  </div>
                  {selectedEvent.processedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Processed At</span>
                      <span>{formatDate(selectedEvent.processedAt)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payload Hash</span>
                    <span className="font-mono text-xs">{selectedEvent.payloadHash}</span>
                  </div>
                </div>

                {selectedEvent.error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-sm font-medium text-destructive">Error</p>
                    <p className="mt-1 text-sm text-muted-foreground font-mono">{selectedEvent.error}</p>
                  </div>
                )}

                {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <p className="text-sm font-medium mb-2">Metadata</p>
                    <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(selectedEvent.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedEvent(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      {/* ── Recovery batch confirmation ── */}
      <Dialog open={confirmRecovery} onOpenChange={(open) => !open && !recoveryRunning && setConfirmRecovery(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              Run a recovery batch?
            </DialogTitle>
            <DialogDescription>
              Up to {batchLimit} eligible event(s) will be re-processed through the same idempotent webhook logic used
              for live deliveries. Effects already applied are recognized and skipped, so a replay cannot grant credits
              twice. Historical ledger rows are never rewritten.
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Events whose type is not safely re-processable, or whose attempt budget is exhausted, are parked in manual
            review instead of being guessed at.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRecovery(false)} disabled={recoveryRunning}>
              Cancel
            </Button>
            <Button onClick={() => void runRecoveryBatch()} disabled={recoveryRunning} className="gap-1.5">
              {recoveryRunning ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Run batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
