import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { StateBadge } from "@/components/state-badge-live"
import { ProjectWorkspace } from "@/components/project-workspace"
import { getCurrentUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import {
  LayoutDashboard, Code2, ScrollText, PenLine,
  Database, Download, ExternalLink, KeyRound,
} from "lucide-react"

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02 0 2.04.14 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.66 1.66.25 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58C20.57 21.8 24 17.3 24 12 24 5.37 18.63 0 12 0Z" />
    </svg>
  )
}

export default async function ProjectWorkspacePage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/project/${(await params).projectId}`)}`)

  const { projectId } = await params
  const project = await store.getProject(projectId)
  if (!project || project.userId !== user.id) notFound()

  const sourceLabel = project.sourceUrl ?? project.idea ?? "Project workspace"
  const isBuilt = Boolean(project.totalumProjectId)

  return (
    <main className="min-h-svh bg-background text-foreground">
      <AppHeader />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-10">

        {/* Header */}
        <div className="flex flex-col gap-6 border-b border-border pb-8">

          {/* Top row — breadcrumb back + action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3">

            {/* Back to dashboard */}
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-accent hover:text-foreground"
            >
              <LayoutDashboard className="size-3.5" />
              Dashboard
            </Link>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2">

              {/* View Plan */}
              {project.specification && (
                <Link
                  href={`/project/${project.id}/plan`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-accent hover:text-foreground"
                >
                  <ScrollText className="size-3.5" />
                  View plan
                </Link>
              )}

              {/* Edit application */}
              <Link
                href={`/project/${project.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition-all hover:bg-primary/20"
              >
                <PenLine className="size-3.5" />
                Edit plan
              </Link>

              {/* Source code — only when built */}
              {isBuilt && (
                <Link
                  href={`/project/${project.id}/source`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-accent hover:text-foreground"
                >
                  <Code2 className="size-3.5" />
                  Source code
                </Link>
              )}

              {/* Database — only when built */}
              {isBuilt && (
                <Link
                  href={`/project/${project.id}/database`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-600 transition-all hover:bg-emerald-500/20 dark:text-emerald-400"
                >
                  <Database className="size-3.5" />
                  Database
                </Link>
              )}

              {/* Environment variables — only when built */}
              {isBuilt && (
                <Link
                  href={`/project/${project.id}/env`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-600 transition-all hover:bg-amber-500/20 dark:text-amber-400"
                >
                  <KeyRound className="size-3.5" />
                  .env
                </Link>
              )}

              {/* GitHub — scroll to section */}
              <button
                onClick={() => document.getElementById('github-integration')?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-accent hover:text-foreground"
              >
                <GitHubIcon className="size-3.5" />
                GitHub
              </button>

              {/* Open live preview — only when built */}
              {project.developmentUrl && (
                <a
                  href={project.developmentUrl.startsWith("http") ? project.developmentUrl : `https://${project.developmentUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-medium text-green-600 transition-all hover:bg-green-500/20 dark:text-green-400"
                >
                  <ExternalLink className="size-3.5" />
                  Open preview
                </a>
              )}

              {/* Export */}
              <a
                href={`/api/projects/${project.id}/export`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-accent hover:text-foreground"
              >
                <Download className="size-3.5" />
                Export
              </a>
            </div>
          </div>

          {/* Project identity */}
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-balance">{project.name}</h1>
              <p className="mt-2 text-sm text-muted-foreground truncate max-w-xl">{sourceLabel}</p>
            </div>
            <StateBadge projectId={project.id} initialState={project.state} />
          </div>
        </div>

        {/* Live workspace */}
        <ProjectWorkspace projectId={project.id} initialState={project.state} />
      </div>
    </main>
  )
}
