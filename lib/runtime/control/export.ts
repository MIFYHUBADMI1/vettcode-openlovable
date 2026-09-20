import "server-only"
import { runtimeUsageCol, ensureRuntimeIndexes } from "@/lib/db/runtime-collections"
import type { RuntimeUsageEvent, RuntimeEnvironment } from "@/runtime/contracts/capabilities"
import { clampRange, matchFilter } from "./analytics"
import type { UsageQuery } from "./analytics"

/**
 * Bounded CSV export for the Usage page.
 *
 * Safety properties:
 * - Reachable only after the same `requireOwnedProject` gate as every other
 *   Control Center route (enforced by the route, not here).
 * - Uses the SAME clampRange/matchFilter helpers as the usage list API, so
 *   export and page can never disagree about what a filter means.
 * - HARD CAP on rows (MAX_EXPORT_ROWS), applied server-side — no unbounded
 *   collection scans and no client-side bypass of the cap.
 * - Never fabricates data: provider cost is emitted only when the event
 *   actually carries a numeric provider-reported amount. Unavailable stays
 *   EMPTY — never "$0" (unknown cost must not be represented as zero).
 * - Same safe metadata columns as the Usage page: no secrets, no prompts or
 *   responses, no key hashes.
 */

/** Hard ceiling: at most this many (newest) rows are ever exported. */
export const MAX_EXPORT_ROWS = 1_000

const HEADER = [
  "request_id",
  "timestamp_utc",
  "environment",
  "api_key_id",
  "capability",
  "operation",
  "provider",
  "model",
  "status",
  "latency_ms",
  "credits_charged",
  "provider_cost_usd",
  "error_category",
] as const

/** Escape a cell for RFC 4180 CSV: quote when needed, double embedded quotes. */
function csvCell(value: string | number): string {
  const s = String(value)
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** Formula-injection guard: neutralize spreadsheet-executable prefixes. */
function csvSafe(value: string): string {
  return /^[=+\-@\t]/.test(value) ? `'${value}` : value
}

function csvField(value: string | number | undefined): string {
  if (value === undefined) return ""
  return typeof value === "number" ? csvCell(value) : csvCell(csvSafe(value))
}

function eventRow(e: RuntimeUsageEvent): string[] {
  const cost = e.costMetadata as Record<string, unknown> | undefined
  const amount = cost && typeof cost === "object" ? cost["providerCost"] : undefined
  const numericCost = typeof amount === "number" && Number.isFinite(amount) ? amount : undefined

  return [
    e.requestId,
    new Date(e.createdAt).toISOString(),
    e.environment,
    e.apiKeyId,
    e.capability,
    e.operation,
    e.provider,
    e.model,
    e.status,
    e.latencyMs,
    e.creditsCharged,
    numericCost,
    e.errorCategory,
  ].map((v) => csvField(v))
}

/** Explicit, machine-readable truncation marker row (empty otherwise). */
function truncationRow(omitted: number): string {
  return csvField(`EXPORT TRUNCATED: ${omitted} older event(s) omitted — narrow the time range or filters and export again.`)
}

export interface ExportUsageQuery {
  from?: number
  to?: number
  environment?: RuntimeEnvironment
  capability?: string
  model?: string
  status?: "succeeded" | "failed"
  apiKeyId?: string
  requestId?: string
}

/**
 * Build the bounded CSV export: newest MAX_EXPORT_ROWS events matching the
 * same filters as the Usage page, plus an explicit truncation marker row when
 * the cap cut anything off.
 */
export async function buildUsageCsv(
  projectId: string,
  q: ExportUsageQuery,
): Promise<{ csv: string; filename: string; rowCount: number; totalMatching: number; truncated: boolean }> {
  await ensureRuntimeIndexes()
  const range = clampRange(q.from, q.to)
  const col = await runtimeUsageCol()
  const filter = matchFilter(projectId, { ...q, cursor: undefined, limit: undefined }, range)

  // One bounded query for the rows, one count for the honesty signal.
  const [docs, totalMatching] = await Promise.all([
    col
      .find(filter)
      .sort({ createdAt: -1, id: -1 })
      .limit(MAX_EXPORT_ROWS)
      .toArray() as unknown as RuntimeUsageEvent[],
    col.countDocuments(filter),
  ])

  const truncated = totalMatching > docs.length
  const lines: string[] = [HEADER.join(",")]
  for (const doc of docs) {
    lines.push(eventRow(doc).join(","))
  }
  if (truncated) {
    lines.push(truncationRow(totalMatching - docs.length))
  }

  const csv = lines.join("\r\n") + "\r\n"
  // Filename reflects the ACTUAL clamped window, not the raw request.
  const from = new Date(range.from).toISOString().slice(0, 10)
  const to = new Date(range.to).toISOString().slice(0, 10)
  const filename = `atai-runtime-usage_${from}_to_${to}.csv`

  return { csv, filename, rowCount: docs.length, totalMatching, truncated }
}
