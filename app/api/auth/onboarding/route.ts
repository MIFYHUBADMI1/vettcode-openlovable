import { requireUser } from "@/lib/auth/session"
import { ok, handleRouteError } from "@/lib/api/respond"
import { usersCol } from "@/lib/db/collections"

/**
 * POST /api/auth/onboarding
 *
 * Saves onboarding answers for the current user.
 * Accepts the new founder-focused fields from Requirement 6:
 *  - businessDescription: what the user's business does (Step 1)
 *  - role: founder role selection (Step 2)
 *  - destination: where the user chose to start (Step 3)
 *
 * Legacy fields (source, signalType) are also accepted for backward compatibility.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser()

    const body = (await req.json().catch(() => ({}))) as {
      // New fields (Requirement 6)
      businessDescription?: string
      role?: string
      destination?: string
      // Legacy fields (kept for backward compatibility)
      source?: string
      signalType?: "url" | "idea"
    }

    const col = await usersCol()
    await col.updateOne(
      { id: user.id },
      {
        $set: {
          onboarding: {
            // New founder-focused fields
            businessDescription: body.businessDescription?.trim() || undefined,
            role: body.role?.trim() || undefined,
            destination: body.destination || undefined,
            // Legacy fields — preserved if provided
            source: body.source || undefined,
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
