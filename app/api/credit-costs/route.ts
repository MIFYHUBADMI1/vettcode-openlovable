import { getCreditCosts } from "@/lib/integrations/totalum/service"
import { isTotalumConfigured } from "@/lib/integrations/totalum/client"
import { estimateInitialBuild, estimateFollowup, getTierCost } from "@/lib/credits/credits"
import { getBuildCost } from "@/lib/billing/build-auth"
import { ok, handleRouteError } from "@/lib/api/respond"
import { singleFlight } from "@/lib/cache/single-flight"

/**
 * Exposes Atai's own estimated pricing plus, when configured, the live
 * Totalum provider costs. Atai prices are never hard-coded to a single
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

      // Per-tier display costs resolved from the same server helpers the
      // launch path uses (getTierCost / getBuildCost), so UI numbers can
      // never drift from what the server actually charges.
      const [simple, medium, complex] = await Promise.all([
        getTierCost("simple", "legacy"),
        getTierCost("medium", "legacy"),
        getTierCost("complex", "legacy"),
      ])
      const [simpleHeavy, mediumHeavy, complexHeavy] = await Promise.all([
        getTierCost("simple", "heavy"),
        getTierCost("medium", "heavy"),
        getTierCost("complex", "heavy"),
      ])

      return ok({
        configured,
        Atai: {
          initialBuild: estimateInitialBuild(),
          followup: estimateFollowup(),
        },
        provider: providerCosts,
        // Structured per-tier costs for client display (lib/client/build-costs.ts).
        buildTiers: {
          simple: { label: "Simple", legacy: simple, heavy: simpleHeavy },
          medium: { label: "Medium", legacy: medium, heavy: mediumHeavy },
          complex: { label: "Complex", legacy: complex, heavy: complexHeavy },
        },
        // Follow-ups are charged at the same tier cost as the initial build
        // (see app/api/projects/[id]/agent/route.ts → getBuildCost).
        followupByTier: {
          simple: await getBuildCost("simple"),
          medium: await getBuildCost("medium"),
          complex: await getBuildCost("complex"),
        },
      })
    })
  } catch (e) {
    return handleRouteError("api.credit-costs", e)
  }
}
