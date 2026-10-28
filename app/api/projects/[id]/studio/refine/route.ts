import { z } from "zod"
import { fail, failInsufficientCredits, handleRouteError, ok } from "@/lib/api/respond"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { requireStudioProject } from "@/lib/marketing/studio/api-guard"
import { getBrandProfile, brandContextLines } from "@/lib/marketing/studio/brand"
import { getContentItem } from "@/lib/marketing/studio/library"
import { getStudioAffordability, chargeStudioCredits, refundStudioCredits } from "@/lib/marketing/studio/credits"
import { scopedIntentKey } from "@/lib/billing/operation-identity"
import { REFINEMENT_ACTIONS, generateRefinement } from "@/lib/marketing/studio/refine"

/**
 * POST /api/projects/:id/studio/refine
 *
 * Produces ONE refined proposal for an existing draft. It does NOT save: the
 * founder applies it through the immutable version path, so the current draft
 * is preserved if the model fails or the result is unwanted.
 *
 * Charged like a generation (existing studio cost) and refunded on failure.
 */

const BodySchema = z
  .object({
    contentId: z.string().min(1).max(80),
    action: z.enum(REFINEMENT_ACTIONS),
    instruction: z.string().max(600).optional(),
    audience: z.string().max(400).optional(),
    channel: z.string().max(80).optional(),
    /** Optional client retry key so a retried request cannot double-charge. */
    requestId: z.string().min(8).max(80).optional(),
  })
  .strict()

import { withAiProtection } from "@/lib/api/ai-protection"

export const POST = withAiProtection("studio", post)

async function post(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    await checkRateLimit({ action: "studio_refine", identifier: userId, limit: 20, windowMs: 60 * 60 * 1000 })

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return fail("VALIDATION", "Please choose what to change.", 422)

    const item = await getContentItem(id, parsed.data.contentId)
    if (!item) return fail("NOT_FOUND", "We couldn't find that draft.", 404)

    const { cost, available, affordable } = await getStudioAffordability(userId)
    if (!affordable) {
      return failInsufficientCredits({
        required: cost,
        available,
        message: `This rewrite costs ${cost} credits and you have ${available}.`,
      })
    }

    // Phase 3 (Workstream C): the client's requestId only NAMES a retry — it is
    // never authorization. `scopedIntentKey` validates it and binds it to the
    // session user, this operation, and the ownership-checked project before it
    // can reach the ledger. Without that scoping two different users who reuse
    // the same string would collide on the ledger's GLOBAL unique idempotency
    // index, and the second one's rewrite would be silently "already applied"
    // — i.e. free. An unusable intent yields `undefined`, so the charge falls
    // back to its previous per-attempt key rather than an ambiguous one.
    const intentKey = scopedIntentKey(parsed.data.requestId, {
      userId,
      operation: "studio_refine",
      projectId: id,
    })
    charged = await chargeStudioCredits(userId, id, intentKey)
    chargeIntentKey = intentKey ?? ""
    if (!charged)
      return failInsufficientCredits({
        required: cost,
        available,
        message: "You don't have enough credits for this rewrite.",
      })

    const { lines } = brandContextLines(await getBrandProfile(id))
    const result = await generateRefinement({
      title: item.title,
      body: item.body,
      action: parsed.data.action,
      brandLines: lines,
      ...(parsed.data.instruction ? { instruction: parsed.data.instruction } : {}),
      ...(parsed.data.audience ? { audience: parsed.data.audience } : {}),
      ...(parsed.data.channel ? { channel: parsed.data.channel } : {}),
    })

    return ok({ body: result.body, model: result.model, contentId: item.id, creditsCharged: cost })
  } catch (e) {
    if (charged && userId && projectId) await refundStudioCredits(userId, projectId, chargeIntentKey || undefined)
    return handleRouteError("api.projects.studio.refine.post", e)
  }
}
