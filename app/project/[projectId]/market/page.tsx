import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { GrowthOverviewView } from "@/components/marketing/growth-overview-view"
import { SeoAuditPanel } from "@/components/marketing/seo-audit-panel"
import { ProjectComingSoon } from "@/components/workspace/project-coming-soon"
import { getCurrentUser } from "@/lib/auth/session"
import { getGrowthOverview } from "@/lib/marketing/growth-overview"
import { isGrowthOverviewEnabledForUser, isSeoAuditEnabledForUser } from "@/lib/marketing/feature-flags"
import { getSeoAuditAffordability } from "@/lib/marketing/seo/credits"
import { getLatestSeoAudit } from "@/lib/marketing/seo/service"
import { requireOwnedProject } from "@/lib/workspace/require-owned-project"

/**
 * Growth Overview route (Phase 2). Authorization is unchanged from every
 * other project page: requireOwnedProject session-checks the user and 404s on
 * any non-owner (uniform notFound — no existence leak). The feature flag is
 * evaluated server-side only; when disabled, this route renders the EXACT
 * previous coming-soon experience.
 *
 * The SEO visibility panel (Phase 3) is added below the overview. Reading the
 * latest audit is free; running one is a separate credit-charged POST and is
 * only shown when the SEO flag is enabled for this user.
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

  const seoEnabled = isSeoAuditEnabledForUser(user.id)
  const deployed = project.deployment?.status === "success" && Boolean(project.deployment?.productionUrl)
  const seoAffordability = seoEnabled ? await getSeoAuditAffordability(user.id) : null
  const seoLatest = seoEnabled ? await getLatestSeoAudit(project.id) : null

  return (
    <DashboardShell title={project.name} projectId={project.id}>
      <GrowthOverviewView overview={overview} />
      <div className="mx-auto w-full max-w-5xl px-6 pb-16">
        <SeoAuditPanel
          projectId={project.id}
          state={{
            enabled: seoEnabled,
            deployed,
            cost: seoAffordability?.cost ?? 0,
            available: seoAffordability?.available ?? 0,
            latest: seoLatest
              ? {
                  url: seoLatest.url,
                  status: seoLatest.status,
                  score: seoLatest.score,
                  pagesCrawled: seoLatest.pagesCrawled,
                  findings: seoLatest.findings,
                  fromCache: seoLatest.fromCache,
                  createdAt: seoLatest.createdAt,
                }
              : null,
          }}
        />
      </div>
    </DashboardShell>
  )
}
