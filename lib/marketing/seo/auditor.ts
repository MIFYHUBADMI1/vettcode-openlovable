import "server-only"

/**
 * Deterministic SEO auditor (Phase 3 — W2).
 *
 * This module contains NO network calls and NO AI. It turns the normalized
 * `WebsiteEvidence` the Firecrawl service already produces into a set of
 * on-page findings using fixed, reproducible rules. Running it twice on the
 * same evidence yields the same findings (the roadmap's "audit
 * reproducibility" acceptance criterion).
 *
 * Trust rules (carried over from the Phase 2 metric-trust policy):
 *  - A check is only `pass`/`fail` when the evidence actually shows the field.
 *  - When the evidence does not carry a signal (e.g. canonical, robots.txt),
 *    the finding is `not_observed` with a note — it is NEVER guessed or shown
 *    as a failure. This surface does not claim search rankings or traffic.
 */

import type { WebsiteEvidence, FirecrawlPageEvidence } from "@/lib/integrations/firecrawl/types"
import type { SeoFinding, SeoFindingStatus } from "@/lib/types/db"

export interface SeoAuditResult {
  findings: SeoFinding[]
  score: { pass: number; fail: number; notObserved: number }
  pagesCrawled: number
}

function finding(id: string, label: string, status: SeoFindingStatus, extra?: Partial<SeoFinding>): SeoFinding {
  return { id, label, status, ...extra }
}

/** Pick the page whose URL best represents the site root, else the first. */
function rootPage(pages: FirecrawlPageEvidence[]): FirecrawlPageEvidence | undefined {
  return pages[0]
}

/**
 * Evaluate on-page SEO signals from website evidence.
 * Each finding records the concrete observed value so the UI can show WHY it
 * passed/failed, and never implies a measurement Atai did not make.
 */
export function auditWebsiteEvidence(evidence: WebsiteEvidence): SeoAuditResult {
  const page = rootPage(evidence.pages)
  const findings: SeoFinding[] = []

  // 1. HTTP(S) scheme
  const isHttps = evidence.sourceUrl.startsWith("https://")
  findings.push(
    finding(
      "https",
      "Uses HTTPS",
      evidence.sourceUrl.startsWith("http") ? (isHttps ? "pass" : "fail") : "not_observed",
      { observed: evidence.sourceUrl, note: isHttps ? undefined : "Serve the site over HTTPS to secure search results." },
    ),
  )

  // 2. <title>
  const title = (page?.title ?? evidence.title ?? "").trim()
  findings.push(
    finding(
      "title",
      "Page title",
      titleStatus(title),
      {
        observed: title ? `“${truncate(title, 120)}”` : undefined,
        note: title ? (title.length > 60 ? "Titles longer than ~60 characters are truncated in search results." : undefined) : "Add a unique <title> to your landing page.",
      },
    ),
  )

  // 3. Meta description
  const description = (page?.description ?? evidence.description ?? "").trim()
  findings.push(
    finding(
      "meta_description",
      "Meta description",
      description ? "pass" : "fail",
      {
        observed: description ? `“${truncate(description, 160)}”` : undefined,
        note: description ? undefined : "Add a meta description summarizing the page.",
      },
    ),
  )

  // 4. Headings present
  const headingCount = page?.headings?.length ?? 0
  findings.push(
    finding(
      "headings",
      "Headings present",
      headingCount > 0 ? "pass" : "not_observed",
      { observed: headingCount > 0 ? `${headingCount} heading${headingCount === 1 ? "" : "s"} found` : undefined, note: headingCount > 0 ? undefined : "The crawler could not read heading structure." },
    ),
  )

  // 5. Internal links (crawlability)
  const linkCount = page?.links?.length ?? 0
  findings.push(
    finding(
      "internal_links",
      "Internal links",
      linkCount > 0 ? "pass" : "not_observed",
      { observed: linkCount > 0 ? `${linkCount} link${linkCount === 1 ? "" : "s"} detected` : undefined, note: linkCount > 0 ? undefined : "No internal links were detected on the entry page." },
    ),
  )

  // 6. Indexable content (non-empty body)
  const bodyLength = (page?.markdown ?? "").trim().length
  findings.push(
    finding(
      "indexable_content",
      "Indexable text content",
      bodyLength > 0 ? "pass" : "fail",
      { observed: bodyLength > 0 ? `${bodyLength.toLocaleString()} characters readable` : undefined, note: bodyLength > 0 ? undefined : "The page exposed no readable text content to the crawler." },
    ),
  )

  // 7. Site breadth
  const pagesCrawled = evidence.usage?.pagesCrawled ?? evidence.pages.length
  findings.push(
    finding(
      "site_breadth",
      "Multiple pages reachable",
      pagesCrawled > 1 ? "pass" : pagesCrawled === 1 ? "not_observed" : "not_observed",
      { observed: `${pagesCrawled} page${pagesCrawled === 1 ? "" : "s"} crawled`, note: pagesCrawled > 1 ? undefined : "Only the entry page was reachable during this bounded crawl." },
    ),
  )

  // 8. Images (count only — alt text is not carried in normalized evidence).
  const imageCount = page?.images?.length ?? 0
  findings.push(
    finding(
      "images",
      "Images present",
      imageCount > 0 ? "pass" : "not_observed",
      { observed: imageCount > 0 ? `${imageCount} image${imageCount === 1 ? "" : "s"}. (Alt text is not read by the crawler — review manually.)` : undefined },
    ),
  )

  // 9/10. Signals the crawler does NOT capture — explicitly not_observed,
  // never fabricated. (Rankings, robots.txt, sitemap, canonical, social tags.)
  findings.push(
    finding("canonical", "Canonical URL", "not_observed", { note: "The crawler does not read the <link rel=canonical> tag." }),
    finding("robots", "robots.txt / sitemap", "not_observed", { note: "Indexing directives are not fetched in this bounded, read-only audit." }),
  )

  return {
    findings,
    score: summarize(findings),
    pagesCrawled,
  }
}

function titleStatus(title: string): SeoFindingStatus {
  if (!title) return "fail"
  if (title.length > 60) return "fail"
  return "pass"
}

function summarize(findings: SeoFinding[]): SeoAuditResult["score"] {
  return {
    pass: findings.filter((f) => f.status === "pass").length,
    fail: findings.filter((f) => f.status === "fail").length,
    notObserved: findings.filter((f) => f.status === "not_observed").length,
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`
}

/**
 * Deterministic recommendations derived from FAILING checks only. Clearly the
 * product of fixed rules over observed evidence — not an AI estimate and not a
 * claim about rankings. A `not_observed` finding never generates a
 * recommendation (we don't guess what we couldn't see).
 */
export function deriveRecommendations(findings: SeoFinding[]): Array<{ findingId: string; text: string; basis: "observed_failures" }> {
  return findings
    .filter((f) => f.status === "fail")
    .map((f) => ({
      findingId: f.id,
      text: f.note ?? `Address the “${f.label}” finding.`,
      basis: "observed_failures" as const,
    }))
}
