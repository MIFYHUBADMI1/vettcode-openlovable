import "server-only"
import { runtimeUsageCol, ensureRuntimeIndexes } from "@/lib/db/runtime-collections"
import type { RuntimeEnvironment } from "@/runtime/contracts/capabilities"

/**
 * Runtime Control Center — server-authoritative breakdown aggregations.
 *
 * All totals are computed by MongoDB aggregation over the project-scoped
 * runtime_usage collection (indexed by projectId+createdAt). The browser
 * NEVER computes an authoritative number (Phase: cost estimation security) —
 * the frontend only renders these values.
 */

export interface UsageQueryWindow {
  from?: number
  to?: number
  environment?: RuntimeEnvironment
}

/** One grouped row of a breakdown. */
export interface BreakdownRow {
  key: string
  requests: number
  succeeded: number
  failed: number
  creditsCharged: number
  /** Mean latency across the group (ms). */
  avgLatencyMs: number | null
  /** Numeric provider-cost sum when at least one event reported one. */
  providerCostUsd: number | null
  providerCostUnavailableCount: number
}

/** A clearly-labeled linear projection of current-period spend. */
export interface PeriodEstimate {
  /** "estimate" — never presented as a finalized invoice. */
  kind: "estimate"
  /** Linear extrapolation from observed usage to the period end. */
  projectedRequests: number
  projectedCredits: number
  /** Null when no numeric provider cost was observed at all. */
  projectedProviderCostUsd: number | null
  observedRequests: number
  from: number
  to: number
  /** How the projection window was derived. */
  basis: string
}

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_RANGE_MS = 90 * DAY_MS

function clampRange(from: number | undefined, to: number | undefined): { from: number; to: number } {
  const now = Date.now()
  const end = to && Number.isFinite(to) ? Math.min(to, now + 60_000) : now
  let start = from && Number.isFinite(from) ? from : end - 30 * DAY_MS
  if (end - start > MAX_RANGE_MS) start = end - MAX_RANGE_MS
  if (start > end) start = end - DAY_MS
  return { from: start, to: end }
}

/** Bounded group stage: normalize missing groups to "unknown" and cap rows. */
function groupStage(groupField: string, limit: number): Record<string, unknown>[] {
  return [
    {
      $group: {
        _id: { $ifNull: [`$${groupField}`, "unknown"] },
        requests: { $sum: 1 },
        succeeded: { $sum: { $cond: [{ $eq: ["$status", "succeeded"] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
        creditsCharged: { $sum: "$creditsCharged" },
        totalLatencyMs: { $sum: "$latencyMs" },
        providerCostUsd: {
          $sum: {
            $cond: [
              { $in: [{ $type: "$costMetadata.providerCost" }, ["double", "int", "long", "decimal"]] },
              "$costMetadata.providerCost",
              0,
            ],
          },
        },
        providerNumeric: {
          $sum: {
            $cond: [
              { $in: [{ $type: "$costMetadata.providerCost" }, ["double", "int", "long", "decimal"]] },
              1,
              0,
            ],
          },
        },
        providerCostUnavailableCount: {
          $sum: {
            $cond: [
              { $in: [{ $type: "$costMetadata.providerCost" }, ["double", "int", "long", "decimal"]] },
              0,
              1,
            ],
          },
        },
      },
    },
    { $sort: { requests: -1 } },
    { $limit: limit },
  ]
}

interface AggRow {
  _id: string
  requests: number
  succeeded: number
  failed: number
  creditsCharged: number
  totalLatencyMs: number
  providerCostUsd: number
  providerNumeric: number
  providerCostUnavailableCount: number
}

function toRow(row: AggRow): BreakdownRow {
  return {
    key: row._id,
    requests: row.requests,
    succeeded: row.succeeded,
    failed: row.failed,
    creditsCharged: row.creditsCharged,
    avgLatencyMs: row.requests > 0 ? Math.round(row.totalLatencyMs / row.requests) : null,
    providerCostUsd: row.providerNumeric > 0 ? row.providerCostUsd : null,
    providerCostUnavailableCount: row.providerCostUnavailableCount,
  }
}

async function runBreakdown(
  projectId: string,
  q: UsageQueryWindow,
  groupField: string,
  limit: number,
): Promise<BreakdownRow[]> {
  await ensureRuntimeIndexes()
  const range = clampRange(q.from, q.to)
  const filter: Record<string, unknown> = {
    projectId,
    createdAt: { $gte: range.from, $lte: range.to },
  }
  if (q.environment) filter.environment = q.environment
  const col = await runtimeUsageCol()
  const rows = await col
    .aggregate<AggRow>([{ $match: filter }, ...groupStage(groupField, limit)])
    .toArray()
  return rows.map(toRow)
}

/** Grouped by API key id (non-secret rkey_… reference). Max 50 rows. */
export function breakdownByApiKey(projectId: string, q: UsageQueryWindow = {}): Promise<BreakdownRow[]> {
  return runBreakdown(projectId, q, "apiKeyId", 50)
}

/** Grouped by capability (ai.text, search.web, …). Max 50 rows. */
export function breakdownByCapability(projectId: string, q: UsageQueryWindow = {}): Promise<BreakdownRow[]> {
  return runBreakdown(projectId, q, "capability", 50)
}

/** Grouped by model id where the provider reported one. Max 50 rows. */
export function breakdownByModel(projectId: string, q: UsageQueryWindow = {}): Promise<BreakdownRow[]> {
  return runBreakdown(projectId, q, "model", 50)
}

/** Grouped by provider (openrouter, elevenlabs, …). Max 20 rows. */
export function breakdownByProvider(projectId: string, q: UsageQueryWindow = {}): Promise<BreakdownRow[]> {
  return runBreakdown(projectId, q, "provider", 20)
}

/** Grouped by normalized error category (failed requests only). Max 25 rows. */
export function breakdownByError(projectId: string, q: UsageQueryWindow = {}): Promise<BreakdownRow[]> {
  return runErrorBreakdown(projectId, q, "errorCategory", 25)
}

async function runErrorBreakdown(
  projectId: string,
  q: UsageQueryWindow,
  groupField: string,
  limit: number,
): Promise<BreakdownRow[]> {
  await ensureRuntimeIndexes()
  const range = clampRange(q.from, q.to)
  const filter: Record<string, unknown> = {
    projectId,
    status: "failed",
    createdAt: { $gte: range.from, $lte: range.to },
  }
  if (q.environment) filter.environment = q.environment
  const col = await runtimeUsageCol()
  const rows = await col
    .aggregate<AggRow>([{ $match: filter }, ...groupStage(groupField, limit)])
    .toArray()
  return rows.map(toRow)
}

/**
 * Period projection (clearly an ESTIMATE — §128/§130). Linear extrapolation
 * of the observed window to the current billing-period boundary derived from
 * the window itself: we project to "30 days from the observed start" capped
 * at now + 30d, because the platform has no per-user billing-period anchor
 * on runtime usage. Insufficient data (< 20 requests or < 24h of observations)
 * returns `insufficientData: true` instead of a fabricated number.
 */
export async function estimatePeriodUsage(
  projectId: string,
  q: UsageQueryWindow = {},
): Promise<PeriodEstimate & { insufficientData: boolean }> {
  await ensureRuntimeIndexes()
  const range = clampRange(q.from, q.to)
  const filter: Record<string, unknown> = {
    projectId,
    createdAt: { $gte: range.from, $lte: range.to },
  }
  if (q.environment) filter.environment = q.environment
  const col = await runtimeUsageCol()
  const [row] = await col
    .aggregate<{
      requests: number
      creditsCharged: number
      providerCostUsd: number
      providerNumeric: number
      firstAt: number | null
    }>([
      { $match: filter },
      {
        $group: {
          _id: null,
          requests: { $sum: 1 },
          creditsCharged: { $sum: "$creditsCharged" },
          providerCostUsd: {
            $sum: {
              $cond: [
                { $in: [{ $type: "$costMetadata.providerCost" }, ["double", "int", "long", "decimal"]] },
                "$costMetadata.providerCost",
                0,
              ],
            },
          },
          providerNumeric: {
            $sum: {
              $cond: [
                { $in: [{ $type: "$costMetadata.providerCost" }, ["double", "int", "long", "decimal"]] },
                1,
                0,
              ],
            },
          },
          firstAt: { $min: "$createdAt" },
        },
      },
    ])
    .toArray()

  const observedRequests = row?.requests ?? 0
  const creditsCharged = row?.creditsCharged ?? 0
  const providerCostUsd = row && row.providerNumeric > 0 ? row.providerCostUsd : null
  const firstAt = row?.firstAt ?? null

  // Insufficient data: fewer than 20 events or less than 24h of observation.
  const observedMs = firstAt ? range.to - firstAt : 0
  if (observedRequests < 20 || observedMs < DAY_MS) {
    return {
      kind: "estimate",
      projectedRequests: 0,
      projectedCredits: 0,
      projectedProviderCostUsd: null,
      observedRequests,
      from: range.from,
      to: range.to,
      basis: `Observed ${observedRequests} request${observedRequests === 1 ? "" : "s"} since ${firstAt ? new Date(firstAt).toISOString() : "—"}`,
      insufficientData: true,
    }
  }

  // Extrapolate the observed daily rate onto a 30-day horizon.
  const observedDays = Math.max(observedMs / DAY_MS, 1)
  const perDayRequests = observedRequests / observedDays
  const perDayCredits = creditsCharged / observedDays
  const perDayProviderCost = providerCostUsd !== null ? providerCostUsd / observedDays : null

  return {
    kind: "estimate",
    projectedRequests: Math.round(perDayRequests * 30),
    projectedCredits: Math.round(perDayCredits * 30),
    projectedProviderCostUsd: perDayProviderCost !== null ? Math.round(perDayProviderCost * 30 * 1000) / 1000 : null,
    observedRequests,
    from: range.from,
    to: range.to,
    basis: `Linear projection of the last ${Math.round(observedDays * 10) / 10} day${observedDays < 2 ? "" : "s"} onto 30 days`,
    insufficientData: false,
  }
}
