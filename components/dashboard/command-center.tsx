"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Compass,
  Globe,
  Lightbulb,
  MessageSquare,
  Sparkles,
} from "lucide-react"
import { FirstMission } from "@/components/onboarding/first-mission"
import { ActivationEmpty } from "@/components/onboarding/activation-empty"
import { ProjectThumbnail } from "@/components/project-thumbnail"
import { GitHubIcon } from "@/components/github-icon"
import { Skeleton } from "@/components/ui/skeleton"
import { buttonVariants } from "@/components/ui/button"
import { relativeTime } from "@/lib/client/format"
import { useProjectActivity, useProjects, useSession, type ActivityEvent } from "@/lib/client/api"
import {
  filterMeaningfulActivity,
  getDashboardAttentionItems,
  getJourneyProgress,
  greetingForHour,
  interpretProjectState,
  selectActiveProject,
  type ActionSeverity,
  type JourneyStage,
} from "@/lib/dashboard/view-model"
import type { ProjectMode, ProjectSummary } from "@/lib/types/project"
import { cn } from "@/lib/utils"

const JOURNEY: { id: JourneyStage; label: string }[] = [
  { id: "vision", label: "Vision" },
  { id: "plan", label: "Plan" },
  { id: "build", label: "Build" },
  { id: "launch", label: "Launch" },
  { id: "grow", label: "Grow" },
]

const MODE_LABEL: Record<ProjectMode, string> = {
  scratch: "Idea",
  website: "Website reference",
  github: "GitHub",
}

function severityClass(severity: ActionSeverity): string {
  switch (severity) {
    case "error":
      return "border-destructive/30 bg-destructive/5"
    case "warning":
      return "border-amber-500/30 bg-amber-500/5"
    case "success":
      return "border-emerald-500/25 bg-emerald-500/5"
    default:
      return "border-border bg-card"
  }
}

export function DashboardCommandCenter() {
  const { session, isLoading: sessionLoading, error: sessionError } = useSession()
  const { projects, isLoading: projectsLoading, error: projectsError } = useProjects()
  const firstName = session?.user.name?.trim().split(/\s+/)[0] || "there"
  const greeting = greetingForHour(new Date().getHours())
  const active = selectActiveProject(projects)
  const attention = session
    ? getDashboardAttentionItems({
        projects,
        emailVerified: session.user.emailVerified,
        creditsAvailable: session.credits.available,
      })
    : []

  const showEmpty =
    !projectsLoading &&
    projects.length === 0 &&
    Boolean(session?.user.onboarding?.dismissedAt) &&
    !session?.user.onboarding?.completedAt

  if (sessionLoading || !session) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 lg:px-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <>
      <FirstMission />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:py-8 lg:px-8">
        <header className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            {greeting}, {firstName}.
          </p>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Here's where your business stands.</h2>
        </header>

        {sessionError || projectsError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-medium">We couldn't load your workspace.</p>
            <p className="mt-1 text-muted-foreground">
              {(sessionError ?? projectsError)?.message || "Check your connection and refresh the page."}
            </p>
          </div>
        ) : null}

        {projectsLoading && projects.length === 0 ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : null}

        {showEmpty ? <ActivationEmpty /> : null}

        {!projectsLoading && projects.length === 0 && !showEmpty ? <DashboardEmpty /> : null}

        {active ? (
          <NextActionCard
            project={active}
            askHref={`/project/${active.id}/collaborate`}
          />
        ) : null}

        {projects.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <AttentionList items={attention} />
            {active ? <JourneyCard state={active.state} name={active.name} /> : null}
          </div>
        ) : null}

        {projects.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {active ? <ActivityPanel project={active} /> : null}
            <AiTeamCard project={active} />
          </div>
        ) : null}

        {projects.length > 0 ? <BusinessesList projects={projects} /> : null}

        {projects.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <UsageCard
              available={session.credits.available}
              balance={session.credits.balance}
              emailVerified={session.user.emailVerified}
            />
            <DiscoverCard />
            <ShapeAtaiCard />
            <ReferralCard />
          </div>
        ) : null}
      </div>
    </>
  )
}

function DashboardEmpty() {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Start</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight">Let's build something real.</h3>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        Tell Atai what you're building. We'll help turn the idea into a plan and a working product.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/new/idea" className={cn(buttonVariants())}>
          <Lightbulb className="size-4" />
          Start with an idea
        </Link>
        <Link href="/new/website" className={cn(buttonVariants({ variant: "outline" }))}>
          <Globe className="size-4" />
          Use a website
        </Link>
        <Link href="/new/github" className={cn(buttonVariants({ variant: "outline" }))}>
          <GitHubIcon className="size-4" />
          Continue from GitHub
        </Link>
      </div>
    </section>
  )
}

function NextActionCard({ project, askHref }: { project: ProjectSummary; askHref: string }) {
  const status = interpretProjectState(project.state, project.id)
  return (
    <section className={cn("overflow-hidden rounded-2xl border p-0", severityClass(status.severity))}>
      <ProjectThumbnail
        src={project.thumbnailUrl}
        alt={`Preview of ${project.name}`}
        className="max-h-48 w-full object-cover object-top"
      />
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Continue where you left off
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight">{status.headline}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{status.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{project.name}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{MODE_LABEL[project.mode]}</span>
            <span className="text-muted-foreground">·</span>
            <span>{status.founderLabel}</span>
            <span className="text-muted-foreground">· updated {relativeTime(project.updatedAt)}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <Link href={status.primaryAction.href} className={cn(buttonVariants({ size: "lg" }))}>
            {status.primaryAction.label}
            <ArrowRight className="size-4" />
          </Link>
          {status.secondaryAction ? (
            <Link href={status.secondaryAction.href} className={cn(buttonVariants({ variant: "ghost" }))}>
              {status.secondaryAction.label}
            </Link>
          ) : (
            <Link href={askHref} className={cn(buttonVariants({ variant: "ghost" }))}>
              Ask Atai
            </Link>
          )}
        </div>
      </div>
      <nav className="flex flex-wrap gap-2 border-t border-border/70 px-5 py-3 sm:px-6" aria-label="Project">
        {[
          { href: `/project/${project.id}`, label: "Overview" },
          { href: `/project/${project.id}/plan`, label: "Plan" },
          { href: `/project/${project.id}/collaborate`, label: "Collaborate" },
          { href: `/project/${project.id}`, label: "Build" },
          { href: `/project/${project.id}/database`, label: "Data" },
          { href: `/project/${project.id}/runtime`, label: "Runtime" },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </section>
  )
}

function AttentionList({ items }: { items: ReturnType<typeof getDashboardAttentionItems> }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Needs your attention</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing needs you right now. Your businesses are up to date.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.slice(0, 5).map((item) => (
            <li key={item.id} className={cn("rounded-xl border px-3 py-2.5", severityClass(item.severity))}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {item.severity === "error" ? <AlertTriangle className="size-3.5" /> : null}
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                </div>
                <Link href={item.href} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
                  {item.actionLabel}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function JourneyCard({ state, name }: { state: ProjectSummary["state"]; name: string }) {
  const reached = new Set(getJourneyProgress(state))
  const current = interpretProjectState(state, "_").journeyStage
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Your journey</p>
      <p className="mt-2 text-sm text-muted-foreground">{name}</p>
      <ol className="mt-4 flex flex-wrap items-center gap-2">
        {JOURNEY.map((stage, i) => {
          const done = reached.has(stage.id) && stage.id !== current
          const active = stage.id === current
          return (
            <li key={stage.id} className="flex items-center gap-2">
              {i > 0 ? <span className="text-muted-foreground" aria-hidden>→</span> : null}
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs",
                  active && "border-primary bg-primary/10 text-foreground",
                  done && "border-emerald-500/30 bg-emerald-500/10 text-foreground",
                  !done && !active && "border-border text-muted-foreground",
                )}
              >
                {done ? <CheckCircle2 className="mr-1 inline size-3" /> : null}
                {stage.label}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function ActivityPanel({ project }: { project: ProjectSummary }) {
  const isBuilding = project.state === "building" || project.state === "analyzing" || project.state === "deploying"
  const { events, isLoading, error } = useProjectActivity(project.id, isBuilding)
  const items = useMemo(() => {
    const list = Array.isArray(events) ? events : []
    return filterMeaningfulActivity(list as ActivityEvent[], project)
  }, [events, project])

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">What Atai did</p>
      {error ? (
        <p className="mt-3 text-sm text-muted-foreground">Activity isn't available right now.</p>
      ) : isLoading && items.length === 0 ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No recent activity for {project.name} yet. Atai will show meaningful updates here as work happens.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="block rounded-lg hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <p className="text-[11px] text-muted-foreground">{relativeTime(item.at)}</p>
                <p className="text-sm">{item.title}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function AiTeamCard({ project }: { project: ProjectSummary | null }) {
  const ask = project ? `/project/${project.id}/collaborate` : "/new"
  const build = project ? `/project/${project.id}` : "/new"

  // Derive each agent's live status from the persisted project state —
  // same server truth the rest of the dashboard uses. No invented metrics.
  const state = project?.state
  const cofounderStatus =
    !project ? "Start a business to meet your AI team."
    : state === "created" || state === "pending_plan" || state === "analyzing" || state === "analysis_complete" || state === "specification_ready"
      ? "Preparing your first plan."
      : state === "plan_ready"
        ? "Plan ready — waiting for your review."
        : state === "awaiting_build_confirmation"
          ? "Standing by to confirm the build."
          : "Available — pick up where you left off."
  const builderStatus =
    !project ? ""
    : state === "building" || state === "deploying"
      ? "Working on your application now."
      : state === "build_failed" || state === "deployment_failed"
        ? "Needs attention — the last run didn't finish."
        : state === "build_complete" || state === "ready" || state === "deployed"
          ? "Delivered — your application is ready."
          : "Waits for the plan to be approved."

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Atai AI team</p>
      <ul className="mt-3 space-y-3">
        <li>
          <p className="text-sm font-medium">AI Co-Founder</p>
          <p className="text-xs text-muted-foreground">
            {cofounderStatus} Planning, strategy, and decisions in plain language.
          </p>
        </li>
        {builderStatus ? (
          <li>
            <p className="text-sm font-medium">Build Agent</p>
            <p className="text-xs text-muted-foreground">{builderStatus} Turns an approved plan into a working product.</p>
          </li>
        ) : null}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={ask} className={cn(buttonVariants())}>
          <MessageSquare className="size-4" />
          Ask Atai
        </Link>
        <Link href={build} className={cn(buttonVariants({ variant: "outline" }))}>
          View AI work
        </Link>
      </div>
    </section>
  )
}

function BusinessesList({ projects }: { projects: ProjectSummary[] }) {
  const rows = [...projects].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8)
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Your businesses</h3>
        <Link href="/projects" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          View all businesses <ArrowRight className="size-3" />
        </Link>
      </div>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {rows.map((project) => {
          const status = interpretProjectState(project.state, project.id)
          return (
            <li key={project.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <ProjectThumbnail
                  src={project.thumbnailUrl}
                  alt=""
                  className="size-10 shrink-0 rounded-lg object-cover object-top"
                  fallback={
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-xs font-medium text-muted-foreground">
                      {project.name.slice(0, 1).toUpperCase()}
                    </span>
                  }
                />
                <div className="min-w-0">
                  <p className="truncate font-medium">{project.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {status.founderLabel} · {MODE_LABEL[project.mode]} · {relativeTime(project.updatedAt)}
                  </p>
                </div>
              </div>
              <Link href={status.primaryAction.href} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
                {status.primaryAction.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function UsageCard({
  available,
  balance,
  emailVerified,
}: {
  available: number
  balance: number
  emailVerified: boolean
}) {
  if (!emailVerified && balance === 0) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Atai usage</p>
        <p className="mt-2 text-sm">Verify your email to see credits.</p>
        <Link href="/settings/profile" className="mt-3 inline-flex text-sm text-primary hover:underline">
          Verify
        </Link>
      </section>
    )
  }
  const remaining = balance > 0 ? Math.round((available / balance) * 100) : 0
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Atai usage</p>
      <p className="mt-2 text-lg font-semibold tabular-nums">{remaining}% remaining</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full bg-primary" style={{ width: `${Math.min(100, remaining)}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{available.toLocaleString()} credits available</p>
      <Link href="/settings/billing" className="mt-3 inline-flex text-sm text-primary hover:underline">
        Manage usage
      </Link>
    </section>
  )
}

function DiscoverCard() {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Discover</p>
      <p className="mt-2 text-sm">See what other founders are building.</p>
      <Link href="/explore" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <Compass className="size-3.5" /> Explore
      </Link>
    </section>
  )
}

function ShapeAtaiCard() {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Shape Atai</p>
      <p className="mt-2 text-sm">Have an idea for Atai? Vote on what we should build next.</p>
      <Link href="/feature-requests" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <Lightbulb className="size-3.5" /> Request a feature
      </Link>
    </section>
  )
}

function ReferralCard() {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Refer a founder</p>
      <p className="mt-2 text-sm">Invite someone building a business. Earn Atai credits when they join.</p>
      <Link href="/referrals" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <Sparkles className="size-3.5" /> Open referrals
      </Link>
    </section>
  )
}


