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

async function firecrawlFetch<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const key = process.env.FIRECRAWL_API_KEY
  if (!key) throw new ProviderNotConfiguredError("Firecrawl")

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${FIRECRAWL_BASE}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
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
