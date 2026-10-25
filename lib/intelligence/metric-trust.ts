/**
 * Application Intelligence — shared metric-trust model.
 *
 * Generalizes the availability-state convention introduced by the Marketing &
 * Monetization workspace (`lib/marketing/growth-overview.ts` Phase 2) so every
 * Application Intelligence surface uses ONE vocabulary for honest data states.
 * The marketing module remains untouched and keeps its own local types; this
 * module is the canonical definition going forward.
 *
 * Hard rule (spec §D "No fake completeness"): the UI must never render a row
 * of zeroes for a missing data source, never render a failed read as zero,
 * and never present an unmeasured capability as a measured value.
 *
 * Pure module — no server-only imports — so view models and client components
 * can both consume the types.
 *
 * @module lib/intelligence/metric-trust
 */

export type MetricState =
  /** Source read succeeded and produced a non-zero measurement. */
  | "available"
  /** Source read succeeded and genuinely measured zero (a real, trustworthy 0). */
  | "measured_zero"
  /** Source exists but this read failed (error / timeout). Never shown as 0. */
  | "unavailable"
  /** The platform does not collect this data at all yet. Never fabricated. */
  | "not_instrumented"

export interface NumberMetric {
  state: MetricState
  /** Numeric value when the read succeeded; null otherwise. */
  value: number | null
  /** Honest one-line definition of what the number measures. */
  definition: string
  /** What the number must NOT be interpreted as. */
  caveat: string
  /** Explanation when state is unavailable / not_instrumented. */
  reason?: string
  /** Measurement window for time-boxed metrics. */
  window?: { from: number; to: number }
  /** Data source identifier for transparency / debugging. */
  source?: string
}

/** Inputs for a measured metric (definition + caveat + optional extras). */
export type MetricDef = Pick<NumberMetric, "definition" | "caveat" | "source"> & {
  window?: { from: number; to: number }
}

export function measured(
  value: number,
  def: MetricDef,
): NumberMetric {
  return {
    state: value === 0 ? "measured_zero" : "available",
    value,
    definition: def.definition,
    caveat: def.caveat,
    ...(def.source ? { source: def.source } : {}),
    ...(def.window ? { window: def.window } : {}),
  }
}

export function unavailable(reason: string, def: Omit<MetricDef, "window">): NumberMetric {
  return { state: "unavailable", value: null, reason, ...def }
}

export function notInstrumented(reason: string, def: Omit<MetricDef, "source" | "window">): NumberMetric {
  return { state: "not_instrumented", value: null, reason, ...def }
}

/** p50/p95-style percentile over a small, bounded sample (inclusive order). */
export function percentile(sortedValues: number[], p: number): number | null {
  if (sortedValues.length === 0) return null
  if (sortedValues.length === 1) return sortedValues[0]
  const rank = (p / 100) * (sortedValues.length - 1)
  const lo = Math.floor(rank)
  const hi = Math.ceil(rank)
  if (lo === hi) return sortedValues[lo]
  return sortedValues[lo] + (sortedValues[hi] - sortedValues[lo]) * (rank - lo)
}

/** Failure rate as a 0..1 fraction; null when there is no sample at all. */
export function failureRate(failed: number, total: number): number | null {
  if (total <= 0) return null
  return failed / total
}
