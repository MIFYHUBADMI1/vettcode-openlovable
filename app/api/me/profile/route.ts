import { requireUser } from "@/lib/auth/session"
import { usersCol } from "@/lib/db/collections"
import { ok, fail, handleRouteError } from "@/lib/api/respond"

/**
 * PATCH /api/me/profile
 * Updates the current user's display name.
 */
export async function PATCH(req: Request) {
  try {
    const user = await requireUser()
    const body = (await req.json().catch(() => ({}))) as { name?: string }

    const name = body.name?.trim()
    if (!name || name.length < 1) return fail("VALIDATION", "Name is required.", 422)
    if (name.length > 80) return fail("VALIDATION", "Name must be 80 characters or fewer.", 422)

    const col = await usersCol()
    await col.updateOne(
      { id: user.id },
      { $set: { name, updatedAt: Date.now() } },
    )

    return ok({ name })
  } catch (e) {
    return handleRouteError("api.me.profile", e)
  }
}
