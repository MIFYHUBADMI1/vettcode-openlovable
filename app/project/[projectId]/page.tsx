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
