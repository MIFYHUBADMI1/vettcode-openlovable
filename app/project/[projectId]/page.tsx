import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { StateBadge } from "@/components/state-badge-live"
import { ProjectWorkspace } from "@/components/project-workspace"
import { getCurrentUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"

export default async function ProjectWorkspacePage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/project/${(await params).projectId}`)}`)

  const { projectId } = await params
  const project = await store.getProject(projectId)
  if (!project || project.userId !== user.id) notFound()

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
              <Link
                href={`/project/${project.id}/source`}
                className="font-mono text-xs text-primary hover:underline"
              >
                Source code
              </Link>
              <Link
                href={`/project/${project.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                ✏️ Edit application
              </Link>
              {project.totalumProjectId && (
                <Link
                  href={`/project/${project.id}/database`}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                >
                  <i className="fa-solid fa-database text-[10px]" />
                  Database
                </Link>
              )}
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
          <StateBadge projectId={project.id} initialState={project.state} />
        </div>

        {/* Live workspace — polls project state and drives stepper + build view */}
        <ProjectWorkspace projectId={project.id} initialState={project.state} />
      </div>
    </main>
  )
}
