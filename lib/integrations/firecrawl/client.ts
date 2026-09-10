import "server-only"
import { logger } from "@/lib/logging/logger"

/** Thin server-side Firecrawl HTTP client. The API key is read from the server
 * environment and never exposed to the browser (spec section 26). */
const FIRECRAWL_BASE = "https://api.firecrawl.dev"

export class ProviderNotConfiguredError extends Error {
  code = "PROVIDER_NOT_CONFIGURED" as const
  constructor(public provider: string) {
    super(`${provider} is not configured`)
  }
}

export function isFirecrawlConfigured() {
  return Boolean(process.env.FIRECRAWL_API_KEY)
}

async function firecrawlFetch<T>(path: string, body: unknown, timeoutMs: number, method: "POST" | "GET" = "POST"): Promise<T> {
  const key = process.env.FIRECRAWL_API_KEY
  if (!key) throw new ProviderNotConfiguredError("Website crawling service")

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const opts: RequestInit = {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      signal: controller.signal,
    }
    if (method === "POST") opts.body = JSON.stringify(body)
    const res = await fetch(`${FIRECRAWL_BASE}${path}`, opts)
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      logger.error("firecrawl.http", "request failed", { path, status: res.status })
      throw new Error(`Website crawl request failed (${res.status}): ${text.slice(0, 200)}`)
    }
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

/** Firecrawl web search result */
export interface FirecrawlSearchResult {
  title: string
  description: string
  url: string
  markdown?: string
  html?: string
  links?: string[]
  screenshot?: string
  metadata?: {
    title?: string
    description?: string
    sourceURL?: string
  }
}

export interface FirecrawlSearchResponse {
  success: boolean
  data: {
    web?: FirecrawlSearchResult[]
    images?: Array<{
      title: string
      imageUrl: string
      url: string
    }>
    news?: FirecrawlSearchResult[]
  }
  creditsUsed?: number
}

/** POST /v2/search — web search with optional page scraping */
export async function searchWeb(
  query: string,
  options: {
    limit?: number
    scrapeOptions?: {
      formats?: string[]
      includeTags?: string[]
      excludeTags?: string[]
    }
  } = {}
): Promise<FirecrawlSearchResponse> {
  logger.info("firecrawl.search", "searching web", { query, limit: options.limit })

  const body = {
    query,
    limit: options.limit ?? 5,
    scrapeOptions: options.scrapeOptions ?? {
      formats: ["markdown", "links"],
    },
  }

  const result = await firecrawlFetch<FirecrawlSearchResponse>(
    "/v2/search",
    body,
    30_000, // 30 second timeout per search
    "POST"
  )

  logger.info("firecrawl.search", "search complete", {
    query,
    webResults: result.data.web?.length ?? 0,
    creditsUsed: result.creditsUsed
  })

  return result
}

/** POST /v2/scrape — single page with rich formats. */
export function scrapeUrl(url: string, screenshot: boolean, timeoutMs: number) {
  const formats: unknown[] = ["markdown", "links"]
  if (screenshot) formats.push({ type: "screenshot", fullPage: false })
  return firecrawlFetch<{ data?: Record<string, unknown> }>("/v2/scrape", { url, formats, onlyMainContent: false }, timeoutMs)
}

/** POST /v2/map — discover the site's URLs cheaply before deciding what to scrape. */
export function mapUrl(url: string, limit: number, timeoutMs: number) {
  return firecrawlFetch<{ links?: Array<string | { url: string }> }>("/v2/map", { url, limit }, timeoutMs)
}

interface FirecrawlCrawlResponse {
  id?: string
  data?: Record<string, unknown>[]
  completed?: boolean
  status?: string
  total?: number
  creditsUsed?: number
  expiresAt?: string
  next?: string
}

/** POST /v2/crawl — recursively crawl an entire site. Returns all discovered pages. */
export async function crawlSiteUrl(url: string, limit: number, timeoutMs: number): Promise<{ pages: Record<string, unknown>[] }> {
  // Start the crawl job - this should be quick, just initiating the crawl
  logger.info("firecrawl.crawlSiteUrl", "starting crawl job", { url, limit })

  const startRes = await firecrawlFetch<{ id?: string }>("/v2/crawl", {
    url,
    limit,
    scrapeOptions: {
      formats: ["markdown", "links"],
      onlyMainContent: false,
    },
  }, 60_000) // 60 second timeout for starting the job

  const crawlId = startRes.id
  if (!crawlId) throw new Error("Website crawl: no job ID returned")

  logger.info("firecrawl.crawlSiteUrl", "crawl job started", { url, crawlId })

  // Poll for completion using the remaining time
  const pollInterval = 3000
  const maxPolls = Math.floor(timeoutMs / pollInterval)
  logger.info("firecrawl.crawlSiteUrl", "starting poll loop", { crawlId, maxPolls, timeoutMs })

  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, pollInterval))

    try {
      const status = await firecrawlFetch<FirecrawlCrawlResponse>(
        `/v2/crawl/${crawlId}`,
        {},
        10_000,
        "GET",
      )

      logger.info("firecrawl.crawlSiteUrl", "poll response", {
        crawlId,
        poll: i + 1,
        completed: status.completed,
        status: status.status,
        total: status.total,
        dataLength: Array.isArray(status.data) ? status.data.length : 0,
        creditsUsed: status.creditsUsed
      })

      // The GET endpoint returns data differently — try both shapes
      if (status.completed || (Array.isArray(status.data) && status.data.length > 0)) {
        logger.info("firecrawl.crawlSiteUrl", "crawl completed", { crawlId, pages: status.data?.length ?? 0 })
        return { pages: (status.data as Record<string, unknown>[]) ?? [] }
      }
    } catch (pollError) {
      logger.warn("firecrawl.crawlSiteUrl", "poll error", {
        crawlId,
        poll: i + 1,
        error: pollError instanceof Error ? pollError.message : String(pollError)
      })
      // Continue polling even if one poll fails
    }
  }

  // Fallback: try to get whatever data we have
  logger.warn("firecrawl.crawlSiteUrl", "max polls reached, fetching final data", { crawlId })

  try {
    const finalRes = await firecrawlFetch<FirecrawlCrawlResponse>(
      `/v2/crawl/${crawlId}`,
      {},
      10_000,
      "GET",
    )

    const pages = (finalRes.data as Record<string, unknown>[]) ?? []

    if (pages.length === 0) {
      logger.error("firecrawl.crawlSiteUrl", "crawl timeout with no data", {
        crawlId,
        url,
        timeoutMs,
        pollsCompleted: maxPolls,
        finalStatus: finalRes.status
      })

      const minutes = Math.floor(timeoutMs / 60000)
      throw new Error(`Deep crawl timed out after ${minutes} minutes with no pages collected. 

This usually means:
• The site is blocking automated crawlers (common for Netflix, streaming services, banking sites)
• The site requires JavaScript/authentication to load content
• Our crawling service is experiencing issues processing this site

Recommendations:
1. Try using Smart Crawl mode instead (faster, works for most sites)
2. Test with a simpler website first (e.g., a blog or documentation site)
3. Check if the site allows automated crawling in their robots.txt`)
    }

    logger.info("firecrawl.crawlSiteUrl", "returning partial data", { crawlId, pages: pages.length })
    return { pages }
  } catch (fetchError) {
    logger.error("firecrawl.crawlSiteUrl", "final fetch failed", {
      crawlId,
      error: fetchError instanceof Error ? fetchError.message : String(fetchError)
    })
    throw fetchError
  }
}
