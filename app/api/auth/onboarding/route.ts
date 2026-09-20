import { requireUser } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { usersCol } from "@/lib/db/collections"
import type { UserOnboarding } from "@/lib/types/db"

/**
 * POST /api/auth/onboarding
 *
 * Server is the source of truth.
 * - dismissed: overlay skipped — does NOT count as product activation
 * - activated: a project was created — sets completedAt
 * Existing fields are merged so we never wipe historical role/source data.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser()

    const body = (await req.json().catch(() => ({}))) as {
      businessDescription?: string
      role?: string
      destination?: string
      source?: string
      signalType?: "url" | "idea"
      dismissed?: boolean
      activated?: boolean
    }

    if (body.dismissed && body.activated) {
      return fail("VALIDATION", "Cannot dismiss and activate in the same request.", 422)
    }

    const col = await usersCol()
    const existing = (user.onboarding ?? {}) as UserOnboarding
    const now = Date.now()

    const next: UserOnboarding = {
      ...existing,
      businessDescription: body.businessDescription?.trim() || existing.businessDescription,
      role: body.role?.trim() || existing.role,
      destination: body.destination || existing.destination,
      source: body.source || existing.source,
      signalType: body.signalType || existing.signalType,
    }

    if (body.dismissed) {
      next.dismissedAt = existing.dismissedAt ?? now
    }
    if (body.activated) {
      next.completedAt = existing.completedAt ?? now
    }

    await col.updateOne(
      { id: user.id },
      {
        $set: {
          onboarding: next,
          updatedAt: now,
        },
      },
    )

    return ok({ saved: true, onboarding: next })
  } catch (e) {
    return handleRouteError("api.auth.onboarding", e)
  }
}
