"use client"

import { useEffect, useState, useCallback } from "react"
import useSWR from "swr"
import { cn, ensureProtocol } from "@/lib/utils"
import { ProjectStepper } from "@/components/project-stepper"
import { ProjectWorkspaceControls } from "@/components/project-workspace-controls"
import { ProjectActivity } from "@/components/project-activity"
import { ProjectAssets } from "@/components/project-assets"
import { BuildLoading } from "@/components/build-loading"
import { PublishMenu } from "@/components/publish-menu"
import { DeploymentHistory } from "@/components/deployment-history"
import Markdown from "react-markdown"
import type { Project, ProjectState } from "@/lib/types/project"

const jsonFetcher = (url: string) =>
  fetch(url, { headers: { accept: "application/json" } }).then((r) => r.json())

interface ProjectResponse {
  ok: boolean
  data: { project: Project }
}

/** Shape from GET /api/projects/[id]/status — includes full project during builds. */
interface StatusResponse {
  ok: boolean
  data: {
    state: string
    progress?: number | null
    agentStatus?: string | null
    developmentUrl?: string
    events?: Array<{ id: string; at: number; level: string; stage: string; message: string }>
    project?: {
      id: string
      name: string
      mode: string
      state: string
      sourceUrl?: string
      understanding?: Project["understanding"]
      specification?: Project["specification"]
      conversation?: Project["conversation"]
      deploymentHistory?: Project["deploymentHistory"]
      totalumProjectId?: string
      buildSummary?: Project["buildSummary"]
    }
  }
}

interface ProjectWorkspaceProps {
  projectId: string
  /** Initial state from SSR so the first render is instant. */
  initialState: ProjectState
}

/**
 * Client wrapper that polls the project endpoint to keep the stepper,
 * state badge, and build/controls conditional in sync as the backend
 * progresses through analysis → build → deploy.
 *
 * During active builds, polls /status instead — that endpoint triggers
 * server-side Totalum sync (state transitions, credit reconciliation)
 * on every poll, so the UI reflects real progress immediately.
 */
export function ProjectWorkspace({ projectId, initialState }: ProjectWorkspaceProps) {
  // Always poll the project endpoint (for full data: screenshots, understanding, etc.)
  const { data: projectData, mutate: refreshProject } = useSWR<ProjectResponse>(
    `/api/projects/${projectId}`,
    jsonFetcher,
    {
      refreshInterval: (latest) => {
        const s = latest?.data?.project?.state ?? initialState
        if (s === "deploying" || s === "building" || s === "analyzing") return 5000
        return 15000
      },
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  )

  // Determine if we should poll /status based on the project endpoint data
  // (or initial SSR state). This controls whether the /status SWR is active.
  const projectState = (projectData?.data?.project?.state ?? initialState) as ProjectState
  const shouldPollStatus = projectState === "building" || projectState === "analyzing" || projectState === "deploying"

  // During active builds: poll /status (triggers Totalum sync server-side).
  // This is what actually advances state (building→ready, build_failed) and
  // reconciles credits — polling /projects alone just reads stale MongoDB data.
  const { data: statusData } = useSWR<StatusResponse>(
    shouldPollStatus ? `/api/projects/${projectId}/status` : null,
    jsonFetcher,
    {
      refreshInterval: 3000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      keepPreviousData: true,
    },
  )

  // When /status reports a terminal state (ready/failed), the response now
  // includes full project data. Merge it into the SWR cache so the UI has
  // the full picture (developmentUrl, conversation, deploymentHistory, etc.)
  // immediately, then revalidate to pick up any fields not in the status response.
  useEffect(() => {
    const terminalState = statusData?.data?.state
    if ((terminalState === "ready" || terminalState === "build_failed") && statusData?.data?.project) {
      refreshProject(
        { ok: true, data: { project: statusData.data.project as Project } },
        { revalidate: true },
      )
    }
  }, [statusData?.data?.state, statusData?.data?.project, refreshProject])

  // Backfill buildSummary for projects built before this field existed.
  // Makes a one-time /status call which triggers the server-side backfill,
  // then the project SWR revalidation picks up the persisted value.
  useEffect(() => {
    const s = projectData?.data?.project?.state ?? initialState
    if (
      (s === "ready" || s === "build_complete") &&
      projectData?.data?.project?.totalumProjectId &&
      !projectData?.data?.project?.buildSummary
    ) {
      fetch(`/api/projects/${projectId}/status`, { headers: { accept: "application/json" } })
        .then((r) => r.json())
        .then((res) => {
          if (res?.data?.project?.buildSummary) {
            // Merge into the project SWR cache
            refreshProject(
              { ok: true, data: { project: { ...projectData!.data.project, buildSummary: res.data.project.buildSummary } } },
              { revalidate: true },
            )
          }
        })
        .catch(() => {})
    }
  }, [projectData?.data?.project?.state, projectData?.data?.project?.buildSummary])

  // The displayed state: prefer the live Totalum-synced state from /status,
  // fall back to the project endpoint data (which may be stale during builds).
  const state = (statusData?.data?.state ?? projectState) as ProjectState
  // Project data: prefer project endpoint (full data); /status may have a subset.
  const project = projectData?.data?.project ?? null

  return (
    <div className="grid gap-6 lg:grid-cols-[0.65fr_1.35fr] lg:items-start">
      {/* Left rail — sticky stepper */}
      <aside className="flex flex-col gap-6 lg:sticky lg:top-24">
        <div className="border border-border bg-card p-5">
          <p className="px-1 pb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Progress
          </p>
          <ProjectStepper state={state} />
        </div>
        <p className="px-1 text-xs leading-relaxed text-muted-foreground">
          More workspace tools — a full editor, custom data sources, and team settings — are on the way.
        </p>
      </aside>

      {/* Right content */}
      <section className="flex flex-col gap-6">
        {/* Hero screenshot — only show if understanding has screenshots */}
        {project?.understanding?.screenshots?.[0] ? (
          <div className="overflow-hidden border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-4 py-2.5">
              <span className="flex gap-1.5" aria-hidden>
                <span className="size-2.5 rounded-full bg-destructive/50" />
                <span className="size-2.5 rounded-full bg-primary/50" />
                <span className="size-2.5 rounded-full bg-success/50" />
              </span>
              <span className="ml-2 flex-1 truncate rounded-sm bg-background/70 px-3 py-1 font-mono text-[11px] text-muted-foreground">
                {project?.sourceUrl ?? "source preview"}
              </span>
              {project?.sourceUrl ? (
                <a
                  href={project.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 font-mono text-[11px] text-primary hover:underline"
                >
                  Visit ↗
                </a>
              ) : null}
            </div>
            <a
              href={project.understanding.screenshots[0]}
              target="_blank"
              rel="noreferrer"
              className="block bg-muted"
            >
              <img
                src={project.understanding.screenshots[0]}
                alt={`Screenshot of ${project?.sourceUrl ?? project?.name}`}
                className="max-h-[520px] w-full object-cover object-top"
              />
            </a>
          </div>
        ) : null}

        {/* Sanitization warning */}
        {project?.specSanitized ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">⚠️ Plan auto-adjusted for supported stack</p>
            <p className="mt-1 text-xs text-amber-600/80 dark:text-amber-400/80">
              Some technologies in the original plan (e.g. PostgreSQL, Prisma) were automatically replaced with Totalum SDK equivalents. You can edit the plan below to adjust.
            </p>
          </div>
        ) : null}

        {/* What we know */}
        <div className="border border-border bg-card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              What we know
            </p>
            <div className="flex gap-4 font-mono text-[11px] text-muted-foreground">
              <span className="capitalize">{project?.mode ?? "website"} mode</span>
              <span>{project?.events?.length ?? 0} events</span>
              <span>{project?.conversation?.length ?? 0} messages</span>
            </div>
          </div>
          <h2 className="mt-3 text-2xl font-medium text-balance">
            {project?.understanding?.purpose ?? "Analysis is preparing the project context."}
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
            This workspace reflects the persisted project state. As analysis completes, its understanding,
            specification, events, and build result will appear here.
          </p>
        </div>

        {/* Build loading — driven by live state */}
        {state === "building" || state === "deploying" ? (
          <BuildLoading projectId={projectId} state={state} />
        ) : null}

        {/* Live URL — prominent banner when deployed to production */}
        {project?.deploymentHistory?.some(d => d.status === "success") && project.deploymentHistory.filter(d => d.status === "success").slice(-1)[0]?.productionUrl ? (
          <div className="overflow-hidden rounded-xl border border-green-500/30 bg-green-500/5 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-green-600 dark:text-green-400">
                  🚀 Your app is live
                </p>
                <a
                  href={ensureProtocol(project.deploymentHistory.filter(d => d.status === "success").slice(-1)[0]!.productionUrl!)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-2 text-lg font-medium text-green-600 hover:underline dark:text-green-400"
                >
                  {ensureProtocol(project.deploymentHistory.filter(d => d.status === "success").slice(-1)[0]!.productionUrl!)}
                  <span className="text-sm">↗</span>
                </a>
              </div>
              <a
                href={ensureProtocol(project.deploymentHistory.filter(d => d.status === "success").slice(-1)[0]!.productionUrl!)}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
              >
                Open live site ↗
              </a>
            </div>
          </div>
        ) : null}

        {/* Development preview — show the built app when ready */}
        {project?.developmentUrl ? (
          <DevPreview url={project.developmentUrl} name={project.name} />
        ) : null}

        {/* Build summary — AI's important post-build instructions */}
        {project?.buildSummary ? (
          <BuildSummaryCard summary={project.buildSummary} />
        ) : null}

        {/* Publish controls — shown when build is ready */}
        {(state === "ready" || state === "build_complete") && project?.totalumProjectId ? (
          <div className="border border-border bg-card p-6">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Publish
            </p>
            <div className="mt-5">
              <PublishMenu
                projectId={projectId}
                projectName={project.name}
                totalumProjectId={project.totalumProjectId}
                onDeployed={() => refreshProject(undefined, { revalidate: true })}
              />
            </div>
          </div>
        ) : null}

        {/* Deployment history — shown after publish section */}
        {(state === "ready" || state === "build_complete" || state === "deployed" || state === "deploying") && project?.deploymentHistory && project.deploymentHistory.length > 0 ? (
          <div className="border border-border bg-card p-6">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Deployment history
            </p>
            <div className="mt-5">
              <DeploymentHistory projectId={projectId} />
            </div>
          </div>
        ) : null}

        {/* Workspace controls — always shown when not building */}
        {state !== "building" && state !== "deploying" ? (
          <div className="border border-border bg-card p-6">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Workspace controls
            </p>
            <div className="mt-5">
              <ProjectWorkspaceControls projectId={projectId} />
            </div>
          </div>
        ) : null}

        {/* Activity + Assets */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="border border-border bg-card p-6">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Activity
            </p>
            <div className="mt-5">
              <ProjectActivity projectId={projectId} />
            </div>
          </div>
          <div className="border border-border bg-card p-6">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Captured assets
            </p>
            <div className="mt-5">
              <ProjectAssets projectId={projectId} />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

type Viewport = "desktop" | "tablet" | "mobile"

const VIEWPORTS: Record<Viewport, { width: string; defaultHeight: number; label: string; icon: string }> = {
  desktop: { width: "100%", defaultHeight: 600, label: "Desktop", icon: "🖥" },
  tablet: { width: "768px", defaultHeight: 600, label: "Tablet", icon: "📱" },
  mobile: { width: "375px", defaultHeight: 667, label: "Mobile", icon: "📲" },
}

const MIN_HEIGHT = 200
const MAX_HEIGHT = 1200

function DevPreview({ url, name }: { url: string; name: string }) {
  const safeUrl = ensureProtocol(url)
  const [viewport, setViewport] = useState<Viewport>("desktop")
  const [height, setHeight] = useState(VIEWPORTS.desktop.defaultHeight)
  const [isDragging, setIsDragging] = useState(false)

  const vp = VIEWPORTS[viewport]

  // When switching viewport, reset height to that viewport's default.
  const handleViewportChange = (v: Viewport) => {
    setViewport(v)
    setHeight(VIEWPORTS[v].defaultHeight)
  }

  // Drag-to-resize handlers.
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setIsDragging(true)
    const startY = "touches" in e ? e.touches[0].clientY : e.clientY
    const startHeight = height

    const onMove = (ev: MouseEvent | TouchEvent) => {
      const currentY = "touches" in ev ? ev.touches[0].clientY : ev.clientY
      const delta = currentY - startY
      const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeight + delta))
      setHeight(newHeight)
    }

    const onEnd = () => {
      setIsDragging(false)
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onEnd)
      document.removeEventListener("touchmove", onMove)
      document.removeEventListener("touchend", onEnd)
    }

    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onEnd)
    document.addEventListener("touchmove", onMove, { passive: false })
    document.addEventListener("touchend", onEnd)
  }

  return (
    <div className="overflow-hidden border border-border bg-card">
      {/* Browser chrome + viewport toggles */}
      <div className="flex items-center justify-between border-b border-border bg-muted/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-destructive/50" />
            <span className="size-2.5 rounded-full bg-primary/50" />
            <span className="size-2.5 rounded-full bg-success/50" />
          </span>              <span className="ml-2 truncate rounded-sm bg-background/70 px-3 py-1 font-mono text-[11px] text-muted-foreground">
            {safeUrl}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(['desktop', 'tablet', 'mobile'] as Viewport[]).map((v) => (
            <button
              key={v}
              onClick={() => handleViewportChange(v)}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                viewport === v
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title={VIEWPORTS[v].label}
            >
              <span className="text-xs">{VIEWPORTS[v].icon}</span>
              <span className="hidden sm:inline">{VIEWPORTS[v].label}</span>
            </button>
          ))}
          <span className="mx-1.5 h-4 w-px bg-border" />
          <a
            href={safeUrl}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[11px] text-primary hover:underline"
          >
            Open ↗
          </a>
        </div>
      </div>

      {/* Iframe container — centers and constrains for tablet/mobile */}
      <div className="flex justify-center bg-muted/30">
        <div
          className="transition-[width] duration-300 ease-in-out overflow-hidden bg-background"
          style={{
            width: vp.width,
            maxWidth: "100%",
          }}
        >
          <iframe
            src={safeUrl}
            title={`${name} preview`}
            className="w-full border-0 bg-background"
            style={{ height: `${height}px` }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      </div>

      {/* Drag-to-resize handle */}
      <div
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        className={cn(
          "group flex cursor-row-resize items-center justify-center border-t border-border bg-muted/60 py-2 transition-colors select-none",
          isDragging ? "bg-primary/10" : "hover:bg-primary/5",
        )}
      >
        <div className="flex items-center gap-2">
          {/* Grip dots */}
          <svg width="16" height="8" viewBox="0 0 16 8" className="text-muted-foreground group-hover:text-foreground transition-colors">
            <circle cx="4" cy="2" r="1.2" fill="currentColor" />
            <circle cx="8" cy="2" r="1.2" fill="currentColor" />
            <circle cx="12" cy="2" r="1.2" fill="currentColor" />
            <circle cx="4" cy="6" r="1.2" fill="currentColor" />
            <circle cx="8" cy="6" r="1.2" fill="currentColor" />
            <circle cx="12" cy="6" r="1.2" fill="currentColor" />
          </svg>
          <span className="font-mono text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">
            {height}px
          </span>
        </div>
      </div>
    </div>
  )
}

/** Displays the AI agent's post-build summary — critical info like
 * login credentials, what's included, and next steps. This data comes
 * from Totalum's realtimeConversation "finished" messages.
 * Renders markdown with styled components for a polished reading experience. */
function BuildSummaryCard({ summary }: { summary: NonNullable<Project["buildSummary"]> }) {
  const [expanded, setExpanded] = useState(true)
  const hasSecrets = summary.secretKeysNeeded && Object.keys(summary.secretKeysNeeded).length > 0

  return (
    <div className="overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-background to-background">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-amber-500/10"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-lg shadow-sm">
            📋
          </span>
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              Important — Your app is ready
            </p>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70">
              Read this carefully — it includes credentials and setup info
            </p>
          </div>
        </div>
        <svg
          className={cn(
            "size-4 shrink-0 text-amber-600/70 transition-transform duration-200",
            expanded && "rotate-180",
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content */}
      {expanded ? (
        <div className="border-t border-amber-500/20 px-5 py-5">
          {/* Secret keys needed warning */}
          {hasSecrets ? (
            <div className="mb-5 overflow-hidden rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-red-500/5 p-5 dark:border-red-800 dark:from-red-950/50 dark:to-red-950/20">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-sm">
                  🔑
                </span>
                <div>
                  <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                    API keys needed
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-red-600/80 dark:text-red-400/80">
                    The following secrets are required for full functionality. Add them via
                    <span className="font-medium"> Workspace controls → Secrets</span>.
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {Object.entries(summary.secretKeysNeeded!).map(([key, info]) => (
                      <li key={key} className="flex items-center gap-2.5 rounded-lg bg-white/50 px-3 py-1.5 text-xs dark:bg-white/5">
                        <span className={cn(
                          "size-2 shrink-0 rounded-full",
                          info.isProvided ? "bg-green-500" : "bg-red-500",
                        )} />
                        <code className="font-mono font-medium text-red-700 dark:text-red-300">{key}</code>
                        {!info.isProvided && info.description ? (
                          <span className="text-red-500/60 dark:text-red-400/60">— {info.description}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          {/* Main message — full markdown rendering */}
          <div className="markdown-body prose prose-sm prose-amber max-w-none dark:prose-invert
            prose-headings:mt-6 prose-headings:mb-3 prose-headings:font-semibold prose-headings:text-foreground
            prose-h1:text-xl prose-h1:mt-0 prose-h1:mb-4 prose-h1:pb-3 prose-h1:border-b prose-h1:border-border
            prose-h2:text-lg prose-h2:text-amber-800 dark:prose-h2:text-amber-200
            prose-h3:text-base prose-h3:text-amber-700 dark:prose-h3:text-amber-300
            prose-p:leading-relaxed prose-p:text-muted-foreground
            prose-strong:text-foreground prose-strong:font-semibold
            prose-em:text-amber-700 dark:prose-em:text-amber-300
            prose-a:text-amber-600 prose-a:no-underline hover:prose-a:underline dark:prose-a:text-amber-400
            prose-code:text-amber-700 prose-code:bg-amber-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-code:font-medium prose-code:before:content-none prose-code:after:content-none
            dark:prose-code:text-amber-300 dark:prose-code:bg-amber-500/15
            prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-xl
            prose-li:text-muted-foreground
            prose-li:marker:text-amber-500/60
            prose-li::marker
            prose-blockquote:border-l-amber-500/40 prose-blockquote:bg-amber-500/5 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:pr-4 prose-blockquote:text-muted-foreground
            prose-table:text-sm
            prose-th:text-foreground prose-th:font-semibold
            prose-td:text-muted-foreground
          ">
            <Markdown
              components={{
                /* Override ul/li to add amber-tinted bullet styling */
                ul: ({ children, ...props }) => (
                  <ul className="my-3 space-y-2 pl-1" {...props}>{children}</ul>
                ),
                li: ({ children, ...props }) => (
                  <li className="flex gap-2.5 leading-relaxed" {...props}>
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-500/50" />
                    <span>{children}</span>
                  </li>
                ),
                /* Note / warning blocks */
                blockquote: ({ children, ...props }) => (
                  <blockquote
                    className="my-4 rounded-r-xl border-l-4 border-amber-500/40 bg-amber-500/5 py-3 pr-4 pl-5 text-sm italic text-muted-foreground"
                    {...props}
                  >
                    {children}
                  </blockquote>
                ),
                /* Inline code gets a distinct credential/code look */
                code: ({ className: cls, children, ...props }) => {
                  const isInline = !cls?.includes("language-")
                  if (isInline) {
                    return (
                      <code
                        className="rounded-md border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[13px] font-medium text-amber-700 dark:text-amber-300"
                        {...props}
                      >
                        {children}
                      </code>
                    )
                  }
                  return (
                    <code className={cls} {...props}>{children}</code>
                  )
                },
                /* Code blocks with copy-friendly look */
                pre: ({ children, ...props }) => (
                  <pre
                    className="my-4 overflow-x-auto rounded-xl border border-border bg-muted/50 p-4 font-mono text-[13px] leading-relaxed"
                    {...props}
                  >
                    {children}
                  </pre>
                ),
                /* Bold text gets a subtle highlight */
                strong: ({ children, ...props }) => (
                  <strong className="font-semibold text-foreground" {...props}>{children}</strong>
                ),
                /* Links styled to match the amber theme */
                a: ({ href, children, ...props }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-600 underline decoration-amber-500/30 decoration-1 underline-offset-2 transition-colors hover:text-amber-700 hover:decoration-amber-500/60 dark:text-amber-400"
                    {...props}
                  >
                    {children}
                  </a>
                ),
                /* Horizontal rules */
                hr: (props) => (
                  <hr className="my-6 border-amber-500/20" {...props} />
                ),
                /* Tables */
                table: ({ children, ...props }) => (
                  <div className="my-4 overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-sm" {...props}>{children}</table>
                  </div>
                ),
                th: ({ children, ...props }) => (
                  <th className="border-b border-border bg-muted/50 px-4 py-2.5 text-left font-semibold text-foreground" {...props}>{children}</th>
                ),
                td: ({ children, ...props }) => (
                  <td className="border-b border-border/50 px-4 py-2.5 text-muted-foreground last:border-b-0" {...props}>{children}</td>
                ),
              }}
            >
              {summary.message}
            </Markdown>
          </div>

          {/* Version info */}
          {summary.versionId ? (
            <div className="mt-5 flex items-center gap-3 border-t border-amber-500/10 pt-4">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 font-mono text-[11px] text-muted-foreground">
                <span className="size-1.5 rounded-full bg-green-500" />
                Version {summary.versionId}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
