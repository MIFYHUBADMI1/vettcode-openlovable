import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { IntelligenceOverviewView } from "@/components/intelligence/overview-view"
import { getIntelligenceOverview } from "@/lib/intelligence/overview"
import { getCurrentUser } from "@/lib/auth/session"
import { requireOwnedProject } from "@/lib/workspace/require-owned-project"

/**
 * Application Intelligence Overview route (Phase 1).
 *
 * Authorization is unchanged from every other project page:
 * `requireOwnedProject` session-checks the user and 404s any non-owner with
 * the uniform notFound (no existence leak). Reading this page is free — no
 * credits are charged, nothing is written, nothing is simulated.
 */
export default async function ProjectIntelligencePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const project = await requireOwnedProject(projectId, `/project/${projectId}/intelligence`)

  const overview = await getIntelligenceOverview({ user: { id: (await getCurrentUser())?.id ?? "" }, project })

  return (
    <DashboardShell title={project.name} projectId={project.id}>
      <IntelligenceOverviewView overview={overview} />
    </DashboardShell>
  )
}
