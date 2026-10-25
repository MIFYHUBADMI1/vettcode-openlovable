import Link from "next/link"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { SeoWorkspace, type SeoAuditView } from "@/components/marketing/seo-workspace"
import { ProjectComingSoon } from "@/components/workspace/project-coming-soon"
import { getCurrentUser } from "@/lib/auth/session"
import { isSeoAuditEnabledForUser } from "@/lib/marketing/feature-flags"
import { getSeoAuditAffordability } from "@/lib/marketing/seo/credits"
import { getLatestSeoAudit, listSeoAudits } from "@/lib/marketing/seo/service"
import { requireOwnedProject } from "@/lib/workspace/require-owned-project"

/**
 * SEO & Visibility destination (Phase 3 — v1.1).
 *
 * Lives under the existing Market & grow workspace, so the sidebar keeps
 * "Market & grow" selected (active nav matches the path prefix) and direct
 * URLs / refreshes resolve here. Authorization is the same uniform
 * requireOwnedProject notFound used by every other project page.
 *
 * Everything read here is free; running an audit is a separate, credit-charged
 * POST from the client component.
 */
export default async function ProjectSeoVisibilityPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const project = await requireOwnedProject(projectId, `/project/${projectId}/market/seo`)
  const user = await getCurrentUser()

  if (!user || !isSeoAuditEnabledForUser(user.id)) {
    return (
      <ProjectComingSoon
        projectId={project.id}
        projectName={project.name}
        kicker="SEO & visibility"
        title={`Visibility for ${project.name}`}
        description="This view will show what Atai can observe about your site's on-page search readiness. It is not available yet."
      />
    )
  }

  const deployed = project.deployment?.status === "success" && Boolean(project.deployment?.productionUrl)
  const affordability = await getSeoAuditAffordability(user.id)

  const latestDoc = deployed ? await getLatestSeoAudit(project.id) : null
  const history = deployed ? await listSeoAudits(project.id) : { audits: [], nextCursor: null }

  const initialAudit: SeoAuditView | null = latestDoc
    ? {
        id: latestDoc.id,
        url: latestDoc.url,
        status: latestDoc.status,
        score: latestDoc.score,
        auditScore: latestDoc.auditScore ?? null,
        pagesCrawled: latestDoc.pagesCrawled,
        findings: latestDoc.findings,
        recommendations: latestDoc.recommendations ?? [],
        recommendationsMeta: latestDoc.recommendationsMeta ?? null,
        refund: latestDoc.refund ?? null,
        fromCache: latestDoc.fromCache,
        createdAt: latestDoc.createdAt,
        error: latestDoc.error ?? null,
      }
    : null

  return (
    <DashboardShell title={project.name} projectId={project.id}>
      <div className="mx-auto w-full max-w-5xl px-6 pb-16">
        <Link
          href={`/project/${project.id}/market`}
          className="mb-4 inline-block text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Back to Market &amp; grow
        </Link>
        <SeoWorkspace
          projectId={project.id}
          projectName={project.name}
          deployed={deployed}
          cost={affordability.cost}
          available={affordability.available}
          initialAudit={initialAudit}
          initialHistory={history.audits}
          initialCursor={history.nextCursor}
        />
      </div>
    </DashboardShell>
  )
}
