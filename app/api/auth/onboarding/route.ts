import { requireUser } from "@/lib/auth/session"
import { ok, handleRouteError } from "@/lib/api/respond"
import { usersCol } from "@/lib/db/collections"

/** Save onboarding answers for the current user. */
export async function POST(req: Request) {
  try {
    const user = await requireUser()

    const body = (await req.json().catch(() => ({}))) as {
      source?: string
      role?: string
      signalType?: "url" | "idea"
    }

    const col = await usersCol()
    await col.updateOne(
      { id: user.id },
      {
        $set: {
          onboarding: {
            source: body.source || undefined,
            role: body.role || undefined,
            signalType: body.signalType || undefined,
            completedAt: Date.now(),
          },
          updatedAt: Date.now(),
        },
      },
    )

    return ok({ saved: true })
  } catch (e) {
    return handleRouteError("api.auth.onboarding", e)
  }
}
