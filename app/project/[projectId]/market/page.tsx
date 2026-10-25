import Link from "next/link"
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
      {/* One responsive content column for the whole page: phone gutters,
          comfortable desktop measure, and consistent spacing between blocks. */}
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-12 pt-6 sm:gap-8 sm:px-6 sm:pt-8 lg:px-8 lg:pb-16">
        <GrowthOverviewView overview={overview} />
        <Link
          href={`/project/${project.id}/studio`}
          className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between sm:p-5"
        >
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-base font-semibold tracking-tight sm:text-lg">AI Marketing Studio</span>
            <span className="text-sm leading-6 text-muted-foreground">
              Draft social posts, emails, website copy, blog articles and strategy briefs, save them in your content
              library, and plan when to use them. Drafts are never published automatically.
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary">
            Open studio <span aria-hidden>→</span>
          </span>
        </Link>
        <SeoAuditPanel
          projectId={project.id}
          state={{
            enabled: seoEnabled,
            deployed,
            cost: seoAffordability?.cost ?? 0,
            available: seoAffordability?.available ?? 0,
            href: `/project/${project.id}/market/seo`,
            latest: seoLatest
              ? {
                  url: seoLatest.url,
                  status: seoLatest.status,
                  score: seoLatest.score,
                  auditScore: seoLatest.auditScore ?? null,
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
