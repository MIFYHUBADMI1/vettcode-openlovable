"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  ArrowLeft, ArrowRight, Globe2, Lightbulb, GitBranch, Search, Trash2,
  Loader2, LayoutGrid, List, SlidersHorizontal, FolderOpen,
  Clock, CheckCircle2, AlertCircle, Zap, Plus, Rocket, Brain,
} from "lucide-react"
import { toast } from "sonner"
import { AppHeader } from "@/components/app-header"
import { StateBadge } from "@/components/state-badge"
import { ProjectThumbnail } from "@/components/project-thumbnail"
import { useProjects, deleteJson } from "@/lib/client/api"
import { cn } from "@/lib/utils"
import { type ProjectState, type ProjectSummary } from "@/lib/types/project"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, "") } catch { return url }
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms
  const mins = Math.round(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// Mode label and icon — reflects Atai's three starting points
function modeLabel(mode: string): string {
  if (mode === "website") return "Competitor build"
  if (mode === "github") return "GitHub build"
  return "Idea build"
}

function ModeIcon({ mode, className }: { mode: string; className?: string }) {
  if (mode === "website") return <Globe2 className={className} />
  if (mode === "github") return <GitBranch className={className} />
  return <Lightbulb className={className} />
}

// ─── Filter groups ────────────────────────────────────────────────────────────

type FilterGroup = "all" | "planning" | "building" | "live" | "failed"

const FILTER_GROUPS: {
  id: FilterGroup
  label: string
  icon: React.ElementType
  states: ProjectState[] | null
}[] = [
    { id: "all", label: "All", icon: FolderOpen, states: null },
    { id: "planning", label: "Planning", icon: Brain, states: ["created", "analyzing", "analysis_complete", "specification_ready", "plan_ready", "awaiting_build_confirmation", "pending_plan"] },
    { id: "building", label: "Building", icon: Zap, states: ["building", "build_complete", "deploying"] },
    { id: "live", label: "Live", icon: CheckCircle2, states: ["ready", "deployed"] },
    { id: "failed", label: "Failed", icon: AlertCircle, states: ["build_failed", "deployment_failed"] },
  ]

type SortKey = "updatedAt" | "name" | "state"

// ─── Delete dialog ────────────────────────────────────────────────────────────

function DeleteDialog({
  project,
  open,
  onOpenChange,
  onDeleted,
}: {
  project: ProjectSummary | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  if (!project) return null
  const title = project.name

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteJson(`/api/projects/${project!.id}`)
      toast.success("Project deleted")
      onOpenChange(false)
      onDeleted()
    } catch (e) {
      toast.error((e as Error).message || "Failed to delete project")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this project?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes <span className="font-medium text-foreground">{title}</span> and all
            its data, build history, and deployment records. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleDelete() }}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? <Loader2 className="size-3.5 animate-spin" /> : "Delete project"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ─── Grid card ────────────────────────────────────────────────────────────────

function GridCard({
  project,
  onDeleteRequest,
}: {
  project: ProjectSummary
  onDeleteRequest: (p: ProjectSummary) => void
}) {
  const hasThumbnail = Boolean(project.thumbnailUrl)
  const isPlanReady = project.state === "plan_ready"

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      {/* Delete trigger */}
      <button
        aria-label="Delete project"
        onClick={(e) => { e.preventDefault(); onDeleteRequest(project) }}
        className="absolute right-3 top-3 z-10 flex size-7 items-center justify-center rounded-md bg-card/80 text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
      >
        <Trash2 className="size-3.5" />
      </button>

      <Link href={isPlanReady ? `/project/${project.id}/collaborate` : `/project/${project.id}`} className="flex flex-1 flex-col">
        {/* Thumbnail */}
        {hasThumbnail ? (
          <div className="relative aspect-[16/7] w-full overflow-hidden bg-muted">
            <ProjectThumbnail
              src={project.thumbnailUrl}
              alt={`Preview of ${project.name}`}
              className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-card/80" />
            <div className="absolute bottom-2 right-2">
              <StateBadge state={project.state} />
            </div>
          </div>
        ) : null}

        <div className={hasThumbnail ? "flex flex-1 flex-col gap-3 p-4" : "flex flex-1 flex-col gap-4 p-5"}>
          {!hasThumbnail && (
            <div className="flex items-center justify-between">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
                <ModeIcon mode={project.mode} className="size-4 text-primary" />
              </div>
              <StateBadge state={project.state} />
            </div>
          )}

          <div className="flex-1">
            <p className="truncate font-semibold text-sm text-foreground leading-snug">{project.name}</p>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/70 uppercase tracking-widest">
              {modeLabel(project.mode)}
            </p>
          </div>

          {/* Plan ready prompt */}
          {isPlanReady && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
              <p className="text-[11px] font-semibold text-primary">✨ Plan ready — review before building</p>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
              <Clock className="size-3" />
              {relativeTime(project.updatedAt)}
            </span>
            <span className="font-mono text-[10px] text-primary opacity-0 transition-opacity group-hover:opacity-100">
              {isPlanReady ? "Review →" : "Open →"}
            </span>
          </div>
        </div>
      </Link>
    </div>
  )
}

// ─── List row ────────────────────────────────────────────────────────────────

function ListRow({
  project,
  onDeleteRequest,
}: {
  project: ProjectSummary
  onDeleteRequest: (p: ProjectSummary) => void
}) {
  const isPlanReady = project.state === "plan_ready"
  const href = isPlanReady ? `/project/${project.id}/collaborate` : `/project/${project.id}`

  return (
    <div className="group relative flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 transition-all hover:border-primary/30 hover:shadow-sm">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <ModeIcon mode={project.mode} className="size-4 text-primary" />
      </div>

      <div className="min-w-0 flex-1">
        <Link href={href} className="group/link">
          <p className="truncate font-semibold text-sm text-foreground transition-colors group-hover/link:text-primary">
            {project.name}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest">
            {modeLabel(project.mode)}
            {isPlanReady && <span className="ml-2 text-primary">· Plan ready</span>}
          </p>
        </Link>
      </div>

      <div className="hidden sm:block">
        <StateBadge state={project.state} />
      </div>

      <span className="hidden shrink-0 font-mono text-xs text-muted-foreground md:block">
        {relativeTime(project.updatedAt)}
      </span>

      <div className="flex items-center gap-1">
        <Link
          href={href}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Open project"
        >
          <ArrowRight className="size-3.5" />
        </Link>
        <button
          aria-label="Delete project"
          onClick={() => onDeleteRequest(project)}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { projects, isLoading, refresh } = useProjects()

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterGroup>("all")
  const [sort, setSort] = useState<SortKey>("updatedAt")
  const [view, setView] = useState<"grid" | "list">("grid")
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  function requestDelete(p: ProjectSummary) {
    setDeleteTarget(p)
    setDeleteOpen(true)
  }

  const displayed = useMemo(() => {
    let result = [...projects]
    const group = FILTER_GROUPS.find((g) => g.id === filter)
    if (group?.states) result = result.filter((p) => group.states!.includes(p.state))
    const q = search.trim().toLowerCase()
    if (q) result = result.filter((p) => p.name.toLowerCase().includes(q) || (p.sourceUrl && String(p.sourceUrl).toLowerCase().includes(q)))
    result.sort((a, b) => {
      if (sort === "updatedAt") return b.updatedAt - a.updatedAt
      if (sort === "name") return a.name.localeCompare(b.name)
      if (sort === "state") return a.state.localeCompare(b.state)
      return 0
    })
    return result
  }, [projects, filter, search, sort])

  const groupCounts = useMemo(() => {
    const counts: Record<FilterGroup, number> = { all: 0, planning: 0, building: 0, live: 0, failed: 0 }
    projects.forEach((p) => {
      counts.all++
      for (const g of FILTER_GROUPS) {
        if (g.id !== "all" && g.states?.includes(p.state)) counts[g.id]++
      }
    })
    return counts
  }, [projects])

  // Count projects needing action (plan ready)
  const needsAction = projects.filter((p) => p.state === "plan_ready").length

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />

      <div className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10">

        {/* ── Page header ── */}
        <div className="mb-10 flex flex-col gap-5 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="mb-3 inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="size-3" /> Dashboard
            </Link>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Your businesses</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">All projects</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isLoading
                ? "Loading your projects…"
                : projects.length === 0
                  ? "No projects yet. Pick a starting point below."
                  : `${projects.length} project${projects.length === 1 ? "" : "s"} — each one a business you're building with Atai`}
            </p>
            {/* Action prompt for plan_ready projects */}
            {needsAction > 0 && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 font-mono text-xs text-primary">
                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                {needsAction} plan{needsAction > 1 ? "s" : ""} ready for your review
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Link
              href="/new/idea"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-accent hover:text-foreground"
            >
              <Lightbulb className="size-4" /> From idea
            </Link>
            <Link
              href="/new/website"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="size-4" /> New project
            </Link>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          {/* Filter tabs */}
          <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
            {FILTER_GROUPS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {label}
                {groupCounts[id] > 0 && (
                  <span className={cn(
                    "ml-0.5 rounded-full px-1.5 py-0.5 font-mono text-[9px] tabular-nums",
                    filter === id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}>
                    {groupCounts[id]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search projects…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 rounded-xl border border-border bg-card pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 w-52"
              />
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1.5">
              <SlidersHorizontal className="size-3.5 text-muted-foreground" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="bg-transparent text-xs text-foreground focus:outline-none"
              >
                <option value="updatedAt">Last updated</option>
                <option value="name">Name</option>
                <option value="state">Status</option>
              </select>
            </div>

            <div className="flex rounded-xl border border-border bg-card p-1">
              <button
                onClick={() => setView("grid")}
                className={cn(
                  "flex size-7 items-center justify-center rounded-lg transition-colors",
                  view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
                aria-label="Grid view"
              >
                <LayoutGrid className="size-3.5" />
              </button>
              <button
                onClick={() => setView("list")}
                className={cn(
                  "flex size-7 items-center justify-center rounded-lg transition-colors",
                  view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
                aria-label="List view"
              >
                <List className="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        {isLoading ? (
          <div className={cn(
            view === "grid"
              ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              : "flex flex-col gap-3",
          )}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "animate-pulse rounded-2xl border border-border bg-card",
                  view === "grid" ? "h-48" : "h-16",
                )}
              />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center gap-5 rounded-2xl border border-dashed border-border bg-card/40 py-24 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <Rocket className="size-7 text-muted-foreground" />
            </div>
            {projects.length === 0 ? (
              <>
                <div>
                  <p className="text-lg font-bold text-foreground">Your first business starts here</p>
                  <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
                    Describe your idea, paste a competitor&apos;s URL, or link a GitHub repo.
                    Atai handles the planning, building, and launching.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  <Link
                    href="/new/idea"
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    <Lightbulb className="size-4" /> Start from an idea
                  </Link>
                  <Link
                    href="/new/website"
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-accent"
                  >
                    <Globe2 className="size-4" /> Build on a competitor
                  </Link>
                  <Link
                    href="/new/github"
                    className="inline-flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/5 px-5 py-2.5 text-sm font-medium text-purple-600 hover:bg-purple-500/10 dark:text-purple-400"
                  >
                    <GitBranch className="size-4" /> From a GitHub repo
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="font-semibold text-foreground">No matches found</p>
                  <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search or filter.</p>
                </div>
                <button
                  onClick={() => { setSearch(""); setFilter("all") }}
                  className="text-sm text-primary hover:underline"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        ) : view === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {displayed.map((p) => (
              <GridCard key={p.id} project={p} onDeleteRequest={requestDelete} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="hidden grid-cols-[1fr_auto_auto_auto] gap-4 px-5 pb-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground sm:grid">
              <span>Project</span>
              <span>Status</span>
              <span>Updated</span>
              <span />
            </div>
            {displayed.map((p) => (
              <ListRow key={p.id} project={p} onDeleteRequest={requestDelete} />
            ))}
          </div>
        )}

        {/* ── Stats footer ── */}
        {!isLoading && projects.length > 0 && (
          <div className="mt-10 flex flex-wrap items-center gap-6 border-t border-border pt-6 text-xs text-muted-foreground">
            {FILTER_GROUPS.filter((g) => g.id !== "all").map(({ id, label, icon: Icon }) => (
              groupCounts[id] > 0 && (
                <div key={id} className="flex items-center gap-1.5">
                  <Icon className="size-3.5" />
                  <span>{groupCounts[id]} {label.toLowerCase()}</span>
                </div>
              )
            ))}
            <div className="flex items-center gap-1.5 ml-auto">
              <FolderOpen className="size-3.5" />
              <span>{projects.length} total project{projects.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        )}
      </div>

      <DeleteDialog
        project={deleteTarget}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={refresh}
      />
    </main>
  )
}
