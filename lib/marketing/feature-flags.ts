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

/**
 * SEO audit flag (Phase 3 — W2). Same convention as the growth-overview flag,
 * but the DEFAULT IS OFF: a crawl-based, credit-charging capability should not
 * be reachable until an operator explicitly enables it (SEO_AUDIT_ENABLED=true)
 * or opts a cohort in via SEO_AUDIT_ROLLOUT_PERCENT. When off, the API route
 * and the `run_seo_audit` tool both refuse loudly — no half-built surface.
 */
export function isSeoAuditEnabledForUser(userId: string): boolean {
  const hard = process.env.SEO_AUDIT_ENABLED
  if (hard === "true" || hard === "1") return true
  if (hard === "false" || hard === "0") return false

  const raw = process.env.SEO_AUDIT_ROLLOUT_PERCENT
  const percent = raw === undefined ? 0 : clampPercent(parseInt(raw, 10))
  if (percent <= 0) return false
  if (percent >= 100) return true

  const bucket = createHash("sha256").update(`seo-audit:${userId}`).digest().readUInt32BE(0) % 100
  return bucket < percent
}

/**
 * Marketing Studio flag (Phase 4 — W3). Same convention as the SEO flag and the
 * SAME default-OFF posture: a credit-charging, AI-generating capability is
 * unreachable until an operator opts in (STUDIO_ENABLED=true) or opens a cohort
 * via STUDIO_ROLLOUT_PERCENT. When off, the Studio route falls back to the exact
 * coming-soon experience and the `generate_marketing_copy` tool refuses loudly.
 */
export function isStudioEnabledForUser(userId: string): boolean {
  const hard = process.env.STUDIO_ENABLED
  if (hard === "true" || hard === "1") return true
  if (hard === "false" || hard === "0") return false

  const raw = process.env.STUDIO_ROLLOUT_PERCENT
  const percent = raw === undefined ? 0 : clampPercent(parseInt(raw, 10))
  if (percent <= 0) return false
  if (percent >= 100) return true

  const bucket = createHash("sha256").update(`studio:${userId}`).digest().readUInt32BE(0) % 100
  return bucket < percent
}

/**
 * Growth tasks flag (Phase 5 — W4). Same convention and SAME default-OFF
 * posture as the Studio/SEO flags: an AI-proposed, founder-approvable write
 * surface is unreachable until an operator opts in (GROWTH_TASKS_ENABLED=true)
 * or opens a cohort via GROWTH_TASKS_ROLLOUT_PERCENT. When off, the tasks route
 * falls back to the exact coming-soon experience and the `propose_growth_task` /
 * `list_growth_tasks` tools refuse loudly — no half-built surface. Note: unlike
 * Studio/SEO, tasks are FREE (no credits); the flag gates capability reachability,
 * not billing.
 */
export function isGrowthTasksEnabledForUser(userId: string): boolean {
  const hard = process.env.GROWTH_TASKS_ENABLED
  if (hard === "true" || hard === "1") return true
  if (hard === "false" || hard === "0") return false

  const raw = process.env.GROWTH_TASKS_ROLLOUT_PERCENT
  const percent = raw === undefined ? 0 : clampPercent(parseInt(raw, 10))
  if (percent <= 0) return false
  if (percent >= 100) return true

  const bucket = createHash("sha256").update(`growth-tasks:${userId}`).digest().readUInt32BE(0) % 100
  return bucket < percent
}

/**
 * Campaigns flag (Phase 6 — W5). Same convention and SAME default-OFF posture
 * as the tasks/Studio/SEO flags: an AI-proposed, founder-approvable write
 * surface is unreachable until an operator opts in (CAMPAIGNS_ENABLED=true) or
 * opens a cohort via CAMPAIGNS_ROLLOUT_PERCENT. When off, the campaigns route
 * falls back to the exact coming-soon experience and the `propose_campaign` /
 * `list_campaigns` tools refuse loudly — no half-built surface. Campaigns are
 * FREE and PLAN-ONLY (no execution, no spend, no scheduler); the flag gates
 * capability reachability, not billing.
 */
export function isCampaignsEnabledForUser(userId: string): boolean {
  const hard = process.env.CAMPAIGNS_ENABLED
  if (hard === "true" || hard === "1") return true
  if (hard === "false" || hard === "0") return false

  const raw = process.env.CAMPAIGNS_ROLLOUT_PERCENT
  const percent = raw === undefined ? 0 : clampPercent(parseInt(raw, 10))
  if (percent <= 0) return false
  if (percent >= 100) return true

  const bucket = createHash("sha256").update(`campaigns:${userId}`).digest().readUInt32BE(0) % 100
  return bucket < percent
}
