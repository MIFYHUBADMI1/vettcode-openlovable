import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { ProjectFinancesView } from "@/components/finances/project-finances-view"
import { getProjectFinances } from "@/lib/finances/project-finances"
import { requireOwnedProject } from "@/lib/workspace/require-owned-project"

/**
 * Project finances — live page.
 *
 * Authorization is unchanged from every other project page:
 * requireOwnedProject session-checks the user and 404s on any non-owner
 * (uniform notFound — no existence leak). The signed-in owner's project is
 * connected automatically: all data is keyed by the project id from the URL
 * and resolved server-side (runtime usage metering + attributed Dodo
 * payments), so nothing needs re-explaining per visit.
 *
 * Read-only assembly: viewing never charges credits.
 */
export default async function ProjectFinancesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const project = await requireOwnedProject(projectId, `/project/${projectId}/finances`)
  const finances = await getProjectFinances(project.id)

  return (
    <DashboardShell title={project.name} projectId={project.id}>
      <div className="mx-auto w-full max-w-5xl px-6 pb-16">
        <ProjectFinancesView finances={finances} />
      </div>
    </DashboardShell>
  )
}
