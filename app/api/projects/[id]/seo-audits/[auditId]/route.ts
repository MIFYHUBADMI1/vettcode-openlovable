import { requireUser } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { checkProjectOwnership } from "@/lib/runtime/ownership"
import { isSeoAuditEnabledForUser } from "@/lib/marketing/feature-flags"
import { getSeoAuditById } from "@/lib/marketing/seo/service"

/**
 * GET /api/projects/:id/seo-audits/:auditId — one stored audit, full findings.
 *
 * Ownership is enforced twice: the caller must own the project, and the audit
 * is looked up BY that project id. An audit id belonging to another project
 * therefore resolves to a uniform 404 rather than leaking its contents.
 */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; auditId: string }> },
) {
  try {
    const user = await requireUser()
    const { id, auditId } = await params

    const ownership = await checkProjectOwnership(user.id, id)
    if (!ownership.ok) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)

    if (!isSeoAuditEnabledForUser(user.id)) {
      return ok({ enabled: false, audit: null })
    }

    const audit = await getSeoAuditById(id, auditId)
    if (!audit) return fail("AUDIT_NOT_FOUND", "We couldn't find that audit.", 404)

    return ok({
      enabled: true,
      audit: {
        id: audit.id,
        url: audit.url,
        status: audit.status,
        score: audit.score,
        auditScore: audit.auditScore ?? null,
        findings: audit.findings,
        recommendations: audit.recommendations ?? [],
        recommendationsMeta: audit.recommendationsMeta ?? null,
        pagesCrawled: audit.pagesCrawled,
        fromCache: audit.fromCache,
        creditsCharged: audit.creditsCharged,
        refund: audit.refund ?? null,
        error: audit.error ?? null,
        createdAt: audit.createdAt,
        completedAt: audit.completedAt ?? null,
      },
    })
  } catch (e) {
    return handleRouteError("api.projects.seoAudits.get", e)
  }
}
