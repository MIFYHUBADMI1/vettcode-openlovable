"use client"

import useSWR from "swr"
import { cn } from "@/lib/utils"

interface ActivityEvent {
  id: string
  at: number
  level: string
  stage: string
  message: string
}

async function fetcher(url: string) {
  const response = await fetch(url)
  const body = await response.json()
  if (!response.ok || !body.ok) throw new Error(body.error?.message ?? "Unable to load activity")
  return body.data as { events: ActivityEvent[] }
}

function relativeTime(at: number): string {
  const diffMs = Date.now() - at
  const diffSec = Math.round(diffMs / 1000)
  if (diffSec < 10) return "just now"
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHour = Math.round(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`
  const diffDay = Math.round(diffHour / 24)
  return `${diffDay}d ago`
}

function levelIcon(level: string) {
  if (level === "error") return { glyph: "!", className: "border-destructive/40 bg-destructive/15 text-destructive" }
  if (level === "warn") return { glyph: "•", className: "border-primary/40 bg-primary/15 text-primary" }
  return { glyph: "✓", className: "border-success/40 bg-success/15 text-success" }
}

export function ProjectActivity({ projectId }: { projectId: string }) {
  const { data, error } = useSWR(`/api/projects/${projectId}/activity`, fetcher, { refreshInterval: 5000 })

  if (error) return <p className="text-sm text-destructive">{error.message}</p>
  if (!data) return <p className="text-sm text-muted-foreground">Loading activity…</p>
  if (!data.events.length)
    return <p className="text-sm text-muted-foreground">Nothing has happened yet — this fills in as soon as work starts.</p>

  const events = data.events.slice().reverse()

  return (
    <ol className="flex flex-col gap-4">
      {events.map((event, index) => {
        const icon = levelIcon(event.level)
        return (
          <li
            key={event.id}
            className={cn("flex gap-3", index === 0 && "float-in")}
          >
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                icon.className,
              )}
            >
              {icon.glyph}
            </span>
            <div className="flex flex-1 flex-col gap-0.5">
              <p className="text-sm leading-relaxed text-foreground">{event.message}</p>
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                {event.stage} · {relativeTime(event.at)}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
