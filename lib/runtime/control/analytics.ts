import "server-only"
import { runtimeUsageCol, ensureRuntimeIndexes } from "@/lib/db/runtime-collections"
import type { RuntimeUsageEvent, RuntimeEnvironment } from "@/runtime/contracts/capabilities"
import { toPublicUsageEvent, publicCost } from "./usage-public"
import type { PublicUsageEvent, UsageSummary } from "./types"

const MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1000
const DEFAULT_LIST_LIMIT = 25
const MAX_LIST_LIMIT = 100

export interface UsageQuery {
  from?: number
  to?: number
  environment?: RuntimeEnvironment
  capability?: string
  model?: string
  status?: "succeeded" | "failed"
  apiKeyId?: string
  /** Optional exact correlation filter (request explorer search). */
  requestId?: string
  cursor?: string
  limit?: number
}

function clampRange(from: number | undefined, to: number | undefined): { from: number; to: number } {
  const now = Date.now()
  const end = to && Number.isFinite(to) ? Math.min(to, now + 60_000) : now
  let start = from && Number.isFinite(from) ? from : end - 24 * 60 * 60 * 1000
  if (end - start > MAX_RANGE_MS) start = end - MAX_RANGE_MS
  if (start > end) start = end - 24 * 60 * 60 * 1000
  return { from: start, to: end }
}

function parseCursor(cursor: string | undefined): { createdAt: number; id: string } | null {
  if (!cursor) return null
  const idx = cursor.indexOf("_")
  if (idx <= 0) return null
  const createdAt = Number(cursor.slice(0, idx))
  const id = cursor.slice(idx + 1)
  if (!Number.isFinite(createdAt) || !id) return null
  return { createdAt, id }
}

function encodeCursor(createdAt: number, id: string): string {
  return `${createdAt}_${id}`
}

function matchFilter(projectId: string, q: UsageQuery, range: { from: number; to: number }): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    projectId,
    createdAt: { $gte: range.from, $lte: range.to },
  }
  if (q.environment) filter.environment = q.environment
  if (q.capability) filter.capability = q.capability
  if (q.model) filter.model = q.model
  if (q.status) filter.status = q.status
  if (q.apiKeyId) filter.apiKeyId = q.apiKeyId
  if (q.requestId) filter.requestId = q.requestId
  return filter
}

export async function summarizeProjectUsage(
  projectId: string,
  q: Pick<UsageQuery, "from" | "to" | "environment"> = {},
): Promise<UsageSummary> {
  await ensureRuntimeIndexes()
  const range = clampRange(q.from, q.to)
  const col = await runtimeUsageCol()
  const match: Record<string, unknown> = {
    projectId,
    createdAt: { $gte: range.from, $lte: range.to },
  }
  if (q.environment) match.environment = q.environment

  const [row] = await col
    .aggregate<{
      requests: number
      succeeded: number
      failed: number
      creditsCharged: number
      providerCostUsd: number
      providerNumeric: number
      providerCostUnavailableCount: number
    }>([
      { $match: match },
      {
        $group: {
          _id: null,
          requests: { $sum: 1 },
          succeeded: {
            $sum: { $cond: [{ $eq: ["$status", "succeeded"] }, 1, 0] },
          },
          failed: {
            $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
          },
          creditsCharged: { $sum: "$creditsCharged" },
          providerCostUsd: {
            $sum: {
              $cond: [{ $eq: [{ $type: "$costMetadata.providerCost" }, "double"] }, "$costMetadata.providerCost", 0],
            },
          },
          providerNumeric: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: [{ $type: "$costMetadata.providerCost" }, "double"] },
                    { $eq: [{ $type: "$costMetadata.providerCost" }, "int"] },
                    { $eq: [{ $type: "$costMetadata.providerCost" }, "long"] },
                    { $eq: [{ $type: "$costMetadata.providerCost" }, "decimal"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          providerCostUnavailableCount: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: [{ $type: "$costMetadata.providerCost" }, "double"] },
                    { $eq: [{ $type: "$costMetadata.providerCost" }, "int"] },
                    { $eq: [{ $type: "$costMetadata.providerCost" }, "long"] },
                    { $eq: [{ $type: "$costMetadata.providerCost" }, "decimal"] },
                  ],
                },
                0,
                1,
              ],
            },
          },
        },
      },
    ])
    .toArray()

  if (!row) {
    return {
      from: range.from,
      to: range.to,
      requests: 0,
      succeeded: 0,
      failed: 0,
      creditsCharged: 0,
      providerCostUsd: null,
      providerCostUnavailableCount: 0,
    }
  }

  return {
    from: range.from,
    to: range.to,
    requests: row.requests,
    succeeded: row.succeeded,
    failed: row.failed,
    creditsCharged: row.creditsCharged,
    providerCostUsd: row.providerNumeric > 0 ? row.providerCostUsd : null,
    providerCostUnavailableCount: row.providerCostUnavailableCount,
  }
}

export async function listProjectUsage(
  projectId: string,
  q: UsageQuery = {},
): Promise<{ events: PublicUsageEvent[]; nextCursor: string | null; summary: UsageSummary }> {
  await ensureRuntimeIndexes()
  const range = clampRange(q.from, q.to)
  const limit = Math.min(Math.max(q.limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT)
  const col = await runtimeUsageCol()
  const filter = matchFilter(projectId, q, range)
  const cursor = parseCursor(q.cursor)
  if (cursor) {
    filter.$or = [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { $lt: cursor.id } },
    ]
  }

  const docs = (await col
    .find(filter)
    .sort({ createdAt: -1, id: -1 })
    .limit(limit + 1)
    .toArray()) as unknown as RuntimeUsageEvent[]

  const hasMore = docs.length > limit
  const page = hasMore ? docs.slice(0, limit) : docs
  const events = page.map(toPublicUsageEvent)
  const last = page[page.length - 1]
  const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null
  const summary = await summarizeProjectUsage(projectId, q)
  return { events, nextCursor, summary }
}

export async function getProjectRequestEvents(
  projectId: string,
  requestId: string,
): Promise<PublicUsageEvent[]> {
  await ensureRuntimeIndexes()
  const col = await runtimeUsageCol()
  const docs = (await col
    .find({ projectId, requestId })
    .sort({ createdAt: 1 })
    .toArray()) as unknown as RuntimeUsageEvent[]
  return docs.map(toPublicUsageEvent)
}

export async function projectHealthSnapshot(projectId: string): Promise<{
  windowMs: number
  requests: number
  succeeded: number
  failed: number
  successRate: number | null
  lastSuccessAt: number | null
  lastFailureAt: number | null
  recentErrors: Array<{
    requestId: string
    createdAt: number
    capability: string
    errorCategory?: string
    model?: string
  }>
}> {
  const windowMs = 24 * 60 * 60 * 1000
  const summary = await summarizeProjectUsage(projectId, {
    from: Date.now() - windowMs,
    to: Date.now(),
  })
  const col = await runtimeUsageCol()
  const [lastSuccess, lastFailure, recentFailed] = await Promise.all([
    col.find({ projectId, status: "succeeded" }).sort({ createdAt: -1 }).limit(1).next(),
    col.find({ projectId, status: "failed" }).sort({ createdAt: -1 }).limit(1).next(),
    col
      .find({ projectId, status: "failed", createdAt: { $gte: Date.now() - windowMs } })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray(),
  ])

  const requests = summary.requests
  return {
    windowMs,
    requests,
    succeeded: summary.succeeded,
    failed: summary.failed,
    successRate: requests > 0 ? summary.succeeded / requests : null,
    lastSuccessAt: lastSuccess?.createdAt ?? null,
    lastFailureAt: lastFailure?.createdAt ?? null,
    recentErrors: recentFailed.map((d) => ({
      requestId: d.requestId,
      createdAt: d.createdAt,
      capability: d.capability,
      ...(d.errorCategory ? { errorCategory: d.errorCategory } : {}),
      ...(d.model ? { model: d.model } : {}),
    })),
  }
}

/** Test helper: numeric provider cost never coerced from missing metadata. */
export function costFromEvent(event: RuntimeUsageEvent) {
  return publicCost(event.costMetadata as Record<string, unknown> | undefined)
}
