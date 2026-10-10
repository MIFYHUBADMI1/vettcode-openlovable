import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { auditWebsiteEvidence, deriveRecommendations } from "./auditor"
import type { WebsiteEvidence } from "@/lib/integrations/firecrawl/types"

/**
 * Deterministic SEO auditor tests (Phase 3 — W2). The auditor is pure: same
 * evidence must always yield the same findings (reproducibility), and every
 * signal the crawler does NOT capture must be `not_observed` — never guessed,
 * never shown as a failure. No ranking/traffic claims exist as findings.
 */

function evidenceFixture(overrides: Partial<WebsiteEvidence> = {}, pageOverrides: Partial<WebsiteEvidence["pages"][number]> = {}): WebsiteEvidence {
  return {
    sourceUrl: "https://acme.example.com",
    title: "Acme — build faster",
    description: "Acme helps teams ship internal tools without writing boilerplate.",
    pages: [
      {
        url: "https://acme.example.com",
        title: "Acme — build faster",
        description: "Acme helps teams ship internal tools without writing boilerplate.",
        headings: ["Build faster", "Pricing"],
        links: ["https://acme.example.com/pricing", "https://acme.example.com/docs"],
        images: ["https://acme.example.com/hero.png"],
        markdown: "Welcome to Acme. We help teams ship internal tools.",
        ...pageOverrides,
      },
    ],
    navigation: [],
    assets: [],
    screenshots: [],
    metadata: {},
    usage: { pagesCrawled: 1, creditsEstimated: 1, cached: false },
    collectedAt: 1,
    ...overrides,
  }
}

function find(findings: ReturnType<typeof auditWebsiteEvidence>["findings"], id: string) {
  return findings.find((f) => f.id === id)
}

describe("auditWebsiteEvidence", () => {
  it("passes on-page fundamentals when evidence shows them", () => {
    const { findings } = auditWebsiteEvidence(evidenceFixture())
    expect(find(findings, "https")!.status).toBe("pass")
    expect(find(findings, "title")!.status).toBe("pass")
    expect(find(findings, "meta_description")!.status).toBe("pass")
    expect(find(findings, "headings")!.status).toBe("pass")
    expect(find(findings, "internal_links")!.status).toBe("pass")
    expect(find(findings, "indexable_content")!.status).toBe("pass")
  })

  it("fails when title/description/content are absent, with honest notes", () => {
    const e = evidenceFixture({ title: "", description: "" }, { title: "", description: "", markdown: "   ", headings: [], links: [], images: [] })
    const { findings } = auditWebsiteEvidence(e)
    expect(find(findings, "title")!.status).toBe("fail")
    expect(find(findings, "meta_description")!.status).toBe("fail")
    expect(find(findings, "indexable_content")!.status).toBe("fail")
    // Headings/links with no evidence are NOT observed, not failures.
    expect(find(findings, "headings")!.status).toBe("not_observed")
    expect(find(findings, "internal_links")!.status).toBe("not_observed")
  })

  it("flags an over-long title as a failure", () => {
    const long = "x".repeat(80)
    const e = evidenceFixture({ title: long }, { title: long })
    expect(find(auditWebsiteEvidence(e).findings, "title")!.status).toBe("fail")
  })

  it("marks http (non-https) as a failure", () => {
    const e = evidenceFixture({ sourceUrl: "http://acme.example.com" })
    expect(find(auditWebsiteEvidence(e).findings, "https")!.status).toBe("fail")
  })

  it("NEVER claims rankings, traffic or conversions, and keeps uncapturable signals not_observed", () => {
    const { findings, score } = auditWebsiteEvidence(evidenceFixture())
    // Canonical + robots/sitemap are never observed from markdown-only evidence.
    expect(find(findings, "canonical")!.status).toBe("not_observed")
    expect(find(findings, "robots")!.status).toBe("not_observed")
    expect(score.notObserved).toBeGreaterThanOrEqual(2)
    // No finding references a ranking/traffic number.
    const serialized = JSON.stringify(findings).toLowerCase()
    expect(serialized).not.toMatch(/rank|traffic|page ?one|visitors/)
  })

  it("is reproducible — identical evidence yields identical findings", () => {
    const a = auditWebsiteEvidence(evidenceFixture())
    const b = auditWebsiteEvidence(evidenceFixture())
    expect(a).toEqual(b)
  })
})

describe("deriveRecommendations", () => {
  it("produces guidance only from failing checks, labeled observed-derived", () => {
    const e = evidenceFixture({ description: "" }, { description: "" })
    const { findings } = auditWebsiteEvidence(e)
    const recs = deriveRecommendations(findings)
    const ids = recs.map((r) => r.findingId)
    expect(ids).toContain("meta_description")
    // A not_observed check (canonical) must never generate a recommendation.
    expect(ids).not.toContain("canonical")
    expect(recs.every((r) => r.basis === "observed_failures")).toBe(true)
  })

  it("returns nothing when there are no failures", () => {
    const { findings } = auditWebsiteEvidence(evidenceFixture())
    const clean = findings.filter((f) => f.status !== "fail")
    expect(deriveRecommendations(clean)).toHaveLength(0)
  })
})
