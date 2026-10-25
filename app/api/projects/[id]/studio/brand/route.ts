import { z } from "zod"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { requireStudioProject } from "@/lib/marketing/studio/api-guard"
import { getBrandProfile, saveBrandProfile } from "@/lib/marketing/studio/brand"

/**
 * GET  /api/projects/:id/studio/brand — current brand profile (free).
 * PUT  /api/projects/:id/studio/brand — create/replace it (free, reversible).
 *
 * Project-scoped and founder-authored. Clearing a field sends "" or null and
 * genuinely removes it; nothing here is a measured signal.
 */

const BrandSchema = z
  .object({
    brandName: z.string().max(200).nullish(),
    description: z.string().max(1200).nullish(),
    tone: z.string().max(200).nullish(),
    audience: z.string().max(200).nullish(),
    valueProposition: z.string().max(1200).nullish(),
    differentiators: z.array(z.string().max(60)).max(12).nullish(),
    vocabulary: z.array(z.string().max(60)).max(12).nullish(),
    avoid: z.array(z.string().max(60)).max(12).nullish(),
    callToAction: z.string().max(200).nullish(),
  })
  .strict()

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const guard = await requireStudioProject(id)
    if (!guard.ok) return guard.response

    const profile = await getBrandProfile(id)
    return ok({ enabled: true, profile })
  } catch (e) {
    return handleRouteError("api.projects.studio.brand.get", e)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const guard = await requireStudioProject(id)
    if (!guard.ok) return guard.response

    await checkRateLimit({ action: "studio_brand_save", identifier: guard.user.id, limit: 60, windowMs: 60 * 60 * 1000 })

    const parsed = BrandSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return fail("VALIDATION", "Please check the brand settings.", 422)

    const profile = await saveBrandProfile({ userId: guard.user.id, projectId: id, ...parsed.data })
    return ok({ profile })
  } catch (e) {
    return handleRouteError("api.projects.studio.brand.put", e)
  }
}
