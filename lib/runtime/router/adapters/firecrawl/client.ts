import "server-only"
import { logger } from "@/lib/logging/logger"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import { firecrawlHeaders, getFirecrawlBaseUrl, getFirecrawlTimeoutMs } from "./config"
import { categoryForStatus } from "../shared/errors"
import { providerFetch, parseJsonBody, providerStatusFailure } from "../shared/http"
import type { FirecrawlScrapeResponse, FirecrawlSearchResponse } from "./mapper"

/**
 * Atai Runtime — Firecrawl HTTP client (server-only, runtime flow).
 *
 * The ONLY place the runtime Firecrawl adapter touches the network. Keep
 * separate from the build-time client (lib/integrations/firecrawl — §63);
 * both use the same server credential but never share code or state.
 *
 * @module lib/runtime/router/adapters/firecrawl/client
 */

const SAFE_MESSAGES: Record<string, string> = {
  search: "The search provider is temporarily unavailable.",
  scrape: "The scrape provider is temporarily unavailable.",
}

async function executePost<T>(params: {
  path: string
  body: Record<string, unknown>
  op: "search" | "scrape"
  requestId?: string
}): Promise<T> {
  const startedAt = Date.now()
  const res = await providerFetch({
    url: `${getFirecrawlBaseUrl()}${params.path}`,
    method: "POST",
    headers: firecrawlHeaders(),
    body: JSON.stringify(params.body),
    timeoutMs: getFirecrawlTimeoutMs(),
    requestId: params.requestId,
  })

  const latencyMs = Date.now() - startedAt
  if (!res.ok) {
    logger.error("runtime.firecrawl", "provider returned an error status", {
      ...(params.requestId ? { requestId: params.requestId } : {}),
      op: params.op,
      status: res.status,
      latencyMs,
      detail: res.text.slice(0, 300),
    })
    throw providerStatusFailure(categoryForStatus(res.status), SAFE_MESSAGES[params.op], res.text)
  }

  logger.info("runtime.firecrawl", "provider call complete", {
    ...(params.requestId ? { requestId: params.requestId } : {}),
    op: params.op,
    status: res.status,
    latencyMs,
  })
  return parseJsonBody<T>(res)
}

/** POST /v2/search — provider-neutral web search. */
export function executeSearch(params: {
  query: string
  limit: number
  requestId?: string
}): Promise<FirecrawlSearchResponse> {
  return executePost<FirecrawlSearchResponse>({
    path: "/v2/search",
    body: { query: params.query, limit: params.limit },
    op: "search",
    requestId: params.requestId,
  })
}

/** POST /v2/scrape — single-page scrape with bounded formats. */
export function executeScrape(params: { url: string; requestId?: string }): Promise<FirecrawlScrapeResponse> {
  return executePost<FirecrawlScrapeResponse>({
    path: "/v2/scrape",
    body: { url: params.url, formats: ["markdown", "links"], onlyMainContent: false },
    op: "scrape",
    requestId: params.requestId,
  })
}
