import type { RuntimeUsageEvent } from "@/runtime/contracts/capabilities"
import type { PublicUsageCost, PublicUsageEvent } from "./types"

function numericUsage(usage: Record<string, unknown> | undefined): Record<string, number> | undefined {
  if (!usage) return undefined
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(usage)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export function publicCost(costMetadata: Record<string, unknown> | undefined): PublicUsageCost {
  if (!costMetadata || typeof costMetadata !== "object") {
    return { status: "unavailable" }
  }
  const amount = costMetadata.providerCost
  const source = typeof costMetadata.providerCostSource === "string"
    ? costMetadata.providerCostSource
    : undefined
  if (typeof amount === "number" && Number.isFinite(amount)) {
    return {
      status: "available",
      amount,
      currency: typeof costMetadata.providerCostCurrency === "string"
        ? costMetadata.providerCostCurrency
        : "USD",
      ...(source ? { source } : {}),
    }
  }
  return { status: "unavailable", ...(source ? { source } : {}) }
}

export function toPublicUsageEvent(event: RuntimeUsageEvent): PublicUsageEvent {
  return {
    id: event.id,
    requestId: event.requestId,
    apiKeyId: event.apiKeyId,
    environment: event.environment,
    capability: event.capability,
    ...(event.operation ? { operation: event.operation } : {}),
    provider: event.provider,
    ...(event.model ? { model: event.model } : {}),
    status: event.status,
    latencyMs: event.latencyMs,
    creditsCharged: event.creditsCharged,
    ...(event.errorCategory ? { errorCategory: event.errorCategory } : {}),
    createdAt: event.createdAt,
    ...(numericUsage(event.usage as Record<string, unknown> | undefined)
      ? { usage: numericUsage(event.usage as Record<string, unknown> | undefined) }
      : {}),
    cost: publicCost(event.costMetadata as Record<string, unknown> | undefined),
  }
}

export function summarizeCosts(events: { cost: PublicUsageCost; creditsCharged: number; status: string }[]): {
  creditsCharged: number
  providerCostUsd: number | null
  providerCostUnavailableCount: number
  requests: number
  succeeded: number
  failed: number
} {
  let creditsCharged = 0
  let providerSum = 0
  let providerNumeric = 0
  let providerCostUnavailableCount = 0
  let succeeded = 0
  let failed = 0
  for (const e of events) {
    creditsCharged += e.creditsCharged
    if (e.status === "succeeded") succeeded += 1
    else failed += 1
    if (e.cost.status === "available" && typeof e.cost.amount === "number") {
      providerSum += e.cost.amount
      providerNumeric += 1
    } else {
      providerCostUnavailableCount += 1
    }
  }
  return {
    creditsCharged,
    providerCostUsd: providerNumeric > 0 ? providerSum : null,
    providerCostUnavailableCount,
    requests: events.length,
    succeeded,
    failed,
  }
}
