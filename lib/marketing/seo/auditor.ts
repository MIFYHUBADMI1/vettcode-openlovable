import "server-only"

/**
 * Deterministic SEO auditor (Phase 3 — W2, extended v1.2).
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
 *  - `not_observed` findings are also excluded from the score, so unavailable
 *    evidence can never lower a site's score.
 *
 * v1.2: every inspected page is analysed (not just the entry page), and titles
 * / meta descriptions repeated across pages produce duplicate findings.
 */

import type { WebsiteEvidence, FirecrawlPageEvidence } from "@/lib/integrations/firecrawl/types"
import type {
  SeoAuditScore,
  SeoFinding,
  SeoFindingCategory,
  SeoFindingSeverity,
  SeoFindingStatus,
} from "@/lib/types/db"
import { calculateSeoScore } from "./score"

export interface SeoAuditResult {
  findings: SeoFinding[]
  score: { pass: number; fail: number; notObserved: number }
  auditScore: SeoAuditScore
  pagesCrawled: number
}

/** How many offending URLs a single finding may carry. */
const MAX_AFFECTED_URLS = 5

function finding(
  id: string,
  label: string,
  status: SeoFindingStatus,
  severity: SeoFindingSeverity,
  category: SeoFindingCategory,
  extra?: Partial<SeoFinding>,
): SeoFinding {
  return { id, label, status, severity, category, ...extra }
}

function urlOf(page: FirecrawlPageEvidence, index: number, rootUrl: string): string {
  return (page.url || (index === 0 ? rootUrl : "")).trim()
}

function boundedUrls(urls: string[]): string[] {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))]
  return unique.slice(0, MAX_AFFECTED_URLS)
}

interface Observed {
  url: string
  value: string
}

/** Titles per page; the entry page may fall back to the site-level title. */
function pageTitles(pages: FirecrawlPageEvidence[], evidence: WebsiteEvidence): Observed[] {
  return pages.map((p, i) => ({
    url: urlOf(p, i, evidence.sourceUrl),
    value: ((i === 0 ? (p.title ?? evidence.title) : p.title) ?? "").trim(),
  }))
}

function pageDescriptions(pages: FirecrawlPageEvidence[], evidence: WebsiteEvidence): Observed[] {
  return pages.map((p, i) => ({
    url: urlOf(p, i, evidence.sourceUrl),
    value: ((i === 0 ? (p.description ?? evidence.description) : p.description) ?? "").trim(),
  }))
}

/** Normalised comparison key — case/whitespace differences are not duplicates. */
function duplicateKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function duplicateGroups(observed: Observed[]): Array<{ value: string; urls: string[] }> {
  const groups = new Map<string, { value: string; urls: string[] }>()
  for (const item of observed) {
    const key = duplicateKey(item.value)
    if (!key) continue
    const existing = groups.get(key)
    if (existing) {
      if (item.url && !existing.urls.includes(item.url)) existing.urls.push(item.url)
    } else {
      groups.set(key, { value: item.value, urls: item.url ? [item.url] : [] })
    }
  }
  return [...groups.values()].filter((g) => g.urls.length >= 2)
}

/**
 * Duplicate check for one shared field. With fewer than two pages carrying a
 * value there is nothing to compare, so the result is `not_observed` — never
 * a pass, which would imply we verified something we could not.
 */
function duplicateFinding(
  id: string,
  label: string,
  severity: SeoFindingSeverity,
  observed: Observed[],
  totalPages: number,
): SeoFinding {
  const withValue = observed.filter((o) => o.value)
  if (totalPages < 2 || withValue.length < 2) {
    return finding(id, label, "not_observed", severity, "metadata", {
      note:
        totalPages < 2
          ? "Only one page was inspected, so repeats cannot be compared across pages."
          : "Too few pages carried this field to compare across pages.",
    })
  }

  const duplicates = duplicateGroups(withValue)
  if (duplicates.length === 0) {
    return finding(id, label, "pass", severity, "metadata", {
      observed: `No repeated values across ${withValue.length} inspected pages.`,
    })
  }

  const first = duplicates[0]
  return finding(id, label, "fail", severity, "metadata", {
    observed:
      duplicates.length === 1
        ? `“${truncate(first.value, 120)}” is used on ${first.urls.length} different pages.`
        : `${duplicates.length} values are repeated across pages (first: “${truncate(first.value, 80)}” on ${first.urls.length} pages).`,
    note: "Give each page a unique value that describes that page specifically.",
    affectedUrls: boundedUrls(duplicates.flatMap((d) => d.urls)),
  })
}

/**
 * Evaluate on-page SEO signals from website evidence across ALL inspected
 * pages. Each finding records the concrete observed value so the UI can show
 * WHY it passed/failed, and never implies a measurement Atai did not make.
 */
export function auditWebsiteEvidence(evidence: WebsiteEvidence): SeoAuditResult {
  const pages = evidence.pages ?? []
  const pageCount = pages.length
  const findings: SeoFinding[] = []

  // 1. HTTP(S) scheme (site-level)
  const isHttps = evidence.sourceUrl.startsWith("https://")
  findings.push(
    finding(
      "https",
      "Uses HTTPS",
      evidence.sourceUrl.startsWith("http") ? (isHttps ? "pass" : "fail") : "not_observed",
      "high",
      "security",
      { observed: evidence.sourceUrl, note: isHttps ? undefined : "Serve the site over HTTPS to secure search results." },
    ),
  )

  // 2. <title> across every inspected page
  const titles = pageTitles(pages, evidence)
  const badTitles = titles.filter((t) => !t.value || t.value.length > 60)
  findings.push(
    finding(
      "title",
      "Page title",
      pageCount === 0 ? "not_observed" : badTitles.length > 0 ? "fail" : "pass",
      "high",
      "metadata",
      {
        observed:
          pageCount === 0
            ? undefined
            : badTitles.length > 0
              ? pageCount === 1
                ? badTitles[0].value
                  ? `“${truncate(badTitles[0].value, 120)}” (${badTitles[0].value.length} characters)`
                  : "No <title> found"
                : `${badTitles.length} of ${pageCount} pages need a title fix.`
              : `“${truncate(titles[0].value, 120)}”${pageCount > 1 ? ` · checked ${pageCount} pages` : ""}`,
        note:
          badTitles.length === 0
            ? undefined
            : badTitles.some((t) => t.value.length > 60)
              ? "Titles longer than ~60 characters are truncated in search results."
              : "Add a unique <title> to every page.",
        ...(badTitles.length > 0 ? { affectedUrls: boundedUrls(badTitles.map((t) => t.url)) } : {}),
      },
    ),
  )

  // 3. Meta description across every inspected page
  const descriptions = pageDescriptions(pages, evidence)
  const missingDescriptions = descriptions.filter((d) => !d.value)
  findings.push(
    finding(
      "meta_description",
      "Meta description",
      pageCount === 0 ? "not_observed" : missingDescriptions.length > 0 ? "fail" : "pass",
      "medium",
      "metadata",
      {
        observed:
          pageCount === 0
            ? undefined
            : missingDescriptions.length > 0
              ? pageCount === 1
                ? undefined
                : `${missingDescriptions.length} of ${pageCount} pages have no meta description.`
              : `“${truncate(descriptions[0].value, 160)}”`,
        note: missingDescriptions.length === 0 ? undefined : "Add a meta description summarizing each page.",
        ...(missingDescriptions.length > 0
          ? { affectedUrls: boundedUrls(missingDescriptions.map((d) => d.url)) }
          : {}),
      },
    ),
  )

  // 4. Headings present (any inspected page)
  const headingPages = pages.filter((p) => (p.headings?.length ?? 0) > 0)
  findings.push(
    finding(
      "headings",
      "Headings present",
      headingPages.length > 0 ? "pass" : "not_observed",
      "low",
      "structure",
      {
        observed: headingPages.length > 0 ? `${headingPages.length} of ${pageCount} pages expose headings` : undefined,
        note: headingPages.length > 0 ? undefined : "The crawler could not read heading structure.",
      },
    ),
  )

  // 5. Internal links (any inspected page)
  const linkPages = pages.filter((p) => (p.links?.length ?? 0) > 0)
  findings.push(
    finding(
      "internal_links",
      "Internal links",
      linkPages.length > 0 ? "pass" : "not_observed",
      "low",
      "links",
      {
        observed: linkPages.length > 0 ? `Links detected on ${linkPages.length} of ${pageCount} pages` : undefined,
        note: linkPages.length > 0 ? undefined : "No internal links were detected on the inspected pages.",
      },
    ),
  )

  // 6. Indexable content on every inspected page
  const emptyPages = pages.filter((p) => (p.markdown ?? "").trim().length === 0)
  findings.push(
    finding(
      "indexable_content",
      "Indexable text content",
      pageCount === 0 ? "not_observed" : emptyPages.length > 0 ? "fail" : "pass",
      "critical",
      "content",
      {
        observed:
          pageCount === 0
            ? undefined
            : emptyPages.length === 0
              ? `${pageCount} of ${pageCount} pages expose readable text`
              : `${emptyPages.length} of ${pageCount} pages exposed no readable text`,
        note: emptyPages.length === 0 ? undefined : "The page exposed no readable text content to the crawler.",
        ...(emptyPages.length > 0
          ? { affectedUrls: boundedUrls(emptyPages.map((p, i) => urlOf(p, i, evidence.sourceUrl))) }
          : {}),
      },
    ),
  )

  // 7. Site breadth
  const pagesCrawled = evidence.usage?.pagesCrawled ?? pageCount
  findings.push(
    finding(
      "site_breadth",
      "Multiple pages reachable",
      pagesCrawled > 1 ? "pass" : "not_observed",
      "info",
      "crawlability",
      {
        observed: `${pagesCrawled} page${pagesCrawled === 1 ? "" : "s"} crawled`,
        note: pagesCrawled > 1 ? undefined : "Only the entry page was reachable during this bounded crawl.",
      },
    ),
  )

  // 8. Images (count only — alt text is not carried in normalized evidence).
  const imageCount = pages.reduce((n, p) => n + (p.images?.length ?? 0), 0)
  findings.push(
    finding(
      "images",
      "Images present",
      imageCount > 0 ? "pass" : "not_observed",
      "info",
      "media",
      {
        observed:
          imageCount > 0
            ? `${imageCount} image${imageCount === 1 ? "" : "s"}. (Alt text is not read by the crawler — review manually.)`
            : undefined,
      },
    ),
  )

  // 9/10. Duplicate metadata across inspected pages.
  findings.push(
    duplicateFinding("duplicate_titles", "Unique page titles", "medium", titles, pageCount),
    duplicateFinding("duplicate_descriptions", "Unique meta descriptions", "low", descriptions, pageCount),
  )

  // 11/12. Signals the crawler does NOT capture — explicitly not_observed,
  // never fabricated. (Rankings, robots.txt, sitemap, canonical, social tags.)
  findings.push(
    finding("canonical", "Canonical URL", "not_observed", "info", "metadata", { note: "The crawler does not read the <link rel=canonical> tag." }),
    finding("robots", "robots.txt / sitemap", "not_observed", "info", "crawlability", { note: "Indexing directives are not fetched in this bounded, read-only audit." }),
  )

  return {
    findings,
    score: summarize(findings),
    auditScore: calculateSeoScore(findings),
    pagesCrawled,
  }
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
