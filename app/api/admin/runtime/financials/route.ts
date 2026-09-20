import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/auth/session"
import { ok, handleRouteError } from "@/lib/api/respond"
import { runtimeUsageCol } from "@/lib/db/runtime-collections"

/**
 * GET /api/admin/runtime/financials
 *
 * Admin runtime financial summary (Phase 9.5 §30/§31/§53/§104). Every metric
 * is derived from the authoritative runtime_usage records at query time —
 * no cached counters, always reconcilable (§54). Filters: since/until,
 * projectId, provider, capability, environment.
 *
 * Metric definitions (§31 — documented, never silently mixed):
 *   - requests          : runtime request events recorded (succeeded + failed)
 *   - succeeded/failed  : outcome split of those events
 *   - creditsCharged    : Atai credits actually deducted for billable events
 *   - providerCostTotal : SUM of provider-reported costs WHERE AVAILABLE —
 *                         reported in each cost's own currency; "unavailable"
 *                         counts requests with no usable provider cost and is
 *                         NEVER treated as $0 (§30/§82).
 *   - No "profit" metric: Atai credits and provider currency are different
 *     units; no authoritative conversion exists in the repo (§52/§81).
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = request.nextUrl
    const since = parseInt(searchParams.get("since") ?? "", 10)
    const until = parseInt(searchParams.get("until") ?? "", 10)
    const projectId = searchParams.get("projectId") ?? ""
    const provider = searchParams.get("provider") ?? ""
    const capability = searchParams.get("capability") ?? ""
    const environment = searchParams.get("environment") ?? ""

    const filter: Record<string, unknown> = {}
    if (Number.isFinite(since) || Number.isFinite(until)) {
      filter.createdAt = {
        ...(Number.isFinite(since) ? { $gte: since } : {}),
        ...(Number.isFinite(until) ? { $lte: until } : {}),
      }
    }
    if (projectId) filter.projectId = projectId
    if (provider) filter.provider = provider
    if (capability) filter.capability = capability
    if (environment) filter.environment = environment

    const col = await runtimeUsageCol()
    const pipeline: Record<string, unknown>[] = [{ $match: filter }]

    const [summary, byProvider, byCapability, byOperation, daily] = await Promise.all([
      col
        .aggregate<{ _id: null; requests: number; succeeded: number; failed: number; creditsCharged: number }>([
          ...pipeline,
          {
            $group: {
              _id: null,
              requests: { $sum: 1 },
              succeeded: { $sum: { $cond: [{ $eq: ["$status", "succeeded"] }, 1, 0] } },
              failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
              creditsCharged: { $sum: "$creditsCharged" },
            },
          },
        ])
        .toArray(),
      col
        .aggregate<{ _id: string; requests: number; creditsCharged: number; providerCost: number; providerCostKnown: number }>([
          ...pipeline,
          {
            $group: {
              _id: "$provider",
              requests: { $sum: 1 },
              creditsCharged: { $sum: "$creditsCharged" },
              providerCost: { $sum: "$costMetadata.providerCost" },
              // Count only records where a numeric provider cost exists.
              providerCostKnown: { $sum: { $cond: [{ $gt: ["$costMetadata.providerCost", null] }, 1, 0] } },
            },
          },
          { $sort: { requests: -1 } },
          { $limit: 20 },
        ])
        .toArray(),
      col
        .aggregate<{ _id: string; requests: number; creditsCharged: number }>([
          ...pipeline,
          { $group: { _id: "$capability", requests: { $sum: 1 }, creditsCharged: { $sum: "$creditsCharged" } } },
          { $sort: { requests: -1 } },
          { $limit: 20 },
        ])
        .toArray(),
      col
        .aggregate<{ _id: { capability: string; operation: string }; requests: number; creditsCharged: number }>([
          ...pipeline,
          {
            $group: {
              _id: { capability: "$capability", operation: "$operation" },
              requests: { $sum: 1 },
              creditsCharged: { $sum: "$creditsCharged" },
            },
          },
          { $sort: { creditsCharged: -1 } },
          { $limit: 20 },
        ])
        .toArray(),
      col
        .aggregate<{ _id: string; requests: number; creditsCharged: number }>([
          ...pipeline,
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$createdAt" } },
              },
              requests: { $sum: 1 },
              creditsCharged: { $sum: "$creditsCharged" },
            },
          },
          { $sort: { _id: 1 } },
          { $limit: 90 },
        ])
        .toArray(),
    ])

    return ok({
      summary: summary[0] ?? { requests: 0, succeeded: 0, failed: 0, creditsCharged: 0 },
      breakdown: {
        byProvider,
        byCapability,
        byOperation,
        daily,
      },
    })
  } catch (e) {
    return handleRouteError("api.admin.runtime.usage", e)
  }
}
