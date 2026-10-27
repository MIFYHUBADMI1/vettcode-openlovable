"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  ArrowLeft, ArrowRight, Globe2, Lightbulb, GitBranch, Search, Trash2,
  Loader2, LayoutGrid, List, SlidersHorizontal, FolderOpen,
  Clock, CheckCircle2, AlertCircle, Zap, Plus, Rocket, Brain,
  DollarSign, TrendingUp, TrendingDown, AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"
import { StateBadge } from "@/components/state-badge"
import { ProjectThumbnail } from "@/components/project-thumbnail"
import { deleteJson } from "@/lib/client/api"
import { cn } from "@/lib/utils"
import { type ProjectState, type ProjectSummary } from "@/lib/types/project"
import type { FinanceTotals } from "@/lib/finances/project-finances"
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnrichedProject extends ProjectSummary {
  financialSummary?: {
    earningsMinor: number | null
    creditsCharged: number
    providerCostUsd: number | null
    currency: string | null
    hasFinancialData: boolean
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function formatMoney(minor: number | null, currency: string | null): string {
  if (minor === null) return "No data"
  const major = minor / 100
  const formatted = major.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
  return currency ? `${currency} ${formatted}` : `$${formatted}`
}

function modeLabel(mode: string): string {
  if (mode === "website") return "Reference build"
  if (mode === "github") return "GitHub build"
  return "Idea build"
}

function ModeIcon({ mode, className }: { mode: string; className?: string }) {
  if (mode === "website") return <Globe2 className={className} />
  if (mode === "github") return <GitBranch className={className} />
  return <Lightbulb className={className} />
}

// ─── Business-oriented navigation ─────────────────────────────────────────────

type BusinessTab = "all" | "in-progress" | "live" | "needs-attention" | "archived"

const BUSINESS_TABS: {
  id: BusinessTab
  label: string
  icon: React.ElementType
  matches: (p: EnrichedProject) => boolean
}[] = [
  { id: "all", label: "All", icon: FolderOpen, matches: () => true },
  {
    id: "in-progress",
    label: "In progress",
    icon: Zap,
    matches: (p) =>
      ["created", "analyzing", "analysis_complete", "specification_ready", "plan_ready", "awaiting_build_confirmation", "pending_plan", "building", "build_complete", "deploying"].includes(p.state),
  },
  {
    id: "live",
    label: "Live",
    icon: CheckCircle2,
    matches: (p) => ["ready", "deployed"].includes(p.state),
  },
  {
    id: "needs-attention",
    label: "Needs attention",
    icon: AlertTriangle,
    matches: (p) =>
      p.state === "plan_ready" || // Plan ready for review
      p.state === "analysis_failed" ||
      p.state === "plan_failed" ||
      p.state === "build_failed" ||
      p.state === "deployment_failed",
  },
  {
    id: "archived",
    label: "Archived",
    icon: FolderOpen,
    matches: () => false, // No archived state yet; placeholder for future
  },
]

type SortKey = "updatedAt" | "name" | "revenue" | "profit"

// ─── Delete dialog ────────────────────────────────────────────────────────────

function DeleteDialog({
  project,
  open,
  onOpenChange,
  onDeleted,
}: {
  project: EnrichedProject | null
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
      toast.success("Business deleted")
      onOpenChange(false)
      onDeleted()
    } catch (e) {
      toast.error((e as Error).message || "Failed to delete business")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this business?</AlertDialogTitle>
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
            {deleting ? <Loader2 className="size-3.5 animate-spin" /> : "Delete business"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ─── Portfolio overview cards ─────────────────────────────────────────────────

function PortfolioOverview({
  totals,
  projectCount,
}: {
  totals: FinanceTotals | null
  projectCount: number
}) {
  const revenue = totals?.earningsMinor
  const credits = totals?.creditsCharged ?? 0
  const providerCost = totals?.providerCostUsd
  const netProfit = revenue !== null && revenue !== undefined && providerCost !== null && providerCost !== undefined
    ? revenue / 100 - providerCost
    : null
  const needsAttention = 0 // Will be computed from projects

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Total businesses</p>
          <FolderOpen className="size-4 text-muted-foreground" />
        </div>
        <p className="mt-2 text-2xl font-semibold tracking-tight">{projectCount}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {projectCount === 1 ? "1 business in your portfolio" : `${projectCount} businesses in your portfolio`}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Revenue</p>
          <DollarSign className="size-4 text-muted-foreground" />
        </div>
        <p className="mt-2 text-2xl font-semibold tracking-tight">
          {revenue !== null && revenue !== undefined ? formatMoney(revenue, totals?.currencies[0] ?? null) : "No data"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {revenue !== null ? "Attributed earnings" : "Financial data not available yet"}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Net profit</p>
          {netProfit !== null && netProfit >= 0 ? (
            <TrendingUp className="size-4 text-emerald-600 dark:text-emerald-400" />
          ) : netProfit !== null && netProfit < 0 ? (
            <TrendingDown className="size-4 text-destructive" />
          ) : (
            <AlertCircle className="size-4 text-muted-foreground" />
          )}
        </div>
        <p className="mt-2 text-2xl font-semibold tracking-tight">
          {netProfit !== null ? formatMoney(netProfit, totals?.currencies[0] ?? null) : "No data"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {netProfit !== null ? "Revenue minus expenses" : "Financial data not available yet"}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Needs attention</p>
          <AlertTriangle className="size-4 text-muted-foreground" />
        </div>
        <p className="mt-2 text-2xl font-semibold tracking-tight">{needsAttention}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Businesses requiring your action
        </p>
      </div>
    </div>
  )
}

// ─── Grid card ────────────────────────────────────────────────────────────────

function BusinessCard({
  project,
  onDeleteRequest,
}: {
  project: EnrichedProject
  onDeleteRequest: (p: EnrichedProject) => void
}) {
  const hasThumbnail = Boolean(project.thumbnailUrl)
  const isPlanReady = project.state === "plan_ready"
  const finance = project.financialSummary

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      {/* Delete trigger */}
      <button
        aria-label="Delete business"
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

          {/* Financial summary */}
          {finance?.hasFinancialData && (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Revenue</span>
                <span className="font-medium text-foreground">
                  {finance.earningsMinor !== null
                    ? formatMoney(finance.earningsMinor, finance.currency)
                    : "No data"}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Credits</span>
                <span className="font-medium text-foreground">
                  {finance.creditsCharged.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {!finance?.hasFinancialData && (
            <div className="rounded-lg border border-dashed border-border px-3 py-2">
              <p className="text-xs text-muted-foreground">No financial data yet</p>
            </div>
          )}

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

// ─── List row ─────────────────────────────────────────────────────────────────

function BusinessRow({
  project,
  onDeleteRequest,
}: {
  project: EnrichedProject
  onDeleteRequest: (p: EnrichedProject) => void
}) {
  const isPlanReady = project.state === "plan_ready"
  const href = isPlanReady ? `/project/${project.id}/collaborate` : `/project/${project.id}`
  const finance = project.financialSummary

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

      {/* Financial summary */}
      <div className="hidden shrink-0 text-right md:block">
        {finance?.hasFinancialData ? (
          <div>
            <p className="text-xs font-medium text-foreground">
              {finance.earningsMinor !== null
                ? formatMoney(finance.earningsMinor, finance.currency)
                : "No data"}
            </p>
            <p className="text-[10px] text-muted-foreground">Revenue</p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No data</p>
        )}
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
          aria-label="Open business"
        >
          <ArrowRight className="size-3.5" />
        </Link>
        <button
          aria-label="Delete business"
          onClick={() => onDeleteRequest(project)}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Main workspace ───────────────────────────────────────────────────────────

export function ProjectsWorkspace({
  projects,
  portfolioTotals,
}: {
  projects: EnrichedProject[]
  portfolioTotals: FinanceTotals | null
}) {
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<BusinessTab>("all")
  const [sort, setSort] = useState<SortKey>("updatedAt")
  const [view, setView] = useState<"grid" | "list">("grid")
  const [deleteTarget, setDeleteTarget] = useState<EnrichedProject | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  function requestDelete(p: EnrichedProject) {
    setDeleteTarget(p)
    setDeleteOpen(true)
  }

  const displayed = useMemo(() => {
    let result = [...projects]
    const tabDef = BUSINESS_TABS.find((t) => t.id === tab)
    if (tabDef) result = result.filter(tabDef.matches)
    const q = search.trim().toLowerCase()
    if (q) result = result.filter((p) => p.name.toLowerCase().includes(q) || (p.sourceUrl && String(p.sourceUrl).toLowerCase().includes(q)))
    result.sort((a, b) => {
      if (sort === "updatedAt") return b.updatedAt - a.updatedAt
      if (sort === "name") return a.name.localeCompare(b.name)
      if (sort === "revenue") {
        const aRev = a.financialSummary?.earningsMinor ?? -1
        const bRev = b.financialSummary?.earningsMinor ?? -1
        return bRev - aRev
      }
      if (sort === "profit") {
        const aProfit = a.financialSummary && a.financialSummary.earningsMinor !== null
          ? a.financialSummary.earningsMinor / 100 - (a.financialSummary.providerCostUsd ?? 0)
          : -Infinity
        const bProfit = b.financialSummary && b.financialSummary.earningsMinor !== null
          ? b.financialSummary.earningsMinor / 100 - (b.financialSummary.providerCostUsd ?? 0)
          : -Infinity
        return bProfit - aProfit
      }
      return 0
    })
    return result
  }, [projects, tab, search, sort])

  const tabCounts = useMemo(() => {
    const counts: Record<BusinessTab, number> = {
      all: 0,
      "in-progress": 0,
      live: 0,
      "needs-attention": 0,
      archived: 0,
    }
    projects.forEach((p) => {
      counts.all++
      for (const t of BUSINESS_TABS) {
        if (t.id !== "all" && t.matches(p)) counts[t.id]++
      }
    })
    return counts
  }, [projects])

  return (
    <>
      {/* ── Page header ── */}
      <div className="mb-8 flex flex-col gap-5 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/dashboard"
            className="mb-3 inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-3" /> Dashboard
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Your businesses</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your businesses, track performance, and decide what to do next — all in one place.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/new/idea"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-accent hover:text-foreground"
          >
            <Lightbulb className="size-4" /> Explore projects
          </Link>
          <Link
            href="/new"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="size-4" /> New business
          </Link>
        </div>
      </div>

      {/* ── Portfolio overview ── */}
      <div className="mb-8">
        <PortfolioOverview totals={portfolioTotals} projectCount={projects.length} />
      </div>

      {/* ── Business navigation ── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {BUSINESS_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                tab === id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {label}
              {tabCounts[id] > 0 && (
                <span className={cn(
                  "ml-0.5 rounded-full px-1.5 py-0.5 font-mono text-[9px] tabular-nums",
                  tab === id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground",
                )}>
                  {tabCounts[id]}
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
              placeholder="Search businesses…"
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
              <option value="revenue">Revenue</option>
              <option value="profit">Profit</option>
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
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center gap-5 rounded-2xl border border-dashed border-border bg-card/40 py-24 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <Rocket className="size-7 text-muted-foreground" />
          </div>
          {projects.length === 0 ? (
            <>
              <div>
                <p className="text-lg font-bold text-foreground">Your next business starts here</p>
                <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
                  Turn an idea into a business with Atai. Describe what you want to build, start from a website, or bring an existing codebase.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  href="/new/idea"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <Lightbulb className="size-4" /> Start a business
                </Link>
                <Link
                  href="/new/website"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-accent"
                >
                  <Globe2 className="size-4" /> From a website
                </Link>
                <Link
                  href="/new/github"
                  className="inline-flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/5 px-5 py-2.5 text-sm font-medium text-purple-600 hover:bg-purple-500/10 dark:text-purple-400"
                >
                  <GitBranch className="size-4" /> From GitHub
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
                onClick={() => { setSearch(""); setTab("all") }}
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
            <BusinessCard key={p.id} project={p} onDeleteRequest={requestDelete} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="hidden grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 pb-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground sm:grid">
            <span>Business</span>
            <span>Revenue</span>
            <span>Status</span>
            <span>Updated</span>
            <span />
          </div>
          {displayed.map((p) => (
            <BusinessRow key={p.id} project={p} onDeleteRequest={requestDelete} />
          ))}
        </div>
      )}

      {/* ── Stats footer ── */}
      {projects.length > 0 && (
        <div className="mt-10 flex flex-wrap items-center gap-6 border-t border-border pt-6 text-xs text-muted-foreground">
          {BUSINESS_TABS.filter((t) => t.id !== "all").map(({ id, label, icon: Icon }) => (
            tabCounts[id] > 0 && (
              <div key={id} className="flex items-center gap-1.5">
                <Icon className="size-3.5" />
                <span>{tabCounts[id]} {label.toLowerCase()}</span>
              </div>
            )
          ))}
          <div className="flex items-center gap-1.5 ml-auto">
            <FolderOpen className="size-3.5" />
            <span>{projects.length} total business{projects.length !== 1 ? "es" : ""}</span>
          </div>
        </div>
      )}

      <DeleteDialog
        project={deleteTarget}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => window.location.reload()} // Simple refresh; could be improved with SWR
      />
    </>
  )
}
