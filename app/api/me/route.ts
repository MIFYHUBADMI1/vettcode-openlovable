import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { getBalance } from "@/lib/credits/credits"
import { isTotalumConfigured } from "@/lib/integrations/totalum/client"
import { isFirecrawlConfigured } from "@/lib/integrations/firecrawl/service"
import { ok, handleRouteError } from "@/lib/api/respond"
import { toPublicUser } from "@/lib/auth/users"
import { singleFlight } from "@/lib/cache/single-flight"

const CACHE_HEADERS = {
  // Private: per-user data, must not be shared by CDN.
  // max-age=10: browser can use cached copy for 10s without hitting server.
  // stale-while-revalidate=30: after expiry, serve stale data for up to 30s
  // while revalidating in the background — eliminates visible loading spinners.
  "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
}

/**
 * Returns the current authenticated user's session info.
 * Private: per-user data, must not be shared by CDN.
 *
 * Uses single-flight deduplication so that concurrent identical requests
 * (e.g. 50 SWR clients hitting /api/me on page load) only hit the DB once.
 * The store's in-memory LRU cache also serves repeated reads within the TTL,
 * but single-flight handles the case where the cache is cold simultaneously
 * for multiple requests.
 */
export async function GET() {
  try {
    const user = await requireUser()

    // Single-flight wrapper: concurrent identical calls share one DB query.
    const fetcher = singleFlight<typeof GET>(`api.me:${user.id}`)
    return fetcher(async () => {
      const [balance, transactions] = await Promise.all([getBalance(user.id), store.listTransactions(user.id, 30)])
      return ok({
        user: toPublicUser(user),
        userId: user.id,
        // `reserve` transactions already debit the balance immediately (see
        // lib/credits/credits.ts), so there is no separate "held" pool to
        // subtract — the full balance is available.
        credits: { balance, reserved: 0, available: balance },
        transactions,
        providers: {
          totalum: isTotalumConfigured(),
          firecrawl: isFirecrawlConfigured(),
        },
      }, { headers: CACHE_HEADERS })
    })
  } catch (e) {
    return handleRouteError("api.me", e)
  }
}
