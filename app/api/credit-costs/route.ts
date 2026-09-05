import { getCreditCosts } from "@/lib/integrations/totalum/service"
import { isTotalumConfigured } from "@/lib/integrations/totalum/client"
import { estimateInitialBuild, estimateFollowup } from "@/lib/credits/credits"
import { ok, handleRouteError } from "@/lib/api/respond"
import { singleFlight } from "@/lib/cache/single-flight"

/**
 * Exposes MirrorSite's own estimated pricing plus, when configured, the live
 * Totalum provider costs. MirrorSite prices are never hard-coded to a single
 * value — they are estimates with margin (spec sections 22 & 23).
 *
 * Single-flight deduplication prevents thundering herds when many clients
 * fetch pricing simultaneously (e.g. on the pricing page or checkout).
 */
export async function GET() {
  try {
    const fetcher = singleFlight<Response>("api.credit-costs")
    return fetcher(async () => {
      const configured = isTotalumConfigured()
      let providerCosts: unknown = null
      if (configured) {
        try {
          providerCosts = await getCreditCosts()
        } catch {
          providerCosts = null
        }
      }
      return ok({
        configured,
        mirrorSite: {
          initialBuild: estimateInitialBuild(),
          followup: estimateFollowup(),
        },
        provider: providerCosts,
      })
    })
  } catch (e) {
    return handleRouteError("api.credit-costs", e)
  }
}
