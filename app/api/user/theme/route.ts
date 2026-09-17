import { requireUser } from "@/lib/auth/session"
import { usersCol } from "@/lib/db/collections"
import { ok, fail, handleRouteError } from "@/lib/api/respond"

export type Theme = "system" | "dark" | "light" | "light-blue" | "glass"
const VALID_THEMES: Theme[] = ["system", "dark", "light", "light-blue", "glass"]

/** GET /api/user/theme — returns the user's saved theme preference */
export async function GET() {
  try {
    const user = await requireUser()
    const col = await usersCol()
    const doc = await col.findOne({ id: user.id }, { projection: { theme: 1 } })
    return ok({ theme: (doc?.theme ?? "system") as Theme })
  } catch (e) {
    return handleRouteError("api.user.theme.get", e)
  }
}

/** PATCH /api/user/theme — saves the user's theme preference */
export async function PATCH(req: Request) {
  try {
    const user = await requireUser()
    const body = (await req.json().catch(() => ({}))) as { theme?: unknown }

    if (!body.theme || !VALID_THEMES.includes(body.theme as Theme)) {
      return fail(
        "VALIDATION",
        `Invalid theme. Must be one of: ${VALID_THEMES.join(", ")}`,
        422,
      )
    }

    const theme = body.theme as Theme
    const col = await usersCol()
    await col.updateOne({ id: user.id }, { $set: { theme, updatedAt: Date.now() } })

    return ok({ theme })
  } catch (e) {
    return handleRouteError("api.user.theme.patch", e)
  }
}
