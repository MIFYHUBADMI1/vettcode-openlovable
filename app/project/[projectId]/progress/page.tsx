import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { TeamProgressPage } from "@/components/workspace/team-progress"
import { requireOwnedProject } from "@/lib/workspace/require-owned-project"
import { store } from "@/lib/store/store"

export const dynamic = "force-dynamic"

export default async function ProjectProgressRoute({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const project = await requireOwnedProject(projectId, `/project/${projectId}/progress`)

  // Fetch active build runs for the current-task section.
  let activeBuildRuns: Array<{ id: string; status: string; kind: string; startedAt: number; totalumProjectId?: string; error?: string }> = []
  try {
    const runs = await store.listBuildRuns(projectId, { status: "running", limit: 5 })
    activeBuildRuns = runs.map((r) => ({
      id: r.id,
      status: r.status,
      kind: r.kind,
      startedAt: r.startedAt,
      totalumProjectId: r.totalumProjectId,
      error: r.error,
    }))
  } catch {
    // Non-fatal: if we can't fetch build runs, the page still works without them.
  }

  return (
    <DashboardShell title="Team progress" projectId={project.id}>
      <TeamProgressPage initialProject={{ ...project, events: project.events ?? [] }} activeBuildRuns={activeBuildRuns} />
    </DashboardShell>
  )
}
