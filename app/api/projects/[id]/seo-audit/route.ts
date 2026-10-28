import { requireUser } from "@/lib/auth/session"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { fail, failInsufficientCredits, handleRouteError, ok } from "@/lib/api/respond"
import { store } from "@/lib/store/store"
import { checkProjectOwnership } from "@/lib/runtime/ownership"
import { isSeoAuditEnabledForUser } from "@/lib/marketing/feature-flags"
import { isFirecrawlConfigured } from "@/lib/integrations/firecrawl/client"
import { getSeoAuditAffordability, chargeSeoAuditCredits, refundSeoAuditCredits } from "@/lib/marketing/seo/credits"
import { scopedIntentKey } from "@/lib/billing/operation-identity"
import { runSeoAudit, getLatestSeoAudit, markSeoAuditRefund } from "@/lib/marketing/seo/service"
import { logger } from "@/lib/logging/logger"
import { z } from "zod"

/**
 * SEO visibility audit endpoint (Phase 3 — W2).
 *
 * Session-authenticated, ownership-gated (fail-closed, uniform 404), rate
 * limited, and credit-charged only for a real crawl. The audited URL is always
 * the project's OWN recorded production URL — the client cannot pass a URL to
 * audit, which closes the SSRF/abuse vector by design. GET returns the most
 * recent stored audit (read-only, free).
 */

const BodySchema = z
  .object({
    // Phase 3 (Workstream C): optional client INTENT id. It is only an
    // idempotency identity — never authorization — and the ledger key derived
    // from it is scoped by the authenticated user + this project, so one
    // client can neither collide with nor replay another's charge.
    requestId: z.string().max(128).optional(),
  })
  .strip()

/**
 * GET /api/projects/:id/seo-audit — latest audit for display (no cost).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const ownership = await checkProjectOwnership(user.id, id)
    if (!ownership.ok) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)

    if (!isSeoAuditEnabledForUser(user.id)) {
      return ok({ enabled: false, latest: null })
    }
    const latest = await getLatestSeoAudit(id)
    return ok({
      enabled: true,
      latest: latest
        ? {
            id: latest.id,
            url: latest.url,
            status: latest.status,
            score: latest.score,
            auditScore: latest.auditScore ?? null,
            pagesCrawled: latest.pagesCrawled,
            findings: latest.findings,
            recommendations: latest.recommendations ?? [],
            recommendationsMeta: latest.recommendationsMeta ?? null,
            refund: latest.refund ?? null,
            error: latest.error ?? null,
            fromCache: latest.fromCache,
            createdAt: latest.createdAt,
          }
        : null,
    })
  } catch (e) {
    return handleRouteError("api.projects.seoAudit.get", e)
  }
}

/**
 * POST /api/projects/:id/seo-audit — run a fresh audit (charges credits).
 */
import { withAiProtection } from "@/lib/api/ai-protection"

export const POST = withAiProtection("analysis", post)

async function post(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let charged = false
  let chargedAmount = 0
  let failedAuditId: string | null = null
  let intentKey: string | undefined
  let userId = ""
  let projectId = ""
  try {
    const user = await requireUser()
    userId = user.id
    const { id } = await params
    projectId = id

    await checkRateLimit({ action: "seo_audit_run", identifier: user.id, limit: 10, windowMs: 60 * 60 * 1000 })

    const ownership = await checkProjectOwnership(user.id, id)
    if (!ownership.ok) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)

    if (!isSeoAuditEnabledForUser(user.id)) {
      return fail("FEATURE_DISABLED", "SEO audits aren't available for this account yet.", 403)
    }
    if (!isFirecrawlConfigured()) {
      return fail("FIRECRAWL_UNAVAILABLE", "The website analyzer isn't connected right now.", 503)
    }

    const project = await store.getProject(id)
    if (!project) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)

    const url = project.deployment?.status === "success" ? project.deployment?.productionUrl : undefined
    if (!url) return fail("NOT_DEPLOYED", "This project has no live deployment to audit yet.", 400)

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return fail("VALIDATION", "Invalid request.", 422)

    // Stable operation identity when the client supplies one; otherwise the
    // previous per-attempt behavior is preserved.
    intentKey = scopedIntentKey(parsed.data.requestId, { userId: user.id, operation: "seo_audit", projectId: id })

    const { cost, available, affordable } = await getSeoAuditAffordability(user.id)
    if (!affordable)
      return failInsufficientCredits({
        required: cost,
        available,
        message: `This audit costs ${cost} credits and you have ${available}.`,
      })

    charged = await chargeSeoAuditCredits(user.id, id, intentKey)
    if (!charged)
      return failInsufficientCredits({
        required: cost,
        available,
        message: "You don't have enough credits for this audit.",
      })
    chargedAmount = cost

    const outcome = await runSeoAudit({
      userId: user.id,
      projectId: id,
      url,
      creditsCharged: cost,
      projectName: project.name,
      onFailedAuditPersisted: (auditId) => {
        failedAuditId = auditId
      },
    })

    return ok({
      auditId: outcome.auditId,
      url: outcome.url,
      score: outcome.score,
      auditScore: outcome.auditScore,
      pagesCrawled: outcome.pagesCrawled,
      findings: outcome.findings,
      recommendations: outcome.recommendations,
      recommendationsMeta: outcome.recommendationsMeta,
      completedAt: outcome.completedAt,
      creditsCharged: cost,
    })
  } catch (e) {
    if (charged && userId && projectId) {
      // Reverse exactly what was charged, then record the real outcome on the
      // failed history row (if it was stored) so the history is truthful.
      const refundStatus = await refundSeoAuditCredits(userId, projectId, chargedAmount, intentKey)
      if (failedAuditId) {
        await markSeoAuditRefund(projectId, failedAuditId, refundStatus, chargedAmount)
      }
    }
    return handleRouteError("api.projects.seoAudit.post", e)
  }
}
