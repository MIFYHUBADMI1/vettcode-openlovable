"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { useProject } from "@/lib/client/api"
import { relativeTime } from "@/lib/client/format"
import { TEAM_ROLE_META, isFounderFacingEvent, roleForStage } from "@/lib/workspace/team-roles"
import {
  JOURNEY,
  JOURNEY_TEAMS,
  buildWorkspaceView,
  journeyTeamStatus,
  type TeamRole,
} from "@/lib/workspace/workspace-view-model"
import type { Project, ProjectEvent } from "@/lib/types/project"
import { cn } from "@/lib/utils"

const FILTERS: Array<{ id: "all" | TeamRole; label: string }> = [
  { id: "all", label: "All teams" },
  { id: "cofounder", label: "Co-founder" },
  { id: "product", label: "Product" },
  { id: "engineering", label: "Engineering" },
  { id: "launch", label: "Launch" },
]

function dayLabel(at: number): string {
  const date = new Date(at)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return "Today"
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday"
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}

export function TeamProgressPage({ initialProject }: { initialProject: Project }) {
  const { project: live } = useProject(initialProject.id, { pollWhileBuilding: true })
  const project = live ?? initialProject
  const view = useMemo(() => buildWorkspaceView(project), [project])
  const [filter, setFilter] = useState<"all" | TeamRole>("all")

  const events = (project.events ?? []).filter(isFounderFacingEvent)
  const visible = filter === "all" ? events : events.filter((event) => roleForStage(event.stage) === filter)
  const ordered = [...visible].sort((a, b) => b.at - a.at)

  const counts = useMemo(() => {
    const next: Record<TeamRole, number> = { cofounder: 0, product: 0, engineering: 0, launch: 0 }
    for (const event of events) next[roleForStage(event.stage)] += 1
    return next
  }, [events])

  const groups = useMemo(() => {
    const map = new Map<string, ProjectEvent[]>()
    for (const event of ordered) {
      const key = dayLabel(event.at)
      const list = map.get(key) ?? []
      list.push(event)
      map.set(key, list)
    }
    return [...map.entries()]
  }, [ordered])

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:py-8 lg:px-8">
      <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground">All Projects</Link>
        <ChevronRight className="size-3.5" />
        <Link href={`/project/${project.id}`} className="hover:text-foreground">{project.name}</Link>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-foreground">Team progress</span>
      </nav>

      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Your Atai team</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Team progress</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-7 text-muted-foreground">{view.brief.support}</p>
      </header>

      <section className={cn("rounded-2xl border p-5 sm:p-6", view.brief.live ? "border-primary/30 bg-primary/5" : "border-border bg-card")}>
        <p className="text-sm font-medium tracking-tight">{view.brief.headline}</p>
        <ol className="mt-5 grid gap-3 sm:grid-cols-5">
          {JOURNEY.map((step, index) => {
            const status = journeyTeamStatus(step.id, view.phase, view.state)
            const here = step.id === view.phase
            return (
              <li key={step.id} className={cn("rounded-xl border px-3 py-3", here ? "border-primary/40 bg-background" : "border-border bg-background/60")}>
                <p className={cn("text-sm font-medium", here ? "text-foreground" : "text-muted-foreground")}>
                  {index + 1}. {step.label}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{JOURNEY_TEAMS[step.id]}</p>
                <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                  {status.replace("_", " ")}
                </p>
              </li>
            )
          })}
        </ol>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(Object.keys(TEAM_ROLE_META) as TeamRole[]).map((role) => {
          const meta = TEAM_ROLE_META[role]
          const active = filter === role
          return (
            <button
              key={role}
              type="button"
              onClick={() => setFilter(active ? "all" : role)}
              className={cn(
                "rounded-2xl border px-3 py-3 text-left transition-colors",
                active ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:bg-muted/40",
              )}
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{meta.title}</p>
              <p className="mt-1 text-xl font-semibold tracking-tight">{counts[role]}</p>
            </button>
          )
        })}
      </section>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              filter === item.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card px-5 py-10 text-center">
          <p className="text-sm font-medium">No team updates yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Work will appear here as the team moves on this product.</p>
        </section>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map(([day, dayEvents]) => (
            <section key={day}>
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{day}</p>
              <ol className="relative ml-3 space-y-0 border-l border-border">
                {dayEvents.map((event) => {
                  const role = roleForStage(event.stage)
                  const meta = TEAM_ROLE_META[role]
                  return (
                    <li key={event.id} className="relative py-3 pl-6">
                      <span className="absolute top-5 -left-[5px] size-2.5 rounded-full border border-background bg-foreground/70" />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("inline-flex size-6 items-center justify-center rounded-full text-[9px] font-bold", meta.tone)}>
                          {meta.initials}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">{meta.title}</span>
                        <span className="text-xs text-muted-foreground">· {relativeTime(event.at)}</span>
                      </div>
                      <p className={cn("mt-1.5 text-[15px] leading-6", event.level === "error" ? "text-destructive" : "text-foreground")}>
                        {event.message}
                      </p>
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
