/** Normalized website evidence produced by the Firecrawl service. This is the
 * ONLY shape the rest of MirrorSite consumes — raw Firecrawl responses never
 * leak past this module (spec section 40). */
export interface FirecrawlPageEvidence {
  url: string
  title?: string
  description?: string
  markdown?: string
  headings: string[]
  links: string[]
  images: string[]
  screenshot?: string
}

export interface WebsiteEvidence {
  sourceUrl: string
  title?: string
  description?: string
  pages: FirecrawlPageEvidence[]
  navigation: string[]
  assets: string[]
  screenshots: string[]
  metadata: Record<string, unknown>
  usage: {
    pagesCrawled: number
    creditsEstimated: number
    cached: boolean
  }
  collectedAt: number
}

export interface FirecrawlOptions {
  maxPages?: number
  includeScreenshots?: boolean
  timeoutMs?: number
}
