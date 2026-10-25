"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { CalendarClock, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ContentItemView } from "@/lib/marketing/studio/present"

/**
 * Content calendar (Phase 4 v2).
 *
 * Lists drafts that have a `plannedAt` date. A plan is not a publication: there
 * is no scheduler and nothing is sent anywhere, so a past date shows as
 * "overdue plan" — never as "published".
 */

function toLocalInput(ms: number | undefined): string {
  if (!ms) return ""
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function format(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function StudioCalendar({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [items, setItems] = useState<ContentItemView[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/studio/calendar`)
    const json = await response.json()
    if (!response.ok || !json.ok) throw new Error(json?.error?.message ?? "Couldn't load the calendar.")
    return json.data.items as ContentItemView[]
  }, [projectId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    load()
      .then((data) => !cancelled && setItems(data))
      .catch((e) => !cancelled && toast.error(e instanceof Error ? e.message : "Couldn't load the calendar."))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [load])

  async function setPlanned(id: string, value: string) {
    setBusyId(id)
    try {
      const ms = value ? new Date(value).getTime() : null
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/studio/library/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plannedAt: ms }),
      })
      const json = await response.json()
      if (!response.ok || !json.ok) {
        toast.error(json?.error?.message ?? "Couldn't move that item.")
        return
      }
      const updated = json.data.item as ContentItemView
      setItems((prev) =>
        updated.plannedAt
          ? [...prev.filter((i) => i.id !== id), updated].sort((a, b) => (a.plannedAt ?? 0) - (b.plannedAt ?? 0))
          : prev.filter((i) => i.id !== id),
      )
      toast.success(updated.plannedAt ? "Plan updated." : "Removed from the calendar.")
      router.refresh()
    } finally {
      setBusyId(null)
    }
  }

  const now = Date.now()

  return (
    <section aria-labelledby="calendar-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="calendar-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <CalendarClock className="h-4 w-4" aria-hidden /> Content calendar
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          These are plans you set on your drafts. Nothing is scheduled with any platform, and a past date does not mean
          anything was published.
        </p>
      </div>

      {loading ? (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground" role="status">
          Loading plans…
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          No planned content yet. Open a draft in the Library and set a planned date.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">
          {items.map((item) => {
            const overdue = (item.plannedAt ?? 0) < now && item.status !== "ready_for_review"
            return (
              <li key={item.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{item.title}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{item.kind}</span>
                    {overdue ? (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                        overdue plan
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.plannedAt ? format(item.plannedAt) : "No date"} · {item.status === "ready_for_review" ? "ready for review" : "draft"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`plan-${item.id}`}>
                    Planned date for {item.title}
                  </label>
                  <input
                    id={`plan-${item.id}`}
                    type="datetime-local"
                    defaultValue={toLocalInput(item.plannedAt)}
                    key={`${item.id}-${item.plannedAt ?? 0}`}
                    onChange={(e) => setPlanned(item.id, e.target.value)}
                    disabled={busyId === item.id}
                    className="rounded-xl border border-border bg-background px-2 py-1.5 text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPlanned(item.id, "")}
                    disabled={busyId === item.id}
                  >
                    {busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Clear"}
                  </Button>
                  <Link
                    href={`/project/${projectId}/studio?tab=library`}
                    className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Open in library
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
