import { computePlanHealth, PLAN_SECTIONS, isPlaceholderValue } from "@/lib/analysis/plan-sections"
import type { CofounderPlanSummary } from "./types"

/**
 * Compact per-section plan summary shared by the get_plan and propose tools
 * (spec section 16). Composed with CODE from the live spec — never from the
 * model's claims.
 */
export function buildPlanSummaryFromSpec(spec: Parameters<(typeof PLAN_SECTIONS)[number]["read"]>[0], decisions: string[]): CofounderPlanSummary {
  const health = computePlanHealth(spec)
  const completed = PLAN_SECTIONS.filter((d) => {
    const v = d.read(spec)
    return Boolean(v) && !isPlaceholderValue(v)
  }).map((d) => d.label)
  const missing = PLAN_SECTIONS.filter((d) => {
    const v = d.read(spec)
    return !v || isPlaceholderValue(v)
  }).map((d) => d.label)
  return {
    hasPlan: true,
    healthPercent: health.percent,
    completedSections: completed,
    missingSections: missing,
    recentDecisions: decisions.slice(-10),
  }
}
