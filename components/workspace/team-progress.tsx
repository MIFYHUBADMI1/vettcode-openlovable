"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronRight, ExternalLink, Sparkles } from "lucide-react"
import { postJson, useProject } from "@/lib/client/api"
import { relativeTime, relativeTimeShort } from "@/lib/client/format"
import { TEAM_ROLE_META } from "@/lib/workspace/team-roles"
import {
  buildProgressViewModel,
  WORKSTREAM_STATUS_LABEL,
  type WorkstreamStatus,
} from "@/lib/workspace/progress-view-model"
import { useCofounderPanel } from "@/components/cofounder/cofounder-panel"
import type { Project } from "@/lib/types/project"
import { cn } from "@/lib/utils"
import { ProjectAssets } from "@/components/project-assets"
import { ProjectActivity } from "@/components/project-activity"

function dayLabel(at: number): string {
  const date = new Date(at)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return "Today"
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday"
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}

const STATUS_TONE: Record<WorkstreamStatus, string> = {
  working: "text-primary",
  waiting_on_you: "text-amber-600 dark:text-amber-400",
  needs_attention: "text-destructive",
  idle: "text-emerald-600 dark:text-emerald-400",
  completed_this_phase: "text-emerald-600 dark:text-emerald-400",
  not_started: "text-muted-foreground",
  status_unavailable: "text-muted-foreground",
}

function projectStateLabel(state: Project["state"]): string {
  const LABELS: Record<Project["state"], string> = {
    created: "Created",
    pending_plan: "Planning",
    analyzing: "Analyzing",
    analysis_complete: "Analysis complete",
    specification_ready: "Plan ready",
    plan_ready: "Plan ready",
    awaiting_build_confirmation: "Waiting on you",
    building: "Building",
    build_complete: "Build complete",
    build_failed: "Build needs attention",
    ready: "Ready",
    deploying: "Launching",
    deployed: "Live",
    deployment_failed: "Launch needs attention",
  }
  return LABELS[state] ?? "Status unavailable"
}

export function TeamProgressPage({ initialProject, activeBuildRuns = [] }: { initialProject: Project; activeBuildRuns?: Array<{ id: string; status: string; kind: string; startedAt: number; totalumProjectId?: string; error?: string }> }) {
  const { project: live, error: projectError, isLoading, refresh } = useProject(initialProject.id, { pollWhileBuilding: true })
  const project = live?.id === initialProject.id ? live : initialProject
  const runsForView = project.state === "building" ? activeBuildRuns : []
  const view = useMemo(() => buildProgressViewModel(project, runsForView), [project, runsForView])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [pendingMutation, setPendingMutation] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [orderDraft, setOrderDraft] = useState("")
  const { open: openCofounder } = useCofounderPanel()

  async function runMutation(kind: NonNullable<(typeof view.attention)[number]["mutation"]>) {
    if (pendingMutation) return
    setActionError(null)
    setPendingMutation(kind)
    try {
      const path =
        kind === "retry_build" || kind === "retry_launch"
          ? `/api/projects/${project.id}/retry`
          : kind === "deploy"
            ? `/api/projects/${project.id}/deploy`
            : `/api/projects/${project.id}/build`
      await postJson(path, {})
      await refresh()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "That action could not be completed.")
    } finally {
      setPendingMutation(null)
    }
  }

  function askAboutProgress() {
    const draft =
      view.now.state === "needs_attention"
        ? `The ${project.name} ${project.state === "deployment_failed" ? "launch" : "build"} needs attention. Help me understand what to do next without retrying anything yet.`
        : view.now.state === "waiting_on_you"
          ? `I'm on Team progress for ${project.name}. What decision do I need to make next?`
          : `Give me a short status on ${project.name} from the current project state.`
    openCofounder({ draft })
  }

  const groups = useMemo(() => {
    const map = new Map<string, typeof view.history>()
    for (const entry of view.history) {
      const key = dayLabel(entry.at)
      const list = map.get(key) ?? []
      list.push(entry)
      map.set(key, list)
    }
    return [...map.entries()]
  }, [view.history])

  const highlight = view.now.state === "waiting_on_you" || view.now.state === "needs_attention"

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:py-8 lg:px-8">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground">All Projects</Link>
        <ChevronRight className="size-3.5" />
        <Link href={`/project/${project.id}`} className="hover:text-foreground">{project.name}</Link>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-foreground">Team progress</span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{project.name}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">You set what the teams do</h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-7 text-muted-foreground">
            Your idea, plan, and orders are the controls. Research, product, engineering, and launch follow what you set here — they do not invent their own mission.
          </p>
        </div>
        <div className="text-right">
          <span
            aria-label={`Project status: ${projectStateLabel(project.state)}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
              view.now.state === "working" && "border-primary/30 bg-primary/5 text-primary",
              highlight && "border-destructive/30 bg-destructive/5 text-destructive",
              (view.now.state === "idle" || view.now.state === "empty") && "border-border bg-card text-muted-foreground",
            )}
          >
            {view.now.state === "working" ? (
              <span className="relative flex size-1.5">
                <span className="absolute inset-0 motion-reduce:animate-none motion-safe:animate-ping rounded-full bg-primary/70" />
                <span className="relative size-1.5 rounded-full bg-primary" />
              </span>
            ) : null}
            {projectStateLabel(project.state)}
          </span>
          {view.lastUpdatedAt ? (
            <p className="mt-1.5 text-[11px] text-muted-foreground">Updated {relativeTime(view.lastUpdatedAt)}</p>
          ) : null}
        </div>
      </header>

      <div aria-live="polite" className="contents">
      {actionError ? (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{actionError}</div>
      ) : null}
      {projectError ? (
        <div role="status" className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Latest project status could not be refreshed. Showing the last available snapshot.{" "}
          <button type="button" onClick={() => void refresh()} className="font-medium underline">
            Try again
          </button>
        </div>
      ) : null}
      {isLoading && !live ? (
        <p role="status" className="text-sm text-muted-foreground">Updating progress…</p>
      ) : null}
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Your controls — this is what the teams follow</p>
        {view.founderControls.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            You have not set direction yet. Add an idea, choose plan options, or send an order below. Until you do, the teams have nothing to execute.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {view.founderControls.map((c) => (
              <li key={c.id} className="rounded-xl border border-border bg-background/60 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{c.label}</p>
                <p className="mt-1 line-clamp-3 text-sm text-foreground">{c.value}</p>
                {c.href ? (
                  <Link href={c.href} className="mt-2 inline-flex text-xs font-medium text-primary hover:underline">
                    Change this
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-primary/20 bg-card p-5 sm:p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Issue an order</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Tell your co-founder what the teams should do next. This opens the existing co-founder — it does not start a build unless you (or an approved tool) confirm it.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <textarea
            value={orderDraft}
            onChange={(e) => setOrderDraft(e.target.value)}
            rows={2}
            placeholder="e.g. Tighten the plan, then start the first build when I approve it."
            className="min-h-[4.5rem] flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/40"
          />
          <button
            type="button"
            onClick={() => {
              const text = orderDraft.trim()
              openCofounder({
                draft: text
                  ? `Order for ${project.name}: ${text}`
                  : `Coordinate the next real step for ${project.name} from Team progress.`,
              })
            }}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Sparkles className="size-3.5" />
            Send to co-founder
          </button>
        </div>
      </section>

      {/* ── Co-founder brief ─────────────────────────────────────────── */}
      <section
        className={cn(
          "rounded-2xl border p-5 sm:p-6",
          highlight ? "border-destructive/30 bg-destructive/5" : view.now.state === "working" ? "border-primary/30 bg-primary/5" : "border-border bg-card",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">From your co-founder</p>
            <h2 className="mt-2 max-w-2xl text-xl font-semibold tracking-tight text-balance">{view.brief.headline}</h2>
            <p className="mt-2 max-w-2xl text-[15px] leading-7 text-muted-foreground">{view.brief.support}</p>
          </div>
          <button
            type="button"
            onClick={askAboutProgress}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:border-primary/30 hover:text-primary"
          >
            <Sparkles className="size-3.5" />
            Ask your co-founder
          </button>
        </div>
      </section>

      {/* ── Now ──────────────────────────────────────────────────────── */}
      <section aria-label="Current work" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Right now</p>
        <p className="mt-3 text-base font-medium tracking-tight">{view.now.headline}</p>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">{view.now.body}</p>
        {view.now.state === "needs_attention" ? (
          <button type="button" onClick={askAboutProgress} className="mt-3 mr-3 inline-flex text-sm font-medium text-primary hover:underline">
            Ask your co-founder about this
          </button>
        ) : null}
        {view.now.action ? (
          view.now.action.external ? (
            <a
              href={view.now.action.href}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              {view.now.action.label}
              <ExternalLink className="size-3.5" />
            </a>
          ) : (
            <Link href={view.now.action.href} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              {view.now.action.label}
            </Link>
          )
        ) : null}
      </section>

      {/* ── Active build run (current task) ────────────────────────────────── */}
      {view.activeBuildRun ? (
        <section aria-label="Current task" className="rounded-2xl border border-primary/20 bg-primary/5 bg-card p-5 sm:p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Current task</p>
          <p className="mt-2 text-base font-medium tracking-tight">
            {view.activeBuildRun.kind === "initial" ? "Building your application" : "Applying your changes"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Started {relativeTime(view.activeBuildRun.startedAt)}
          </p>
          {view.activeBuildRun.error ? (
            <p className="mt-2 text-sm text-destructive">{view.activeBuildRun.error}</p>
          ) : null}
          <Link href={`/project/${initialProject.id}/edit`} className="mt-3 inline-flex text-sm font-medium text-primary hover:underline">
            Review in workspace
          </Link>
        </section>
      ) : null}

      {/* ── Workstream roster ────────────────────────────────────────── */}
      <section aria-label="Workstreams">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Your teams — command them</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {view.workstreams.map((stream) => {
            const cmd = stream.command
            return (
              <li key={stream.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold tracking-tight">{stream.name}</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{stream.responsibility}</p>
                  </div>
                  <p className={cn("shrink-0 text-xs font-medium", STATUS_TONE[stream.status])}>
                    {stream.status === "working" ? "● " : ""}
                    {WORKSTREAM_STATUS_LABEL[stream.status]}
                  </p>
                </div>
                {stream.latestNote ? (
                  <p className="mt-3 line-clamp-2 text-[13px] leading-5 text-foreground/90">{stream.latestNote}</p>
                ) : (
                  <p className="mt-3 text-[13px] leading-5 text-muted-foreground">
                    Standing by for your direction.
                  </p>
                )}
                {stream.latestAt ? (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">Last update {relativeTimeShort(stream.latestAt)}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {cmd?.kind === "mutation" && cmd.mutation ? (
                    <button
                      type="button"
                      disabled={Boolean(pendingMutation)}
                      onClick={() => void runMutation(cmd.mutation!)}
                      className="inline-flex rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
                    >
                      {pendingMutation === cmd.mutation ? "Sending…" : cmd.label}
                    </button>
                  ) : null}
                  {cmd?.kind === "navigate" && cmd.href ? (
                    <Link href={cmd.href} className="inline-flex rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:border-primary/40">
                      {cmd.label}
                    </Link>
                  ) : null}
                  {cmd?.kind === "brief" ? (
                    <button
                      type="button"
                      onClick={() => openCofounder({ draft: cmd.brief })}
                      className="inline-flex rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:border-primary/40"
                    >
                      {cmd.label}
                    </button>
                  ) : null}
                  {stream.action ? (
                    <Link href={stream.action.href} className="text-xs font-medium text-primary hover:underline">
                      {stream.action.label}
                    </Link>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
          These are workstreams your co-founder runs — not separate hired agents. Build and launch buttons only fire when the backend allows it.
        </p>
      </section>

      {/* ── Journey ──────────────────────────────────────────────────── */}
      <section aria-label="Project journey" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">From idea to live</p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-5">
          {view.journey.map((stage, index) => (
            <li
              key={stage.id}
              className={cn(
                "rounded-xl border px-3 py-3",
                stage.status === "active" ? "border-primary/40 bg-background" : "border-border bg-background/60",
              )}
            >
              <p className={cn("text-sm font-medium", stage.status === "active" ? "text-foreground" : "text-muted-foreground")}>
                {stage.status === "complete" ? "✓ " : `${index + 1}. `}
                {stage.label}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                {TEAM_ROLE_META[stage.workstream]?.title ?? "Co-founder"}
              </p>
              <p
                className={cn(
                  "mt-2 text-[11px] font-medium",
                  stage.status === "active" && "text-primary",
                  stage.status === "complete" && "text-emerald-600 dark:text-emerald-400",
                  stage.status === "attention" && "text-destructive",
                  (stage.status === "not_started" || stage.status === "unverified") && "text-muted-foreground",
                )}
              >
                {stage.status === "active"
                  ? "In progress"
                  : stage.status === "complete"
                    ? "Done"
                    : stage.status === "attention"
                      ? "Needs attention"
                      : stage.status === "unverified"
                        ? stage.note ?? "Not verified"
                        : "Not started"}
              </p>
              {stage.evidence ? (
                stage.evidence.href.startsWith("http") ? (
                  <a href={stage.evidence.href} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                    {stage.evidence.label}
                    <ExternalLink className="size-3" />
                  </a>
                ) : (
                  <Link href={stage.evidence.href} className="mt-1.5 inline-flex text-[11px] font-medium text-primary hover:underline">
                    {stage.evidence.label}
                  </Link>
                )
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      {view.handoffs.length > 0 ? (
        <section aria-label="Workflow transitions" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">What just changed</p>
          <ul className="mt-4 space-y-3">
            {view.handoffs.slice(0, 5).map((handoff) => (
              <li key={handoff.id} className="rounded-xl border border-border bg-background/60 px-4 py-3">
                <p className="text-sm text-foreground">{handoff.reason}</p>
                {handoff.resultingTask ? (
                  <p className="mt-1 text-sm text-muted-foreground">{handoff.resultingTask}</p>
                ) : null}
                <p className="mt-1 text-[11px] text-muted-foreground">{relativeTimeShort(handoff.at)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ── Founder attention ────────────────────────────────────────── */}
      <section aria-label="Needs your attention">
        {view.attention.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-5 py-6 text-center">
            <p className="text-sm font-medium">Nothing needs you right now</p>
            <p className="mt-1 text-sm text-muted-foreground">Decisions for you will land here when they exist.</p>
          </div>
        ) : (
          <ul className="grid gap-3">
            {view.attention.map((item) => (
              <li
                key={item.id}
                className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 sm:p-5"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-destructive">Needs you</p>
                <p className="mt-2 text-sm font-semibold tracking-tight text-foreground">{item.title}</p>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{item.body}</p>
                {item.mutation ? (
                  <button
                    type="button"
                    disabled={Boolean(pendingMutation)}
                    onClick={() => void runMutation(item.mutation)}
                    className="mt-3 inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
                  >
                    {pendingMutation === item.mutation
                      ? "Working…"
                      : item.mutation === "retry_build"
                        ? "Retry build"
                        : item.mutation === "retry_launch"
                          ? "Retry launch"
                          : item.mutation === "deploy"
                            ? "Launch"
                            : "Start building"}
                  </button>
                ) : null}
                {item.action ? (
                  item.action.href.startsWith("http") ? (
                    <a href={item.action.href} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                      {item.action.label}
                      <ExternalLink className="size-3.5" />
                    </a>
                  ) : (
                    <Link href={item.action.href} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                      {item.action.label}
                      <ExternalLink className="size-3.5" />
                    </Link>
                  )
                ) : null}
                {item.secondaryAction ? (
                  <Link href={item.secondaryAction.href} className="mt-1 inline-flex text-xs font-medium text-muted-foreground hover:text-primary hover:underline">
                    {item.secondaryAction.label}
                  </Link>
                ) : null}
             </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Deliverables ─────────────────────────────────────────────── */}
      {view.deliverables.length > 0 ? (
        <section aria-label="Deliverables">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Your deliverables</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {view.deliverables.map((d) => (
              <li key={d.id} className="rounded-xl border border-border bg-card px-4 py-3">
                {d.href.startsWith("http") ? (
                  <a href={d.href} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 text-sm font-medium text-foreground hover:text-primary">
                    {d.label}
                    <ExternalLink className="size-3.5 shrink-0" />
                  </a>
                ) : (
                  <Link href={d.href} className="flex items-center justify-between gap-3 text-sm font-medium text-foreground hover:text-primary">
                    {d.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ── History ──────────────────────────────────────────────────── */}
      <section aria-label="Progress history">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Progress so far</p>
        {groups.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-5 py-10 text-center">
            <p className="text-sm font-medium">No progress notes yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Work summaries appear here as your co-founder moves this project forward.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {groups.map(([day, entries]) => (
              <section key={day}>
                <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{day}</p>
                <ol className="relative ml-3 space-y-0 border-l border-border">
                  {entries.map((entry) => {
                    const meta = TEAM_ROLE_META[entry.role]
                    return (
                      <li key={entry.id} className="relative py-3 pl-6">
                        <span
                          className={cn(
                            "absolute top-5 -left-[5px] size-2.5 rounded-full border border-background",
                            entry.kind === "failure" ? "bg-destructive" : entry.kind === "outcome" ? "bg-foreground/70" : "bg-muted-foreground/60",
                          )}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn("inline-flex size-6 items-center justify-center rounded-full text-[9px] font-bold", meta.tone)}>
                            {meta.initials}
                          </span>
                          <span className="text-xs font-medium text-muted-foreground">{meta.title}</span>
                          <span className="text-xs text-muted-foreground">· {relativeTime(entry.at)}</span>
                        </div>
                        <p className={cn("mt-1.5 text-[15px] leading-6", entry.kind === "failure" ? "text-destructive" : "text-foreground")}>
                          {entry.message}
                        </p>
                      </li>
                    )
                  })}
                </ol>
              </section>
            ))}
          </div>
        )}
      </section>

      {/* ── Technical diagnostics + assets (secondary) ──────────────── */}
      <section id="advanced" className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="flex w-full items-center justify-between text-left">
          <span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Technical details</p>
            <p className="mt-1 text-sm text-muted-foreground">Full activity log and project assets.</p>
          </span>
          <span className="text-xs font-medium text-primary">{showAdvanced ? "Hide" : "Show"}</span>
        </button>
        {showAdvanced ? (
          <div className="mt-6 flex flex-col gap-8">
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Activity</p>
              <ProjectActivity projectId={project.id} isBuilding={view.live} events={project.events ?? []} />
            </div>
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Product assets</p>
              <p className="mb-3 text-sm text-muted-foreground">Screenshots and reference materials for this project appear here.</p>
              <ProjectAssets projectId={project.id} />
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
