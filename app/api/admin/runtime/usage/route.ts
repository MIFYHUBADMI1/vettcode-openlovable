import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/auth/session"
import { ok, handleRouteError } from "@/lib/api/respond"
import { runtimeUsageCol } from "@/lib/db/runtime-collections"
import { usersCol, projectsCol } from "@/lib/db/collections"

/**
 * GET /api/admin/runtime/usage
 *
 * Admin runtime usage + financial view (Phase 9.5 §29/§30/§49). Read-only
 * aggregation derived DIRECTLY from runtime_usage records (§54 — no cached
 * counters that can drift) plus the shared credit_ledger for correlation.
 *
 * Query params: limit, offset, projectId, userId, provider, capability,
 *               operation, environment, status, since, until
 *
 * Safe display only: API-key IDs (never plaintext/prefix-as-identity beyond
 * what usage already carries), no secrets, no request payloads (§63/§49).
 */

const USAGE_SORT_INDEXES = { createdAt: -1 } as const

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = request.nextUrl
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "50", 10), 1), 200)
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0)
    const projectId = searchParams.get("projectId") ?? ""
    const userId = searchParams.get("userId") ?? ""
    const provider = searchParams.get("provider") ?? ""
    const capability = searchParams.get("capability") ?? ""
    const operation = searchParams.get("operation") ?? ""
    const environment = searchParams.get("environment") ?? ""
    const status = searchParams.get("status") ?? ""
    const since = parseInt(searchParams.get("since") ?? "", 10)
    const until = parseInt(searchParams.get("until") ?? "", 10)

    const filter: Record<string, unknown> = {}
    if (projectId) filter.projectId = projectId
    if (userId) filter.userId = userId
    if (provider) filter.provider = provider
    if (capability) filter.capability = capability
    if (operation) filter.operation = operation
    if (environment) filter.environment = environment
    if (status === "succeeded" || status === "failed") filter.status = status
    if (Number.isFinite(since) || Number.isFinite(until)) {
      filter.createdAt = {
        ...(Number.isFinite(since) ? { $gte: since } : {}),
        ...(Number.isFinite(until) ? { $lte: until } : {}),
      }
    }

    const col = await runtimeUsageCol()
    const [total, records] = await Promise.all([
      col.countDocuments(filter),
      col
        .find(filter)
        .sort(USAGE_SORT_INDEXES)
        .skip(offset)
        .limit(limit)
        .toArray(),
    ])

    // Enrich with safe user/project display metadata.
    const userIds = [...new Set(records.map((r) => r.userId))]
    const projectIds = [...new Set(records.map((r) => r.projectId))]
    const [users, projects] = await Promise.all([
      userIds.length ? (await usersCol()).find({ id: { $in: userIds } }).project<{ id: string; name?: string; email?: string }>({ id: 1, name: 1, email: 1 }).toArray() : Promise.resolve([]),
      projectIds.length ? (await projectsCol()).find({ id: { $in: projectIds } }).project<{ id: string; name?: string }>({ id: 1, name: 1 }).toArray() : Promise.resolve([]),
    ])
    const userMap = new Map(users.map((u) => [u.id, u]))
    const projectMap = new Map(projects.map((p) => [p.id, p]))

    return ok({
      records: records.map((r) => {
        const meta = (r.costMetadata ?? {}) as Record<string, unknown>
        const providerCost = meta.providerCost
        return {
          id: r.id,
          requestId: r.requestId,
          userId: r.userId,
          userName: userMap.get(r.userId)?.name,
          userEmail: userMap.get(r.userId)?.email,
          projectId: r.projectId,
          projectName: projectMap.get(r.projectId)?.name,
          apiKeyId: r.apiKeyId,
          environment: r.environment,
          capability: r.capability,
          operation: r.operation,
          provider: r.provider,
          model: r.model,
          status: r.status,
          latencyMs: r.latencyMs,
          usage: r.usage,
          creditsCharged: r.creditsCharged,
          // Financial metadata (Phase 9.5): pricing snapshot + provider cost.
          pricingRuleId: meta.pricingRuleId ?? null,
          pricingSource: meta.pricingSource ?? null,
          pricingVersion: meta.pricingVersion ?? null,
          ledgerIdempotencyKey: meta.ledgerIdempotencyKey ?? null,
          providerCost:
            providerCost === undefined || providerCost === null
              ? null // unavailable — distinct from a known zero (§82)
              : providerCost,
          providerCostCurrency: meta.providerCostCurrency ?? null,
          providerCostSource: meta.providerCostSource ?? "unavailable",
          errorCategory: r.errorCategory,
          createdAt: r.createdAt,
        }
      }),
      total,
      offset,
      limit,
      hasMore: offset + limit < total,
    })
  } catch (e) {
    return handleRouteError("api.admin.runtime.usage", e)
  }
}
