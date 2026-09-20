"use client"

import { useState, useEffect } from "react"
import { useProjectActivity } from "@/lib/client/api"
import { cn } from "@/lib/utils"

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

/** Hide events that leak internal API routes or technical implementation details. */
function isUserFacing(event: { message: string }): boolean {
  const msg = event.message
  if (/Fetch (GET|POST|PUT|DELETE|PATCH)/i.test(msg)) return false
  if (/\/api\/v1\//i.test(msg)) return false
  if (/every \d+ seconds? to track/i.test(msg)) return false
  return true
}

interface ProjectActivityProps {
  projectId: string
  /** Pass true while a build/deploy is active to increase poll frequency. */
  isBuilding?: boolean
}

export function ProjectActivity({ projectId, isBuilding = false }: ProjectActivityProps) {
  // Uses the canonical hook — shares the same SWR cache entry as
  // edit-workspace.tsx and ConversationTab, so only ONE network request
  // is ever in flight for this project's activity data.
  const { events: freshEvents, error } = useProjectActivity(projectId, isBuilding)

  // Stable events: never flash empty if we've already shown data
  const [stableEvents, setStableEvents] = useState(freshEvents)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(freshEvents.length > 0)

  useEffect(() => {
    if (freshEvents.length > 0) {
      setStableEvents(freshEvents)
      setHasLoadedOnce(true)
    }
  }, [freshEvents])

  if (error) return <p className="text-sm text-destructive">{error.message}</p>

  if (!hasLoadedOnce) {
    return <p className="text-sm text-muted-foreground">Loading activity…</p>
  }

  const eventsToShow = stableEvents.length > 0 ? stableEvents : freshEvents

  if (eventsToShow.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing has happened yet — this fills in as soon as work starts.</p>
  }

  const displayEvents = eventsToShow.slice().filter(isUserFacing).reverse()

  return (
    <ol className="flex flex-col gap-4">
      {displayEvents.map((event: { id: string; level: string; stage: string; message: string; at: number }, index: number) => {
        const icon = levelIcon(event.level)
        return (
          <li key={event.id} className={cn("flex gap-3", index === 0 && "float-in")}>
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
