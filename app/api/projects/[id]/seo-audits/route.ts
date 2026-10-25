import { z } from "zod"
import { requireUser } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { checkProjectOwnership } from "@/lib/runtime/ownership"
import { isSeoAuditEnabledForUser } from "@/lib/marketing/feature-flags"
import { listSeoAudits, SEO_HISTORY_DEFAULT_LIMIT, SEO_HISTORY_MAX_LIMIT } from "@/lib/marketing/seo/service"

/**
 * GET /api/projects/:id/seo-audits — bounded, newest-first audit history.
 *
 * Read-only and free. Session-authenticated, ownership-gated with a uniform
 * 404, and paginated with an opaque cursor so a project's full history is
 * never returned in one request. Rows are summaries: open a row through
 * /api/projects/:id/seo-audits/:auditId for the full findings.
 */

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(SEO_HISTORY_MAX_LIMIT).optional(),
  cursor: z.string().min(1).max(200).optional(),
})

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params

    const ownership = await checkProjectOwnership(user.id, id)
    if (!ownership.ok) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)

    if (!isSeoAuditEnabledForUser(user.id)) {
      return ok({ enabled: false, audits: [], nextCursor: null })
    }

    const url = new URL(req.url)
    const parsed = QuerySchema.safeParse({
      limit: url.searchParams.get("limit") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    })
    if (!parsed.success) return fail("VALIDATION", "That history request is invalid.", 422)

    const { audits, nextCursor } = await listSeoAudits(id, {
      limit: parsed.data.limit ?? SEO_HISTORY_DEFAULT_LIMIT,
      cursor: parsed.data.cursor,
    })

    return ok({ enabled: true, audits, nextCursor })
  } catch (e) {
    return handleRouteError("api.projects.seoAudits.list", e)
  }
}
