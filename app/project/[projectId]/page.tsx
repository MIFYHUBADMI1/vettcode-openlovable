import { notFound, redirect } from "next/navigation"
import { ProjectWorkspace } from "@/components/project-workspace"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { getCurrentUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"

export default async function ProjectWorkspacePage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/project/${(await params).projectId}`)}`)

  const { projectId } = await params
  const project = await store.getProject(projectId)
  if (!project || project.userId !== user.id) notFound()

  return (
    <DashboardShell title={project.name} projectId={project.id}>
      <ProjectWorkspace projectId={project.id} initialState={project.state} />
    </DashboardShell>
  )
}
