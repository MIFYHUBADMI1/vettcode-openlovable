import "server-only"
import { createHash } from "crypto"
import { logger } from "@/lib/logging/logger"

/**
 * Feature flags for the marketing / growth workspace.
 *
 * Follows the repository's existing convention (see
 * `lib/analysis/specification.ts` — USE_ENHANCED_PIPELINE): plain
 * `process.env` reads plus a deterministic percent rollout keyed on a hash of
 * the user id. No flag platform, no client-side flag bundle — these values are
 * only ever consulted on the server, and no env var is exposed to the browser.
 *
 * Kill-switch semantics: when the growth overview is disabled for a user, the
 * `/project/[id]/market` route and the `get_growth_overview` co-founder tool
 * must fall back to the EXACT previous behavior (coming-soon page / unlisted
 * tool), so turning the flag off can never strand a half-built experience.
 */

/**
 * Resolve the growth-overview flag for a specific user.
 *
 * - `GROWTH_OVERVIEW_ENABLED=false` → hard off for everyone (kill switch).
 * - `GROWTH_OVERVIEW_ENABLED=true`  → hard on for everyone.
 * - unset → governed by `GROWTH_OVERVIEW_ROLLOUT_PERCENT` (default 100, since
 *   this phase ships the page; set it lower to stage the rollout).
 *
 * Cohort assignment is deterministic (crypto hash of the user id mod 100), so
 * the same user always sees the same experience — the same mechanism the
 * enhanced-pipeline flag uses.
 */
export function isGrowthOverviewEnabledForUser(userId: string): boolean {
  const hard = process.env.GROWTH_OVERVIEW_ENABLED
  if (hard === "false" || hard === "0") {
    logger.info("marketing.flags", "Growth overview disabled by kill switch", { userId })
    return false
  }
  if (hard === "true" || hard === "1") return true

  const raw = process.env.GROWTH_OVERVIEW_ROLLOUT_PERCENT
  const percent = raw === undefined ? 100 : clampPercent(parseInt(raw, 10))
  if (percent >= 100) return true
  if (percent <= 0) return false

  const bucket = createHash("sha256").update(`growth-overview:${userId}`).digest().readUInt32BE(0) % 100
  const enabled = bucket < percent
  if (enabled) {
    logger.info("marketing.flags", "Growth overview enabled via rollout cohort", {
      userId,
      bucket,
      percent,
    })
  }
  return enabled
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}
