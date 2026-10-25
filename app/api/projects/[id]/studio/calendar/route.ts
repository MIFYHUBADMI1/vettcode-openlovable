import { z } from "zod"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { requireStudioProject } from "@/lib/marketing/studio/api-guard"
import { presentContentItem } from "@/lib/marketing/studio/present"
import { listPlannedContent } from "@/lib/marketing/studio/library"

/**
 * GET /api/projects/:id/studio/calendar?from=&to=
 *
 * Planned content only (`plannedAt` set), bounded by an optional window.
 * These are PLANS: nothing is scheduled with an external platform, and a past
 * date never means a post was published.
 */

const QuerySchema = z.object({
  from: z.coerce.number().int().min(0).optional(),
  to: z.coerce.number().int().min(0).optional(),
})

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const guard = await requireStudioProject(id)
    if (!guard.ok) return guard.response

    const url = new URL(req.url)
    const parsed = QuerySchema.safeParse({
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    })
    if (!parsed.success) return fail("VALIDATION", "That date range is invalid.", 422)

    const items = await listPlannedContent(id, parsed.data)
    return ok({ items: items.map(presentContentItem) })
  } catch (e) {
    return handleRouteError("api.projects.studio.calendar.get", e)
  }
}
