/**
 * Atai Finance — provider-cost status vocabulary (Phase 2, pure).
 *
 * One explicit classification for the MONETARY cost ATAI paid to a provider
 * for an event. It is deliberately separate from:
 *   - the customer credit charge (credit_ledger),
 *   - the universal credit VALUATION (lib/billing/credit-valuation.ts —
 *     3,750 credits = US$1.00 is a reference value, never a provider cost),
 *   - revenue / profit (never derived from these numbers in this phase).
 *
 * Statuses:
 *   confirmed      — authoritative provider-REPORTED monetary amount
 *                    (persisted verbatim with its original currency).
 *   estimated      — computed from a documented pricing source and known
 *                    usage quantities. NO adapter emits estimates today
 *                    (Phase 2 rule: never invent provider prices) — the
 *                    status exists so a future source stays distinguishable.
 *   unavailable    — insufficient evidence for cost. NEVER coerced to 0.
 *   not_applicable — the event does not incur a provider cost (e.g. account-
 *                    level ledger movements, which have no provider call).
 *
 * Historical rows never get rewritten: rows written before this field existed
 * are DERIVED at read time by `deriveCostStatus`, so aggregates stay honest
 * over old data without a backfill.
 *
 * @module lib/finances/cost-status
 */

export type ProviderCostStatus = "confirmed" | "estimated" | "unavailable" | "not_applicable"

/** The provider-cost source values the runtime meter persists. */
export type ProviderCostSource = "provider_reported" | "provider_estimated" | "unavailable"

/**
 * Derive the persisted status for a provider-cost info as the meter sees it
 * at write time (lib/runtime/metering/meter.ts stamps this into
 * runtime_usage.costMetadata.costStatus).
 */
export function costStatusFromProviderCost(info: {
  amount?: number
  source: ProviderCostSource
}): ProviderCostStatus {
  if (info.source === "unavailable" || typeof info.amount !== "number" || !Number.isFinite(info.amount)) {
    return "unavailable"
  }
  return info.source === "provider_estimated" ? "estimated" : "confirmed"
}

/**
 * Derive the cost status of a persisted runtime_usage `costMetadata` object,
 * including historical rows written BEFORE `costStatus` existed. Precedence:
 *  1. an explicit persisted `costStatus` (authoritative for the row);
 *  2. numeric providerCost + source `provider_estimated` → estimated;
 *  3. numeric providerCost (any other source — legacy rows without a source
 *     field were only ever written from provider-reported amounts) → confirmed;
 *  4. everything else → unavailable (missing ≠ zero).
 */
export function deriveCostStatus(
  costMetadata: Record<string, unknown> | null | undefined,
): ProviderCostStatus {
  if (!costMetadata || typeof costMetadata !== "object") return "unavailable"
  const explicit = costMetadata.costStatus
  if (
    explicit === "confirmed" ||
    explicit === "estimated" ||
    explicit === "unavailable" ||
    explicit === "not_applicable"
  ) {
    return explicit
  }
  const amount = costMetadata.providerCost
  if (typeof amount === "number" && Number.isFinite(amount)) {
    return costMetadata.providerCostSource === "provider_estimated" ? "estimated" : "confirmed"
  }
  return "unavailable"
}

/**
 * The currency a persisted provider cost is denominated in, or null when the
 * amount itself is absent. Missing/unknown currency on a NUMERIC cost is
 * reported as "unknown" — aggregations must not label an unlabeled amount USD.
 */
export function deriveCostCurrency(
  costMetadata: Record<string, unknown> | null | undefined,
): string | null {
  if (!costMetadata || typeof costMetadata !== "object") return null
  const amount = costMetadata.providerCost
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null
  return typeof costMetadata.providerCostCurrency === "string" && costMetadata.providerCostCurrency
    ? costMetadata.providerCostCurrency.toUpperCase()
    : "unknown"
}
