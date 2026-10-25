import { z } from "zod"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { requireStudioProject } from "@/lib/marketing/studio/api-guard"
import { presentContentItem } from "@/lib/marketing/studio/present"
import {
  LIBRARY_DEFAULT_LIMIT,
  LIBRARY_KINDS,
  LIBRARY_STATUSES,
  searchContentItems,
} from "@/lib/marketing/studio/library"

/**
 * GET /api/projects/:id/studio/library — bounded, newest-first content search.
 *
 * Free and read-only. Filters: `q` (title/body), `kind`, `status`, `planned`,
 * plus an opaque cursor. Never returns the project's whole library at once.
 */

const QuerySchema = z.object({
  q: z.string().max(100).optional(),
  kind: z.enum(LIBRARY_KINDS).optional(),
  status: z.enum(["draft", "ready_for_review"]).optional(),
  planned: z.enum(["any", "planned", "unplanned"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().min(1).max(200).optional(),
})

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const guard = await requireStudioProject(id)
    if (!guard.ok) return guard.response

    const url = new URL(req.url)
    const parsed = QuerySchema.safeParse({
      q: url.searchParams.get("q") ?? undefined,
      kind: url.searchParams.get("kind") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      planned: url.searchParams.get("planned") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    })
    if (!parsed.success) return fail("VALIDATION", "That library filter is invalid.", 422)

    const { items, nextCursor } = await searchContentItems(id, {
      ...parsed.data,
      limit: parsed.data.limit ?? LIBRARY_DEFAULT_LIMIT,
    })

    return ok({
      items: items.map(presentContentItem),
      nextCursor,
      statuses: LIBRARY_STATUSES,
    })
  } catch (e) {
    return handleRouteError("api.projects.studio.library.get", e)
  }
}
