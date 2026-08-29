import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { StateBadge } from "@/components/state-badge"
import { ProjectStepper } from "@/components/project-stepper"
import { ProjectWorkspaceControls } from "@/components/project-workspace-controls"
import { ProjectAssets } from "@/components/project-assets"
import { ProjectActivity } from "@/components/project-activity"
import { getCurrentUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"

export default async function ProjectWorkspacePage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/project/${(await params).projectId}`)}`)

  const { projectId } = await params
  const project = await store.getProject(projectId)
  if (!project || project.userId !== user.id) notFound()

  const heroScreenshot = project.understanding?.screenshots?.[0]
  const sourceLabel = project.sourceUrl ?? project.idea ?? "Project workspace"

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">
        {/* Header */}
        <div className="flex flex-col gap-5 border-b border-border pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/dashboard" className="font-mono text-xs text-primary hover:underline">
                ← Dashboard
              </Link>
              <a
                href={`/api/projects/${project.id}/source`}
                className="font-mono text-xs text-primary hover:underline"
              >
                Download source
              </a>
              <a
                href={`/api/projects/${project.id}/export`}
                className="font-mono text-xs text-muted-foreground hover:text-foreground"
              >
                Export metadata
              </a>
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance">{project.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{sourceLabel}</p>
          </div>
          <StateBadge state={project.state} />
        </div>

        {/* Main layout: progress rail + workspace content */}
        <div className="grid gap-6 lg:grid-cols-[0.65fr_1.35fr] lg:items-start">
          <aside className="flex flex-col gap-6 lg:sticky lg:top-24">
            <div className="border border-border bg-card p-5">
              <p className="px-1 pb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">Progress</p>
              <ProjectStepper state={project.state} />
            </div>
            <p className="px-1 text-xs leading-relaxed text-muted-foreground">
              More workspace tools — a full editor, custom data sources, and team settings — are on the way.
            </p>
          </aside>

          <section className="flex flex-col gap-6">
            {heroScreenshot ? (
              <div className="overflow-hidden border border-border bg-card">
                <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-4 py-2.5">
                  <span className="flex gap-1.5" aria-hidden>
                    <span className="size-2.5 rounded-full bg-destructive/50" />
                    <span className="size-2.5 rounded-full bg-primary/50" />
                    <span className="size-2.5 rounded-full bg-success/50" />
                  </span>
                  <span className="ml-2 flex-1 truncate rounded-sm bg-background/70 px-3 py-1 font-mono text-[11px] text-muted-foreground">
                    {project.sourceUrl ?? "source preview"}
                  </span>
                  {project.sourceUrl ? (
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
                <a href={heroScreenshot} target="_blank" rel="noreferrer" className="block bg-muted">
                  <img
                    src={heroScreenshot || "/placeholder.svg"}
                    alt={`Screenshot of ${project.sourceUrl ?? project.name}`}
                    className="max-h-[520px] w-full object-cover object-top"
                  />
                </a>
              </div>
            ) : null}

            <div className="border border-border bg-card p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">What we know</p>
                <div className="flex gap-4 font-mono text-[11px] text-muted-foreground">
                  <span className="capitalize">{project.mode} mode</span>
                  <span>{project.events.length} events</span>
                  <span>{project.conversation.length} messages</span>
                </div>
              </div>
              <h2 className="mt-3 text-2xl font-medium text-balance">
                {project.understanding?.purpose ?? "Analysis is preparing the project context."}
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                This workspace reflects the persisted project state. As analysis completes, its understanding,
                specification, events, and build result will appear here.
              </p>
            </div>

            <div className="border border-border bg-card p-6">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Workspace controls</p>
              <div className="mt-5">
                <ProjectWorkspaceControls projectId={project.id} />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="border border-border bg-card p-6">
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Activity</p>
                <div className="mt-5">
                  <ProjectActivity projectId={project.id} />
                </div>
              </div>
              <div className="border border-border bg-card p-6">
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Captured assets</p>
                <div className="mt-5">
                  <ProjectAssets projectId={project.id} />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
