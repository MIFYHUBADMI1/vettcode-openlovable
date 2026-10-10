import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { GrowthOverviewView } from "@/components/marketing/growth-overview-view"
import { ProjectComingSoon } from "@/components/workspace/project-coming-soon"
import { getCurrentUser } from "@/lib/auth/session"
import { getGrowthOverview } from "@/lib/marketing/growth-overview"
import { isGrowthOverviewEnabledForUser } from "@/lib/marketing/feature-flags"
import { requireOwnedProject } from "@/lib/workspace/require-owned-project"

/**
 * Growth Overview route (Phase 2). Authorization is unchanged from every
 * other project page: requireOwnedProject session-checks the user and 404s on
 * any non-owner (uniform notFound — no existence leak). The feature flag is
 * evaluated server-side only; when disabled, this route renders the EXACT
 * previous coming-soon experience.
 */
export default async function ProjectMarketPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const project = await requireOwnedProject(projectId, `/project/${projectId}/market`)
  const user = await getCurrentUser()

  if (!user || !isGrowthOverviewEnabledForUser(user.id)) {
    return (
      <ProjectComingSoon
        projectId={project.id}
        projectName={project.name}
        kicker="Market & grow"
        title={`Market for ${project.name}`}
        description="This view will already know this product and who it is for. You will not have to re-explain the business. The experience is not available yet."
      />
    )
  }

  // Read-only assembly: no credits charged for viewing this page.
  const overview = await getGrowthOverview({ user, project })

  return (
    <DashboardShell title={project.name} projectId={project.id}>
      <GrowthOverviewView overview={overview} />
    </DashboardShell>
  )
}
