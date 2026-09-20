"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Bell } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useProjectActivity } from "@/lib/client/api"
import { filterMeaningfulActivity, interpretProjectState } from "@/lib/dashboard/view-model"
import type { ProjectSummary } from "@/lib/types/project"

const STORAGE_KEY = "atai:dashboard-notifications-read"

function loadRead(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? new Set(parsed.filter((x) => typeof x === "string")) : new Set()
  } catch {
    return new Set()
  }
}

function saveRead(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids].slice(-80)))
  } catch {
    /* ignore quota */
  }
}

function relativeTime(at: number): string {
  const min = Math.max(0, Math.round((Date.now() - at) / 60000))
  if (min < 1) return "Just now"
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.round(hr / 24)}d ago`
}

export function DashboardNotifications({ project }: { project: ProjectSummary | null }) {
  const isBuilding = Boolean(
    project && (project.state === "building" || project.state === "analyzing" || project.state === "deploying"),
  )
  const { events } = useProjectActivity(project?.id ?? "", Boolean(project) && isBuilding)
  const [read, setRead] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setRead(loadRead())
  }, [])

  const items = useMemo(() => {
    if (!project) return []
    const fromEvents = filterMeaningfulActivity(Array.isArray(events) ? events : [], project, 6)
    const stateNote = interpretProjectState(project.state, project.id)
    const synthetic =
      project.state === "plan_ready" ||
      project.state === "build_failed" ||
      project.state === "deployment_failed" ||
      project.state === "deployed" ||
      project.state === "build_complete"
        ? [
            {
              id: `state-${project.id}-${project.state}-${project.updatedAt}`,
              at: project.updatedAt,
              title: stateNote.headline,
              href: stateNote.primaryAction.href,
              level: stateNote.severity === "error" ? "error" : stateNote.severity === "warning" ? "warn" : "info",
            },
          ]
        : []
    const merged = [...synthetic, ...fromEvents]
    const seen = new Set<string>()
    return merged.filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
  }, [events, project])

  const unread = items.filter((item) => !read.has(item.id)).length

  function markAllRead() {
    const next = new Set(read)
    for (const item of items) next.add(item.id)
    setRead(next)
    saveRead(next)
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) markAllRead()
      }}
    >
      <DropdownMenuTrigger className="relative rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Bell className="size-4" />
        <span className="sr-only">Notifications</span>
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>While you were away</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!project ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">No business activity yet.</p>
        ) : items.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">No meaningful updates for {project.name} yet.</p>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="block rounded-md px-2 py-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <p className="text-[11px] text-muted-foreground">{relativeTime(item.at)}</p>
                  <p className="text-sm">{item.title}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
