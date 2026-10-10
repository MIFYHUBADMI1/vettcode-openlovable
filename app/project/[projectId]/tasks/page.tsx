import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { GrowthTasksPanel, type GrowthTaskView, type NextStepSeed } from "@/components/marketing/growth-tasks-panel"
import { ProjectComingSoon } from "@/components/workspace/project-coming-soon"
import { getCurrentUser } from "@/lib/auth/session"
import { isGrowthTasksEnabledForUser } from "@/lib/marketing/feature-flags"
import { listTasks } from "@/lib/marketing/tasks/service"
import { getGrowthOverview } from "@/lib/marketing/growth-overview"
import { requireOwnedProject } from "@/lib/workspace/require-owned-project"

/**
 * Growth tasks route (Phase 5 — W4).
 *
 * Authorization is identical to every other project page: requireOwnedProject
 * session-checks the user and 404s on any non-owner (uniform — no existence leak).
 * The feature flag is evaluated server-side only; when disabled the route renders
 * the EXACT coming-soon experience. The page load is read-only and FREE — creating
 * tasks and approving AI proposals happen via the API route / CONFIRM tool. The
 * next-step seeds shown here are the same deterministic, rule-based suggestions
 * the growth view shows; they are never presented as actions already taken.
 */
export default async function ProjectTasksPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const project = await requireOwnedProject(projectId, `/project/${projectId}/tasks`)
  const user = await getCurrentUser()

  if (!user || !isGrowthTasksEnabledForUser(user.id)) {
    return (
      <ProjectComingSoon
        projectId={project.id}
        projectName={project.name}
        kicker="Plan & execute"
        title={`Growth tasks for ${project.name}`}
        description="This is where you will turn next steps into a manageable task list and track what you've done. The experience is not available yet."
      />
    )
  }

  // Read-only, free assembly.
  const docs = await listTasks(project.id)
  const tasks: GrowthTaskView[] = docs.map((d) => ({
    id: d.id,
    title: d.title,
    detail: d.detail ?? null,
    status: d.status,
    priority: d.priority,
    dueAt: d.dueAt,
    origin: d.origin,
    sourceNextStepId: d.sourceNextStepId ?? null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    completedAt: d.completedAt,
  }))
  const overview = await getGrowthOverview({ user, project })
  const nextSteps: NextStepSeed[] = overview.nextSteps.map((s) => ({
    id: s.id,
    kind: s.kind,
    title: s.title,
    detail: s.detail,
    executed: false,
    navigation: s.navigation ?? null,
  }))

  return (
    <DashboardShell title={project.name} projectId={project.id}>
      <div className="mx-auto max-w-3xl px-6 pb-16">
        <GrowthTasksPanel projectId={project.id} state={{ enabled: true, tasks, nextSteps }} />
      </div>
    </DashboardShell>
  )
}
