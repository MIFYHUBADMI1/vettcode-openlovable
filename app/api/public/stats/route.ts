import { usersCol } from "@/lib/db/collections"
import { ok, handleRouteError } from "@/lib/api/respond"
import { singleFlight } from "@/lib/cache/single-flight"

/**
 * Public endpoint: returns a rounded user count for social proof on the landing page.
 *
 * Single-flight deduplication prevents thundering herds when many concurrent
 * visitors hit the landing page simultaneously.
 */
export async function GET() {
  try {
    const fetcher = singleFlight<typeof GET>("api.public.stats")
    return fetcher(async () => {
      const col = await usersCol()
      const total = await col.countDocuments({ deletedAt: { $exists: false } })
      // Round down to nearest 50 for a clean range display (e.g. 372 → 350+, 1200 → 1200+)
      const rounded = Math.floor(total / 50) * 50
      return ok({ builders: rounded })
    })
  } catch (e) {
    return handleRouteError("api.public.stats", e)
  }
}
