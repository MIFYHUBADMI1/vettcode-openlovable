import { z } from "zod"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { requireStudioProject } from "@/lib/marketing/studio/api-guard"
import { presentContentItem } from "@/lib/marketing/studio/present"
import {
  deleteContentItem,
  duplicateContentItem,
  saveContentVariant,
  updateContentItem,
} from "@/lib/marketing/studio/library"

/**
 * One stored item, project-scoped.
 *
 * PATCH  — library metadata only (title / status / planned date / tags). The
 *          BODY is never edited here; body edits use the immutable version path.
 * POST   — { action: "duplicate" } or { action: "save_variant", title, body }.
 * DELETE — remove this item. Destructive actions are confirmed by the UI.
 *
 * Every handler looks the item up BY project id, so an id from another project
 * resolves to the same 404 as a nonexistent one.
 */

const PatchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    status: z.enum(["draft", "ready_for_review"]).optional(),
    plannedAt: z.number().int().min(0).nullable().optional(),
    tags: z.array(z.string().max(40)).max(12).nullable().optional(),
  })
  .strict()

const PostSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("duplicate") }).strict(),
  z
    .object({
      action: z.literal("save_variant"),
      title: z.string().min(1).max(160),
      body: z.string().min(1).max(20000),
    })
    .strict(),
])

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; contentId: string }> },
) {
  try {
    const { id, contentId } = await params
    const guard = await requireStudioProject(id)
    if (!guard.ok) return guard.response

    const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return fail("VALIDATION", "Please check those changes.", 422)

    const doc = await updateContentItem({ projectId: id, contentId, ...parsed.data })
    if (!doc) return fail("NOT_FOUND", "We couldn't find that draft.", 404)
    return ok({ item: presentContentItem(doc) })
  } catch (e) {
    return handleRouteError("api.projects.studio.library.patch", e)
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; contentId: string }> },
) {
  try {
    const { id, contentId } = await params
    const guard = await requireStudioProject(id)
    if (!guard.ok) return guard.response

    const parsed = PostSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return fail("VALIDATION", "Unknown library action.", 422)

    const doc =
      parsed.data.action === "duplicate"
        ? await duplicateContentItem({ userId: guard.user.id, projectId: id, contentId })
        : await saveContentVariant({
            userId: guard.user.id,
            projectId: id,
            sourceId: contentId,
            title: parsed.data.title,
            body: parsed.data.body,
          })

    return ok({ item: presentContentItem(doc) })
  } catch (e) {
    return handleRouteError("api.projects.studio.library.post", e)
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; contentId: string }> },
) {
  try {
    const { id, contentId } = await params
    const guard = await requireStudioProject(id)
    if (!guard.ok) return guard.response

    const deleted = await deleteContentItem({ projectId: id, contentId })
    if (!deleted) return fail("NOT_FOUND", "We couldn't find that draft.", 404)
    return ok({ deleted: true })
  } catch (e) {
    return handleRouteError("api.projects.studio.library.delete", e)
  }
}
