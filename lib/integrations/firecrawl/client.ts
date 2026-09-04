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
  if (!key) throw new ProviderNotConfiguredError("Firecrawl")

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
      throw new Error(`Firecrawl request failed (${res.status}): ${text.slice(0, 200)}`)
    }
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
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
}

/** POST /v2/crawl — recursively crawl an entire site. Returns all discovered pages. */
export async function crawlSiteUrl(url: string, limit: number, timeoutMs: number): Promise<{ pages: Record<string, unknown>[] }> {
  // Start the crawl job
  const startRes = await firecrawlFetch<{ id?: string }>("/v2/crawl", {
    url,
    limit,
    scrapeOptions: {
      formats: ["markdown", "links"],
      onlyMainContent: false,
    },
  }, timeoutMs)

  const crawlId = startRes.id
  if (!crawlId) throw new Error("Firecrawl crawl: no job ID returned")

  // Poll for completion (max 120s)
  const pollInterval = 3000
  const maxPolls = Math.floor(timeoutMs / pollInterval)
  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, pollInterval))
    const status = await firecrawlFetch<FirecrawlCrawlResponse>(
      `/v2/crawl/${crawlId}`,
      {},
      10_000,
      "GET",
    )
    // The GET endpoint returns data differently — try both shapes
    if (status.completed || (Array.isArray(status.data) && status.data.length > 0)) {
      return { pages: (status.data as Record<string, unknown>[]) ?? [] }
    }
  }

  // Fallback: try to get whatever data we have
  const finalRes = await firecrawlFetch<FirecrawlCrawlResponse>(
    `/v2/crawl/${crawlId}`,
    {},
    10_000,
    "GET",
  )
  return { pages: (finalRes.data as Record<string, unknown>[]) ?? [] }
}
