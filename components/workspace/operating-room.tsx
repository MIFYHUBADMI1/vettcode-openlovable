"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronRight,
  ExternalLink,
  Hammer,
  MessagesSquare,
  Rocket,
} from "lucide-react"
import { toast } from "sonner"
import { useProject, useProjectStatus, postJson, useSession } from "@/lib/client/api"
import { useBuildCosts } from "@/lib/client/build-costs"
import { PublishMenu } from "@/components/publish-menu"
import { DeploymentHistory } from "@/components/deployment-history"
import {
  buildJourneySteps,
  buildWorkspaceView,
  planIsReviewable,
  workspaceIsLive,
  type WorkspaceMutation,
} from "@/lib/workspace/workspace-view-model"
import { TEAM_ROLE_META, roleForStage } from "@/lib/workspace/team-roles"
import type { ProjectState } from "@/lib/types/project"
import { ensureProtocol, cn } from "@/lib/utils"
import { ProductPreview, ReferenceSitePreview } from "@/components/workspace/product-preview"
import { TeamHandoff } from "@/components/workspace/team-handoff"
import { ProjectIdDialog } from "@/components/project-id-dialog"
import { BuildStageOverlay } from "@/components/workspace/build-stage-overlay"

const FAILED_STATES: ReadonlySet<ProjectState> = new Set([
  "analysis_failed",
  "plan_failed",
  "build_failed",
  "deployment_failed",
])

function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`
}

const MUTATION_MESSAGE: Record<WorkspaceMutation, string> = {
  build: "Engineering has started building.",
  deploy: "Launch started.",
  retry_analysis: "Understanding is retrying.",
  retry_plan: "Planning is retrying.",
  retry_build: "Build retry started.",
  retry_launch: "Launch retry started.",
}

export function ProjectWorkspace({ projectId, initialState }: { projectId: string; initialState: ProjectState }) {
  const router = useRouter()
  const { project: fetched, refresh } = useProject(projectId, { pollWhileBuilding: true })
  const projectState = (fetched?.state ?? initialState) as ProjectState
  const active = workspaceIsLive(projectState)
  const events = fetched?.events ?? []
  const { statusData, refresh: refreshStatus } = useProjectStatus(projectId, active)
  const { refresh: refreshSession } = useSession()
  const { buildCost, tierLabel } = useBuildCosts()
  const [busy, setBusy] = useState(false)
  const [projectIdDialogOpen, setProjectIdDialogOpen] = useState(false)
  const [pendingBuildMutation, setPendingBuildMutation] = useState<"build" | "retry_build">("build")
  const [buildOverlayOpen, setBuildOverlayOpen] = useState(false)

  const project = fetched
  const state = ((statusData as { state?: ProjectState } | undefined)?.state ?? projectState) as ProjectState
  const view = useMemo(() => (project ? buildWorkspaceView({ ...project, state }) : null), [project, state])

  // Clock for "last activity" / stalled detection. Only ticks while a step can
  // actually be running or needs a restart.
  const [now, setNow] = useState(() => Date.now())
  const ticking = workspaceIsLive(state) || FAILED_STATES.has(state)
  useEffect(() => {
    if (!ticking) return
    const timer = setInterval(() => setNow(Date.now()), 10_000)
    return () => clearInterval(timer)
  }, [ticking])

  const steps = useMemo(
    () => (project ? buildJourneySteps({ ...project, state }, now) : []),
    [project, state, now],
  )

  // The activity feed promises "taking you to the Collaborate page now" —
  // honour it: when a plan finishes while the founder is watching, hand them
  // over. Fire once per project per tab so Back never loops.
  const planReady = state === "plan_ready" || state === "specification_ready"
  const planReviewable = project ? planIsReviewable(project) : false
  const wasWorkingRef = useRef(workspaceIsLive(initialState))
  const handedOverRef = useRef(false)
  useEffect(() => {
    if (!fetched) return
    if (workspaceIsLive(state)) wasWorkingRef.current = true
    if (!planReady || handedOverRef.current || !wasWorkingRef.current) return
    const key = `atai.plan-opened:${projectId}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, "1")
    } catch {
      // Storage blocked (private mode) — the in-page link below still works.
    }
    handedOverRef.current = true
    const timer = setTimeout(() => {
      toast.success("Your plan is ready — opening Collaborate.")
      router.push(`/project/${projectId}/collaborate`)
    }, 1200)
    return () => clearTimeout(timer)
  }, [planReady, state, projectId, fetched, router])

  // Auto-resume orphaned builds: when user returns to workspace page with a
  // build that's in "building" or "deploying" state, immediately trigger status
  // poll to check completion and resume polling. Fire once per project to avoid
  // duplicate triggers on re-renders.
  const autoResumeTriggeredRef = useRef<string | null>(null)
  useEffect(() => {
    if (!project?.totalumProjectId) return
    if (state !== "building" && state !== "deploying") return

    // Guard: fire only once per project
    const projectKey = `${projectId}-${project.totalumProjectId}`
    if (autoResumeTriggeredRef.current === projectKey) return
    autoResumeTriggeredRef.current = projectKey

    // Detect orphaned builds: statusData is null/undefined on mount for builds
    // where the user left the page and returned
    const isOrphanedBuild = !statusData

    if (isOrphanedBuild) {
      toast.info("Reconnecting to your build...")
    }

    // Trigger immediate status poll to resume monitoring
    void refreshStatus()
  }, [project?.totalumProjectId, state, projectId, statusData, refreshStatus])

  // A build started on the Collaborate page hands over here — honour the hand-off
  // by opening the stage room once, so the founder lands on live commentary.
  useEffect(() => {
    const key = `atai.watch-build:${projectId}`
    let flagged = false
    try {
      flagged = sessionStorage.getItem(key) === "1"
      if (flagged) sessionStorage.removeItem(key)
    } catch {
      // Storage blocked (private mode) — the inline build card still covers this.
    }
    if (flagged) setBuildOverlayOpen(true)
  }, [projectId])

  const stalledStep = steps.find((step) => step.stalled && step.action) ?? null

  const currentStepId =
    steps.find((step) => step.status === "at_work" || step.status === "getting_ready" || step.status === "needs_attention")?.id ??
    view?.phase

  async function performMutation(kind: WorkspaceMutation, requestedProjectId?: string) {
    setBusy(true)
    try {
      if ((kind === "build" || kind === "retry_build") && requestedProjectId) {
        await postJson(`/api/projects/${projectId}/build`, { requestedProjectId })
      } else if (kind === "build") {
        await postJson(`/api/projects/${projectId}/build`, {})
      } else if (kind === "deploy") {
        await postJson(`/api/projects/${projectId}/deploy`, {})
      } else {
        await postJson(`/api/projects/${projectId}/retry`, {})
      }
      toast.success(MUTATION_MESSAGE[kind])
      if (kind === "build" || kind === "retry_build") setBuildOverlayOpen(true)
      await Promise.all([refresh(), refreshSession(), refreshStatus()])
    } finally {
      setBusy(false)
    }
  }

  function runMutation(kind: WorkspaceMutation) {
    if ((kind === "build" || kind === "retry_build") && !project?.totalumProjectId) {
      setPendingBuildMutation(kind)
      setProjectIdDialogOpen(true)
      return
    }
    void performMutation(kind).catch((error) => {
      toast.error(error instanceof Error ? error.message : "Something went wrong")
    })
  }

  if (!project || !view) {
    return <p className="p-8 text-sm text-muted-foreground">Loading your workspace…</p>
  }

  const spec = project.specification
  const tier = spec?.complexity ?? "medium"
  const previewHref = view.previewUrl ? ensureProtocol(view.previewUrl) : null
  const productionHref = view.productionUrl ? ensureProtocol(view.productionUrl) : null
  const milestones = events.filter((e) => {
    if (/Fetch (GET|POST|PUT|DELETE|PATCH)/i.test(e.message)) return false
    if (/\/api\/v1\//i.test(e.message)) return false
    return true
  }).slice(-4).reverse()
  const next = view.next

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:py-8 lg:px-8">
      <ProjectIdDialog
        open={projectIdDialogOpen}
        onOpenChange={setProjectIdDialogOpen}
        projectName={project.name}
        initialProjectId={project.requestedProjectId}
        onConfirm={(requestedProjectId) => performMutation(pendingBuildMutation, requestedProjectId)}
      />
      <BuildStageOverlay
        projectId={projectId}
        projectName={project.name}
        projectPurpose={project.idea ?? project.specification?.description}
        sourceUrl={project.sourceUrl}
        open={buildOverlayOpen}
        onOpenChange={setBuildOverlayOpen}
        onRetry={() => {
          setBuildOverlayOpen(false)
          void runMutation("retry_build")
        }}
        onFinished={() => {
          void Promise.all([refresh(), refreshSession()])
          router.refresh()
        }}
      />
      <nav className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground">All Projects</Link>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-foreground">{project.name}</span>
      </nav>

      <section className={cn("rounded-2xl border p-5 sm:p-6", view.brief.live ? "border-primary/30 bg-primary/5" : "border-border bg-card")}>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Your Atai team</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-balance sm:text-2xl">{view.brief.headline}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{view.brief.support}</p>
        <ol className="mt-6 grid gap-3 sm:grid-cols-5">
          {steps.map((step, index) => {
            const here = step.id === currentStepId
            const done = step.status === "completed"
            return (
              <li key={step.id} className={cn("flex flex-col rounded-xl border px-3 py-3", here ? "border-primary/40 bg-background" : "border-border bg-background/60")}>
                <p className={cn("text-sm font-medium", here ? "text-foreground" : "text-muted-foreground")}>
                  {done ? "✓ " : `${index + 1}. `}{step.label}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{step.team}</p>
                <p className={cn(
                  "mt-2 text-[11px] font-medium",
                  step.status === "at_work" && "text-primary",
                  step.status === "completed" && "text-emerald-600 dark:text-emerald-400",
                  step.status === "needs_attention" && "text-destructive",
                  step.status === "getting_ready" && (step.stalled ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"),
                  step.status === "upcoming" && "text-muted-foreground",
                )}>
                  {step.status === "at_work" ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="relative flex size-1.5">
                        <span className="absolute inset-0 motion-safe:animate-ping rounded-full bg-primary/70" />
                        <span className="relative size-1.5 rounded-full bg-primary" />
                      </span>
                      {step.statusLabel}
                    </span>
                  ) : step.stalled ? "taking longer than expected" : step.statusLabel}
                </p>
                {step.detail ? (
                  <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground" title={step.detail}>
                    {step.detail}
                  </p>
                ) : null}
                {step.elapsedMs !== null && (step.status === "at_work" || step.status === "getting_ready") ? (
                  <p className={cn("mt-1 text-[10px]", step.stalled ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground/80")}>
                    {step.stalled ? "No activity for " : "Last update "}{formatElapsed(step.elapsedMs)}
                  </p>
                ) : null}
                {step.attempts !== null && step.attempts > 1 ? (
                  <p className="mt-1 text-[10px] text-muted-foreground/80">
                    Automatic retry {step.attempts - 1} of 1
                  </p>
                ) : null}
                {step.action ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runMutation(step.action!.mutation)}
                    className={cn(
                      "mt-2 self-start rounded-lg px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50",
                      step.status === "needs_attention"
                        ? "bg-destructive text-white hover:bg-destructive/90"
                        : "border border-border text-foreground hover:border-primary/40 hover:text-primary",
                    )}
                  >
                    {busy ? "Working…" : step.action.label}
                  </button>
                ) : null}
              </li>
            )
          })}
        </ol>
      </section>

      {stalledStep?.action ? (
        <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
          <p className="font-medium text-foreground">{stalledStep.label} is taking longer than expected.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {stalledStep.elapsedMs !== null ? `No new activity for ${formatElapsed(stalledStep.elapsedMs).replace(" ago", "")}. ` : ""}
            You can restart this step — work that already finished is kept.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runMutation(stalledStep.action!.mutation)}
            className="mt-3 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Working…" : stalledStep.action.label}
          </button>
        </section>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          {view.canPreview && previewHref ? (
            <section id="product-preview" className="scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between px-5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Your product</p>
                <a href={previewHref} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary hover:underline">Open in new tab</a>
              </div>
              <ProductPreview url={previewHref} name={project.name} />
              {(state === "ready" || state === "build_complete") && !project.understanding?.screenshots?.[0] ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      const res = await fetch(`/api/projects/${projectId}/capture-preview`, { method: "POST" })
                      const data = await res.json()
                      if (!res.ok || !data.data?.thumbnailUrl) {
                        toast.error(data.data?.message || data.message || "Could not capture a preview image yet")
                        return
                      }
                      toast.success("Preview image saved.")
                      await refresh()
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not capture preview")
                    } finally {
                      setBusy(false)
                    }
                  }}
                  className="px-5 py-3 text-xs font-medium text-primary hover:underline"
                >
                  Save a preview image for this project
                </button>
              ) : null}
            </section>
          ) : null}

          {productionHref ? (
            <section className="rounded-2xl border border-success/30 bg-success/10 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-success">Your application is live</p>
              <a href={productionHref} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-lg font-medium text-success hover:underline">
                {productionHref}
                <ExternalLink className="size-4" />
              </a>
            </section>
          ) : null}

          {project.mode === "website" && project.sourceUrl ? (
            <section className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Reference site</p>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{project.sourceUrl}</p>
                </div>
                <a href={ensureProtocol(project.sourceUrl)} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-medium text-primary hover:underline">Open original</a>
              </div>
              <ReferenceSitePreview
                url={ensureProtocol(project.sourceUrl)}
                name={`${project.name} reference`}
                screenshots={project.understanding?.screenshots}
              />
            </section>
          ) : null}

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Product health</p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {view.capabilities.map((cap) => (
                <li key={cap.id} className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 items-center justify-center rounded-full text-[10px]",
                      cap.status === "optional" && "bg-muted text-muted-foreground",
                      cap.status === "attention" && "bg-destructive/15 text-destructive",
                      cap.status === "pending" && "bg-muted text-muted-foreground",
                      (cap.status === "ready" || cap.status === "live" || cap.status === "active" || cap.status === "connected") && "bg-success/15 text-success",
                    )}
                    aria-hidden
                  >
                    {cap.status === "pending" || cap.status === "optional" ? "○" : cap.status === "attention" ? "!" : "✓"}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{cap.label}</p>
                    <p className="text-xs text-muted-foreground">{cap.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {state === "building" || state === "deploying" ? (
            <section className="rounded-2xl border border-primary/30 bg-primary/10 p-5">
              <p className="flex items-center gap-2 font-medium text-foreground">
                {state === "building" ? <Hammer className="size-4" /> : <Rocket className="size-4" />}
                {state === "building" ? "Engineering is building" : "The launch team is publishing"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">This can take a while. Stay here for the live commentary — and if you do leave, the build carries on and this page reconnects to it when you return.</p>
              <button
                type="button"
                onClick={() => setBuildOverlayOpen(true)}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Watch the teams work
              </button>
            </section>
          ) : null}

          {project.buildSummary?.message ? (
            <TeamHandoff message={project.buildSummary.message} />
          ) : null}

          {(view.canLaunch || view.productionUrl || (project.deploymentHistory?.length ?? 0) > 0) ? (
            <section id="publish" className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{view.productionUrl ? "Live" : "Launch"}</p>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {view.productionUrl
                  ? "Your application is on production hosting. You can update the domain or publish again."
                  : "Publish the application to production hosting. This is separate from building."}
              </p>
              {project.totalumProjectId ? (
                <div className="mt-4 min-w-0">
                  <PublishMenu projectId={projectId} projectName={project.name} totalumProjectId={project.totalumProjectId} onDeployed={() => void refresh()} />
                </div>
              ) : null}
              <div className="mt-6 min-w-0 border-t border-border pt-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Deployments</p>
                <p className="mt-1 text-sm text-muted-foreground">Production publishes for this application.</p>
                <div className="mt-4 min-w-0">
                  <DeploymentHistory projectId={projectId} />
                </div>
              </div>
            </section>
          ) : null}

        </div>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-20">
          <section className={cn(
            "rounded-2xl p-5 shadow-sm",
            next.needsYou ? "bg-primary text-primary-foreground" : "border border-border bg-card",
          )}>
            <p className={cn("text-[11px] font-semibold uppercase tracking-[0.16em]", next.needsYou ? "text-primary-foreground/70" : "text-muted-foreground")}>{next.kicker}</p>
            <h3 className="mt-2 text-lg font-semibold tracking-tight">{next.title}</h3>
            <p className={cn("mt-2 text-sm leading-6", next.needsYou ? "text-primary-foreground/80" : "text-muted-foreground")}>{next.body}</p>
            {next.mutation === "build" || next.mutation === "retry_build" ? (
              <p className={cn("mt-3 text-xs", next.needsYou ? "text-primary-foreground/70" : "text-muted-foreground")}>
                {tierLabel(tier)} · {buildCost(tier, project.pipelineMode).toLocaleString()} credits
              </p>
            ) : null}
            {next.mutation ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void runMutation(next.mutation!)}
                className={cn(
                  "mt-4 inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50",
                  next.needsYou ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground",
                )}
              >
                {busy ? "Working…" : next.actionLabel}
              </button>
            ) : next.href && next.actionLabel ? (
              <Link
                href={next.href}
                className={cn(
                  "mt-4 inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold",
                  next.needsYou ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground",
                )}
              >
                {next.actionLabel}
              </Link>
            ) : null}
            {state === "build_failed" ? (
              <Link href={`/project/${projectId}/edit`} className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-primary-foreground/30 px-4 py-2 text-sm">
                Review project
              </Link>
            ) : null}
            {state === "deployment_failed" && previewHref ? (
              <a href={previewHref} target="_blank" rel="noreferrer" className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-primary-foreground/30 px-4 py-2 text-sm">
                Open application preview
              </a>
            ) : null}
            {planReviewable ? (
              <Link
                href={`/project/${projectId}/collaborate`}
                className={cn(
                  "mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold",
                  next.needsYou
                    ? "border border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
                    : "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                <MessagesSquare className="size-4" />
                Open Collaborate
              </Link>
            ) : (
              <Link
                href={`/project/${projectId}/collaborate`}
                className={cn(
                  "mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-medium",
                  next.needsYou ? "border-primary-foreground/30 text-primary-foreground/80" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                <MessagesSquare className="size-3.5" />
                Go to Collaborate
              </Link>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Team progress</p>
              <Link href={`/project/${projectId}/progress`} className="text-xs font-medium text-primary hover:underline">
                View all
              </Link>
            </div>
            {milestones.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Meaningful work will show up here as the team moves.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {milestones.map((event) => {
                  const role = roleForStage(event.stage)
                  return (
                    <li key={event.id} className="flex gap-2.5">
                      <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold", TEAM_ROLE_META[role].tone)}>
                        {TEAM_ROLE_META[role].initials}
                      </span>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">{TEAM_ROLE_META[role].title}</p>
                        <p className="text-sm text-foreground">{event.message}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Grow your business</p>
            <p className="mt-2 text-sm text-muted-foreground">Your co-founder can help you plan the next growth move. Some of these areas are still on the way.</p>
            <div className="mt-4 grid gap-2">
              {[
                { href: `/project/${projectId}/market`, title: "Market & grow" },
                { href: `/project/${projectId}/ads`, title: "Ads & marketing" },
                { href: `/project/${projectId}/finances`, title: "Business finances" },
                { href: `/project/${projectId}/lessons`, title: "Business lessons" },
                { href: `/project/${projectId}/resources`, title: "Resources" },
                { href: `/project/${projectId}/competition`, title: "Competition" },
              ].map((card) => (
                <Link key={card.href} href={card.href} className="rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-foreground hover:border-primary/30 hover:text-primary">
                  {card.title}
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>

    </div>
  )
}
