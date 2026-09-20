import "server-only"
import { logger } from "@/lib/logging/logger"
import type {
  ProviderExecutionRequest,
  ProviderExecutionResponse,
} from "@/runtime/contracts/router"
import type { RuntimeProviderAdapter } from "@/lib/runtime/router/adapter"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import { executeScrape, executeSearch } from "./client"
import {
  toFirecrawlScrape,
  toFirecrawlSearch,
  toScrapeResult,
  toSearchResult,
  type ScrapeResultData,
  type WebSearchResultData,
} from "./mapper"

/**
 * Atai Runtime — Firecrawl provider adapter (server-only).
 *
 * Serves the provider-neutral `search.web`/`web` and `web.scrape`/`scrape`
 * capability+operation pairs (Phase 10 §12) through the EXISTING
 * RuntimeProviderAdapter interface. All supported operations are explicitly
 * defined here — the runtime is never an arbitrary URL proxy (§53).
 *
 * @module lib/runtime/router/adapters/firecrawl/adapter
 */

export const FIRECRAWL_PROVIDER_ID = "firecrawl"

class FirecrawlAdapter implements RuntimeProviderAdapter {
  readonly provider = FIRECRAWL_PROVIDER_ID

  supports(capability: string, operation: string): boolean {
    return (capability === "search.web" && operation === "web") || (capability === "web.scrape" && operation === "scrape")
  }

  async execute(request: ProviderExecutionRequest): Promise<ProviderExecutionResponse<WebSearchResultData | ScrapeResultData>> {
    const { capability, operation } = request.request

    if (capability === "search.web" && operation === "web") {
      const { query, limit } = toFirecrawlSearch(request.request.input)
      const response = await executeSearch({ query, limit, requestId: request.requestId })
      const result = toSearchResult(response)
      logger.info("runtime.firecrawl", "provider execution complete", {
        requestId: request.requestId,
        provider: this.provider,
        capability,
        operation,
        resultCount: result.data.results.length,
        latencyMs: Date.now(),
      })
      return result
    }

    if (capability === "web.scrape" && operation === "scrape") {
      const { url } = toFirecrawlScrape(request.request.input)
      const response = await executeScrape({ url, requestId: request.requestId })
      const result = toScrapeResult(response, url)
      logger.info("runtime.firecrawl", "provider execution complete", {
        requestId: request.requestId,
        provider: this.provider,
        capability,
        operation,
        hostScraped: new URL(url).host,
        latencyMs: Date.now(),
      })
      return result
    }

    // Unreachable: supports() gates routing. Defensive normalized failure.
    throw new ProviderExecutionError(
      "unsupported_operation",
      "The requested operation is not supported.",
    )
  }
}

/** The singleton adapter instance registered with the Phase 5 registry. */
export const firecrawlAdapter = new FirecrawlAdapter()
