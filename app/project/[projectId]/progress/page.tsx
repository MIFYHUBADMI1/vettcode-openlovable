import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { TeamProgressPage } from "@/components/workspace/team-progress"
import { requireOwnedProject } from "@/lib/workspace/require-owned-project"

export const dynamic = "force-dynamic"

export default async function ProjectProgressRoute({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const project = await requireOwnedProject(projectId, `/project/${projectId}/progress`)

  return (
    <DashboardShell title="Team progress" projectId={project.id}>
      <TeamProgressPage initialProject={{ ...project, events: project.events ?? [] }} />
    </DashboardShell>
  )
}
