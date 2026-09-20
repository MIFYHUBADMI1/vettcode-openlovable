"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import useSWR from "swr"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { AdminNav } from "@/components/admin-nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { jsonFetcher, patchJson } from "@/lib/client/api"
import { relativeTime } from "@/lib/client/format"
import {
  FEATURE_REQUEST_STATUSES,
  STATUS_LABEL,
  categoryLabel,
} from "@/lib/feature-requests/config"
import type { PublicFeatureRequest } from "@/lib/feature-requests/types"
import { StatusBadge } from "@/components/feature-requests/status-badge"

type AdminDetail = {
  request: PublicFeatureRequest
  uniqueVoters: number
  recentVotes: number
  hidden: boolean
  history: { id: string; fromStatus: string | null; toStatus: string; reason?: string; createdAt: number }[]
  internalNotes: { id: string; body: string; createdAt: number }[]
}

export default function AdminFeatureRequestDetailPage() {
  const params = useParams<{ id: string }>()
  const { data, error, isLoading, mutate } = useSWR<AdminDetail>(
    params.id ? `/api/admin/feature-requests/${params.id}` : null,
    jsonFetcher,
  )
  const [status, setStatus] = useState<string>("")
  const [reason, setReason] = useState("")
  const [canonicalRequestId, setCanonical] = useState("")
  const [internalNote, setInternalNote] = useState("")
  const [publicUpdate, setPublicUpdate] = useState("")
  const [releaseNote, setReleaseNote] = useState("")
  const [releaseLink, setReleaseLink] = useState("")
  const [pending, setPending] = useState(false)

  async function save(extra: Record<string, unknown> = {}) {
    if (!params.id) return
    setPending(true)
    try {
      const next = await patchJson<AdminDetail>(`/api/admin/feature-requests/${params.id}`, {
        status: status || undefined,
        reason: reason || undefined,
        canonicalRequestId: canonicalRequestId || undefined,
        internalNote: internalNote || undefined,
        publicUpdate: publicUpdate || undefined,
        releaseNote: releaseNote || undefined,
        releaseLink: releaseLink || undefined,
        ...extra,
      })
      await mutate(next, { revalidate: false })
      setInternalNote("")
      setPublicUpdate("")
      setReason("")
      toast.success("Saved")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save.")
    } finally {
      setPending(false)
    }
  }

  const req = data?.request

  return (
    <div className="min-h-svh bg-background">
      <AdminNav />
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <Link href="/admin/feature-requests" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Feature Requests
        </Link>
        {isLoading ? (
          <div className="mt-8 flex justify-center">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : error || !req ? (
          <p className="mt-8 text-sm text-muted-foreground">Request not found.</p>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">{categoryLabel(req.category)}</span>
                <StatusBadge status={req.status} />
              </div>
              <h1 className="mt-2 text-2xl font-semibold">{req.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {req.voteCount} votes · {data.uniqueVoters} unique voters · +{data.recentVotes} this week · {req.author.name}
              </p>
              <h2 className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">User request</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{req.description}</p>
              {req.whyItMatters ? (
                <>
                  <h2 className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Why it matters</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{req.whyItMatters}</p>
                </>
              ) : null}
              {req.updates && req.updates.length > 0 ? (
                <>
                  <h2 className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Public updates</h2>
                  <ul className="mt-2 space-y-2">
                    {req.updates.map((u) => (
                      <li key={u.id} className="rounded-lg border border-border p-3 text-sm">
                        {u.body}
                        <span className="mt-1 block text-xs text-muted-foreground">{relativeTime(u.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-semibold">Review</h2>
              <label className="mt-4 block text-xs font-medium text-muted-foreground">Status</label>
              <select
                className="mt-1 h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
                value={status || req.status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {FEATURE_REQUEST_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              {(status === "declined" || status === "duplicate" || req.status === "declined") && (
                <>
                  <label className="mt-3 block text-xs font-medium text-muted-foreground">Reason</label>
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
                </>
              )}
              {(status === "duplicate" || req.status === "duplicate") && (
                <>
                  <label className="mt-3 block text-xs font-medium text-muted-foreground">Canonical request ID</label>
                  <Input value={canonicalRequestId} onChange={(e) => setCanonical(e.target.value)} placeholder="fr_..." />
                </>
              )}
              <label className="mt-3 block text-xs font-medium text-muted-foreground">Release note</label>
              <Textarea value={releaseNote} onChange={(e) => setReleaseNote(e.target.value)} rows={2} />
              <label className="mt-3 block text-xs font-medium text-muted-foreground">Release link</label>
              <Input value={releaseLink} onChange={(e) => setReleaseLink(e.target.value)} />
              <label className="mt-3 block text-xs font-medium text-muted-foreground">Internal notes (not public)</label>
              <Textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)} rows={3} />
              {data.internalNotes.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {data.internalNotes.map((n) => (
                    <li key={n.id} className="rounded-lg bg-muted/50 p-2 text-xs">
                      {n.body}
                      <span className="mt-1 block text-muted-foreground">{relativeTime(n.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <label className="mt-3 block text-xs font-medium text-muted-foreground">Publish update</label>
              <Textarea value={publicUpdate} onChange={(e) => setPublicUpdate(e.target.value)} rows={3} />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button disabled={pending} onClick={() => void save()}>
                  Save review
                </Button>
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => void save({ hidden: !data.hidden })}
                >
                  {data.hidden ? "Restore" : "Hide"}
                </Button>
              </div>
              <h3 className="mt-6 text-xs font-medium uppercase tracking-wide text-muted-foreground">History</h3>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {data.history.length === 0 ? <li>No status changes yet.</li> : null}
                {data.history.map((h) => (
                  <li key={h.id}>
                    {relativeTime(h.createdAt)} — {h.fromStatus ?? "—"} → {h.toStatus}
                    {h.reason ? ` — ${h.reason}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
