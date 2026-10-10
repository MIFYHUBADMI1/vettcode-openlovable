import { requireUser } from "@/lib/auth/session"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { checkProjectOwnership } from "@/lib/runtime/ownership"
import { isStudioEnabledForUser } from "@/lib/marketing/feature-flags"
import { isGenerationConfigured } from "@/lib/marketing/studio/generator"
import { getStudioAffordability, chargeStudioCredits, refundStudioCredits } from "@/lib/marketing/studio/credits"
import { generateMarketingDraft, listContentItems, reviseContentItem } from "@/lib/marketing/studio/service"
import { z } from "zod"

/**
 * Marketing Studio endpoint (Phase 4 — W3).
 *
 * Session-authenticated, fail-closed ownership (uniform 404 — no existence leak),
 * rate limited, flag-gated, and credit-charged ONLY for a real generation.
 * GET lists stored drafts (free, read-only). POST generates ONE draft (charged,
 * refunded on failure). PATCH saves a hand-edited version (free, non-destructive,
 * never touches publish state). The generation input is a fixed template + an
 * optional founder brief — there is no client-supplied URL or model here, so no
 * provider/SSRF surface is opened.
 */

const GenerateSchema = z.object({
  template: z.enum(["landing_hero", "feature_blurb", "email_welcome", "ad_headline"]),
  brief: z.string().max(1000).optional(),
}).strip()

const ReviseSchema = z.object({
  contentId: z.string().min(1).max(80),
  body: z.string().min(1).max(20000),
  title: z.string().max(200).optional(),
}).strip()

/** Map a stored doc to the compact, client-safe shape shown in the Studio. */
function present(doc: Awaited<ReturnType<typeof listContentItems>>[number]) {
  return {
    id: doc.id,
    template: doc.template,
    title: doc.title,
    body: doc.body,
    version: doc.version,
    status: doc.status,
    origin: doc.origin,
    creditsCharged: doc.creditsCharged,
    ...(doc.model ? { model: doc.model } : {}),
    updatedAt: doc.updatedAt,
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const ownership = await checkProjectOwnership(user.id, id)
    if (!ownership.ok) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)

    if (!isStudioEnabledForUser(user.id)) {
      return ok({ enabled: false, cost: 0, items: [] })
    }
    const { cost, available } = await getStudioAffordability(user.id)
    const items = await listContentItems(id)
    return ok({ enabled: true, cost, available, items: items.map(present) })
  } catch (e) {
    return handleRouteError("api.projects.contentStudio.get", e)
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let charged = false
  let userId = ""
  let projectId = ""
  try {
    const user = await requireUser()
    userId = user.id
    const { id } = await params
    projectId = id

    await checkRateLimit({ action: "studio_generate", identifier: user.id, limit: 20, windowMs: 60 * 60 * 1000 })

    const ownership = await checkProjectOwnership(user.id, id)
    if (!ownership.ok) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)

    if (!isStudioEnabledForUser(user.id)) {
      return fail("FEATURE_DISABLED", "The Marketing Studio isn't available for this account yet.", 403)
    }
    if (!isGenerationConfigured()) {
      return fail("AI_UNAVAILABLE", "AI generation isn't connected right now.", 503)
    }

    const parsed = GenerateSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return fail("VALIDATION", "Please choose a template.", 422)

    const { cost, available, affordable } = await getStudioAffordability(user.id)
    if (!affordable) return fail("INSUFFICIENT_CREDITS", `This draft costs ${cost} credits and you have ${available}.`, 402)

    charged = await chargeStudioCredits(user.id, id)
    if (!charged) return fail("INSUFFICIENT_CREDITS", "You don't have enough credits for this draft.", 402)

    const draft = await generateMarketingDraft({ userId: user.id, projectId: id, template: parsed.data.template, brief: parsed.data.brief })

    return ok({ ...draft, creditsCharged: cost })
  } catch (e) {
    if (charged && userId && projectId) {
      await refundStudioCredits(userId, projectId)
    }
    return handleRouteError("api.projects.contentStudio.post", e)
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const ownership = await checkProjectOwnership(user.id, id)
    if (!ownership.ok) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)

    if (!isStudioEnabledForUser(user.id)) {
      return fail("FEATURE_DISABLED", "The Marketing Studio isn't available for this account yet.", 403)
    }

    const parsed = ReviseSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return fail("VALIDATION", "Please provide the edited copy.", 422)

    // Editing a draft is free and non-destructive (appends a version).
    const doc = await reviseContentItem({ userId: user.id, projectId: id, contentId: parsed.data.contentId, body: parsed.data.body, title: parsed.data.title })
    return ok(present(doc))
  } catch (e) {
    return handleRouteError("api.projects.contentStudio.patch", e)
  }
}
