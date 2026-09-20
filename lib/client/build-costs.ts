"use client"

/**
 * Client access to SERVER-AUTHORITATIVE build/follow-up credit costs.
 *
 * Numbers come from GET /api/credit-costs (admin-configurable runtime config
 * layered over the code defaults in lib/billing/config.ts and the heavy-mode
 * scaling in lib/credits/credits.ts) through the shared Zustand store.
 *
 * Components must NOT hardcode tier cost tables — the server always re-checks
 * the real cost at launch; these values exist only for honest display.
 * The FALLBACK_* tables below mirror the server defaults and are used only
 * while the cost table is loading or unavailable.
 */

import { useCreditCosts, type BuildTier } from "@/lib/client/api"

const TIERS: BuildTier[] = ["simple", "medium", "complex"]

/** Mirrors server defaults: BUILD_TIERS (50k/75k/100k) and the heavy-mode
 * scaling ratio in lib/credits/credits.ts (×2 / ×1.5 / ×4/3). Display-only. */
const FALLBACK_TIER_COSTS: Record<BuildTier, { label: string; legacy: number; heavy: number }> = {
  simple: { label: "Simple", legacy: 50_000, heavy: 100_000 },
  medium: { label: "Medium", legacy: 75_000, heavy: 112_500 },
  complex: { label: "Complex", legacy: 100_000, heavy: 133_333 },
}

/** Mirrors the server follow-up default (getBuildCost → BUILD_TIERS). */
const FALLBACK_FOLLOWUP_COSTS: Record<BuildTier, number> = {
  simple: 50_000,
  medium: 75_000,
  complex: 100_000,
}

function normalizeTier(tier: string | null | undefined): BuildTier {
  return tier && (TIERS as string[]).includes(tier) ? (tier as BuildTier) : "medium"
}

export function useBuildCosts() {
  const { costs } = useCreditCosts()

  /** Display cost for an initial build in the given pipeline mode. */
  function buildCost(tier: string | null | undefined, pipelineMode?: string | null): number {
    const t = normalizeTier(tier)
    const mode = pipelineMode === "heavy" ? "heavy" : "legacy"
    return costs?.buildTiers?.[t]?.[mode] ?? FALLBACK_TIER_COSTS[t][mode]
  }

  /** Display label for a complexity tier. */
  function tierLabel(tier: string | null | undefined): string {
    const t = normalizeTier(tier)
    return costs?.buildTiers?.[t]?.label ?? FALLBACK_TIER_COSTS[t].label
  }

  /** Display cost for a follow-up agent edit (matches getBuildCost server-side). */
  function followupCost(tier: string | null | undefined): number {
    const t = normalizeTier(tier)
    return costs?.followupByTier?.[t] ?? FALLBACK_FOLLOWUP_COSTS[t]
  }

  return { buildCost, tierLabel, followupCost }
}
