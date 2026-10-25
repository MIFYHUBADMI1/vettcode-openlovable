import "server-only"

/**
 * Deterministic SEO audit score (Phase 3 — v1.1).
 *
 * The score is an INTERNAL Atai assessment of the on-page checks this audit
 * completed. It is not a Google ranking, traffic, or visibility metric, and it
 * is never presented as one.
 *
 * Rules (all deterministic — the same findings always produce the same score):
 *  1. Only findings that were actually evaluated (`pass` / `fail`) are
 *     eligible. A `not_observed` finding is EXCLUDED — missing evidence must
 *     never penalise a site as though it had failed that check.
 *  2. Each eligible finding carries a severity weight. Passing checks add
 *     their weight to `passedWeight`, failing checks add to `failedWeight`.
 *  3. score = round(100 * passedWeight / (passedWeight + failedWeight)).
 *  4. When the eligible weight is 0 (nothing could be evaluated, or only
 *     zero-weight informational checks ran) the score is `null` — "not
 *     available", never 0.
 *  5. The algorithm is versioned. Audits persist the version they were scored
 *     with so historical scores remain interpretable after a future change.
 *
 * Weights are deliberately coarse and documented: they express relative
 * priority for a founder, not a measurement of ranking impact.
 */

import type { SeoAuditScore, SeoFinding, SeoFindingSeverity } from "@/lib/types/db"

/** Bumped whenever the weights or the formula change. */
export const SEO_SCORE_VERSION = "seo-score-v1"

export const SEVERITY_WEIGHTS: Record<SeoFindingSeverity, number> = {
  critical: 10,
  high: 6,
  medium: 3,
  low: 1,
  info: 0,
}

/** Severity assumed for audits stored before severity existed. */
export const DEFAULT_SEVERITY: SeoFindingSeverity = "medium"

function weightOf(finding: SeoFinding): number {
  const severity = finding.severity ?? DEFAULT_SEVERITY
  return SEVERITY_WEIGHTS[severity] ?? 0
}

export function calculateSeoScore(findings: SeoFinding[]): SeoAuditScore {
  let passedWeight = 0
  let failedWeight = 0
  let notApplicable = 0

  for (const finding of findings) {
    if (finding.status === "not_observed") {
      notApplicable += 1
      continue
    }
    if (finding.status === "pass") passedWeight += weightOf(finding)
    else failedWeight += weightOf(finding)
  }

  const eligibleWeight = passedWeight + failedWeight
  return {
    value: eligibleWeight === 0 ? null : Math.round((100 * passedWeight) / eligibleWeight),
    version: SEO_SCORE_VERSION,
    passedWeight,
    failedWeight,
    notApplicable,
  }
}
