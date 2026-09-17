import { notFound, redirect } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { StateBadge } from "@/components/state-badge-live"
import { ProjectWorkspace } from "@/components/project-workspace"
import { getCurrentUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ProjectActions, DashboardLink } from "./project-actions"

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

          {/* Top row — back link + action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <DashboardLink projectId={project.id} />
            <ProjectActions project={project} isBuilt={isBuilt} />
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
