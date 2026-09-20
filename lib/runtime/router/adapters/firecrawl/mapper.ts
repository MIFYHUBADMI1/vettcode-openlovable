import "server-only"
import { z } from "zod"
import type { ProviderExecutionResponse } from "@/runtime/contracts/router"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import { assertPublicHttpUrl } from "@/lib/runtime/router/adapters/shared/ssrf"

/**
 * Atai Runtime — Firecrawl request/response mapper (server-only).
 *
 * Owns the translations for `search.web`/`web` and `web.scrape`/`scrape`.
 * Strict schemas reject unknown fields; URLs pass an SSRF guard BEFORE any
 * provider contact (§42): the runtime must not become a fetch proxy for
 * internal infrastructure. The guard is defense-in-depth — Firecrawl fetches
 * from its own infrastructure, but policy-wise Atai never forwards URLs
 * targeting private networks, loopback, link-local (cloud metadata), or
 * internal hostnames. Note: DNS rebinding is out of scope here (no async
 * resolution in this layer; the provider performs its own resolution).
 *
 * @module lib/runtime/router/adapters/firecrawl/mapper
 */

export { assertPublicHttpUrl } from "@/lib/runtime/router/adapters/shared/ssrf"

/** ── Search (search.web / web) ─────────────────────────────────────────── */

export const SearchWebInputSchema = z
  .object({
    query: z.string().min(1).max(400),
    limit: z.number().int().min(1).max(10).optional(),
  })
  .strict()

export type SearchWebInput = z.infer<typeof SearchWebInputSchema>

export function toFirecrawlSearch(input: unknown): { query: string; limit: number } {
  const parsed = SearchWebInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ProviderExecutionError(
      "unsupported_operation",
      "The request body is invalid for this capability.",
      `search input validation failed: ${parsed.error.issues[0]?.path.join(".") ?? "unknown"} ${
        parsed.error.issues[0]?.message ?? ""
      }`.trim(),
    )
  }
  return { query: parsed.data.query, limit: parsed.data.limit ?? 5 }
}

/** Provider-neutral search result item. */
export interface WebResultItem {
  title: string
  url: string
  description?: string
}

export interface WebSearchResultData {
  results: WebResultItem[]
  creditsUsed?: number
}

/** Documented Firecrawl v2 search response (subset the contract consumes). */
export interface FirecrawlSearchResponse {
  success?: boolean
  data?: {
    web?: Array<{ title?: string; description?: string; url?: string }>
  }
  creditsUsed?: number
}

function safeMetadata(creditsUsed: unknown): { inputTokens: number; outputTokens: number; metadata?: Record<string, unknown> } {
  const metadata: Record<string, unknown> = {}
  if (typeof creditsUsed === "number" && Number.isFinite(creditsUsed) && creditsUsed >= 0) {
    metadata.creditsUsed = creditsUsed
  }
  return { inputTokens: 0, outputTokens: 0, ...(Object.keys(metadata).length > 0 ? { metadata } : {}) }
}

export function toSearchResult(response: FirecrawlSearchResponse): ProviderExecutionResponse<WebSearchResultData> {
  if (response.success === false) {
    throw new ProviderExecutionError("provider_error", "The search provider returned an error.", "provider reported success=false")
  }
  const web = response.data?.web
  if (!Array.isArray(web)) {
    throw new ProviderExecutionError("provider_error", "The search provider returned an invalid response.", "missing data.web array")
  }
  const results: WebResultItem[] = []
  for (const item of web) {
    if (typeof item?.url === "string" && typeof item?.title === "string") {
      results.push({
        title: item.title,
        url: item.url,
        ...(typeof item.description === "string" ? { description: item.description } : {}),
      })
    }
  }
  return {
    provider: "firecrawl",
    data: { results, ...(typeof response.creditsUsed === "number" ? { creditsUsed: response.creditsUsed } : {}) },
    usage: safeMetadata(response.creditsUsed),
  }
}

/** ── Scrape (web.scrape / scrape) ──────────────────────────────────────── */

export const ScrapeInputSchema = z
  .object({
    url: z.string().min(1).max(2048),
  })
  .strict()

export type ScrapeInput = z.infer<typeof ScrapeInputSchema>

/** Markdown is capped in the runtime response (§43 — bounded response size). */
export const MAX_SCRAPE_MARKDOWN_CHARS = 100_000
const MAX_SCRAPE_LINKS = 100

export interface ScrapeResultData {
  url: string
  title?: string
  markdown?: string
  links?: string[]
  truncated?: boolean
  creditsUsed?: number
}

export interface FirecrawlScrapeResponse {
  success?: boolean
  data?: {
    markdown?: string
    links?: unknown
    metadata?: { title?: unknown; sourceURL?: unknown }
  }
  creditsUsed?: number
}

export function toFirecrawlScrape(input: unknown): { url: string } {
  const parsed = ScrapeInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ProviderExecutionError(
      "unsupported_operation",
      "The request body is invalid for this capability.",
      `scrape input validation failed: ${parsed.error.issues[0]?.path.join(".") ?? "unknown"} ${
        parsed.error.issues[0]?.message ?? ""
      }`.trim(),
    )
  }
  // SSRF guard BEFORE any provider contact (§42).
  assertPublicHttpUrl(parsed.data.url)
  return { url: parsed.data.url }
}

export function toScrapeResult(response: FirecrawlScrapeResponse, requestedUrl: string): ProviderExecutionResponse<ScrapeResultData> {
  if (response.success === false) {
    throw new ProviderExecutionError("provider_error", "The scrape provider returned an error.", "provider reported success=false")
  }
  const data = response.data
  if (typeof data !== "object" || data === null) {
    throw new ProviderExecutionError("provider_error", "The scrape provider returned an invalid response.", "missing data object")
  }

  const rawMarkdown = typeof data.markdown === "string" ? data.markdown : undefined
  const truncated = rawMarkdown !== undefined && rawMarkdown.length > MAX_SCRAPE_MARKDOWN_CHARS
  const markdown = rawMarkdown === undefined ? undefined : rawMarkdown.slice(0, MAX_SCRAPE_MARKDOWN_CHARS)

  const links = Array.isArray(data.links)
    ? data.links.filter((l): l is string => typeof l === "string").slice(0, MAX_SCRAPE_LINKS)
    : undefined

  const sourceUrl = typeof data.metadata?.sourceURL === "string" && data.metadata.sourceURL ? data.metadata.sourceURL : requestedUrl
  const title = typeof data.metadata?.title === "string" && data.metadata.title ? data.metadata.title : undefined

  return {
    provider: "firecrawl",
    data: {
      url: sourceUrl,
      ...(title ? { title } : {}),
      ...(markdown !== undefined ? { markdown } : {}),
      ...(links !== undefined ? { links } : {}),
      ...(truncated ? { truncated } : {}),
      ...(typeof response.creditsUsed === "number" ? { creditsUsed: response.creditsUsed } : {}),
    },
    usage: safeMetadata(response.creditsUsed),
  }
}
