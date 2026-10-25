import { z } from "zod"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { requireStudioProject } from "@/lib/marketing/studio/api-guard"
import { getBrandProfile, brandContextLines } from "@/lib/marketing/studio/brand"
import { getContentItem } from "@/lib/marketing/studio/library"
import { getStudioAffordability, chargeStudioCredits, refundStudioCredits } from "@/lib/marketing/studio/credits"
import { scopedIntentKey } from "@/lib/billing/operation-identity"
import { generateVariations } from "@/lib/marketing/studio/refine"

/**
 * POST /api/projects/:id/studio/variations
 *
 * Returns 1–4 alternative drafts for an existing item. Nothing is saved: the
 * founder saves the alternatives they want as separate drafts through
 * `POST /studio/library/:contentId` with `action: "save_variant"`, so the
 * original is never overwritten and rejected variants cost no storage.
 *
 * Charged once per request (the existing studio cost) and refunded on failure.
 */

const BodySchema = z
  .object({
    contentId: z.string().min(1).max(80),
    count: z.coerce.number().int().min(1).max(4).default(3),
    angle: z.string().max(400).optional(),
    requestId: z.string().min(8).max(80).optional(),
  })
  .strict()

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let charged = false
  let userId = ""
  let projectId = ""
  let chargeIntentKey = ""
  try {
    const { id } = await params
    projectId = id
    const guard = await requireStudioProject(id)
    if (!guard.ok) return guard.response
    userId = guard.user.id

    await checkRateLimit({ action: "studio_variations", identifier: userId, limit: 20, windowMs: 60 * 60 * 1000 })

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return fail("VALIDATION", "Please check the variation request.", 422)

    const item = await getContentItem(id, parsed.data.contentId)
    if (!item) return fail("NOT_FOUND", "We couldn't find that draft.", 404)

    const { cost, available, affordable } = await getStudioAffordability(userId)
    if (!affordable) {
      return fail("INSUFFICIENT_CREDITS", `This costs ${cost} credits and you have ${available}.`, 402)
    }

    // Phase 3 (Workstream C): same identity discipline as /studio/refine — the
    // client string is validated and scoped by user + operation + project, so it
    // can name a retry for THIS caller only. The operation is distinct from
    // "studio_refine", so one requestId can never alias a different billable
    // operation into a free one.
    const intentKey = scopedIntentKey(parsed.data.requestId, {
      userId,
      operation: "studio_variations",
      projectId: id,
    })
    charged = await chargeStudioCredits(userId, id, intentKey)
    chargeIntentKey = intentKey ?? ""
    if (!charged) return fail("INSUFFICIENT_CREDITS", "You don't have enough credits for variations.", 402)

    const { lines } = brandContextLines(await getBrandProfile(id))
    const result = await generateVariations({
      title: item.title,
      body: item.body,
      count: parsed.data.count,
      brandLines: lines,
      ...(parsed.data.angle ? { angle: parsed.data.angle } : {}),
    })

    return ok({
      contentId: item.id,
      variants: result.variants,
      model: result.model,
      creditsCharged: cost,
    })
  } catch (e) {
    if (charged && userId && projectId) await refundStudioCredits(userId, projectId, chargeIntentKey || undefined)
    return handleRouteError("api.projects.studio.variations.post", e)
  }
}
