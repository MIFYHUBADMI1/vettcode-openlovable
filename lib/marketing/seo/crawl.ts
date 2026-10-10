import "server-only"

/**
 * Guarded crawl wrapper (Phase 3 — W2).
 *
 * The ONLY place this feature touches the outside web. It reuses the existing
 * Firecrawl service (`crawlWebsite`) and runs every URL through the platform's
 * proven SSRF guard (`assertPublicHttpUrl`) before handing it to the provider.
 * No raw HTML or provider credentials ever leave here — callers receive the
 * normalized `WebsiteEvidence` only.
 */

import { crawlWebsite } from "@/lib/integrations/firecrawl/service"
import { isFirecrawlConfigured } from "@/lib/integrations/firecrawl/client"
import { assertPublicHttpUrl } from "@/lib/runtime/router/adapters/shared/ssrf"
import type { WebsiteEvidence } from "@/lib/integrations/firecrawl/types"
import { AppError } from "@/lib/errors"
import { logger } from "@/lib/logging/logger"

export { isFirecrawlConfigured }

export interface CrawlResult {
  evidence: WebsiteEvidence
  fromCache: boolean
}

/**
 * Crawl a public URL and return normalized evidence.
 * @throws AppError("VALIDATION")     for non-public / unsafe URLs.
 * @throws AppError("FIRECRAWL_UNAVAILABLE") when the provider is not wired or the crawl fails.
 */
export async function crawlUrlToEvidence(url: string): Promise<CrawlResult> {
  // Defense in depth — the URL is normally our own deployed production URL,
  // but validate anyway so an unguarded value can never reach the provider.
  let safe: URL
  try {
    safe = assertPublicHttpUrl(url)
  } catch {
    logger.warn("marketing.seo.crawl", "rejected unsafe url", { url: safeHost(url) })
    throw new AppError("VALIDATION", "That URL cannot be audited.")
  }

  try {
    // Bounded single-site smart crawl; no screenshots to keep cost/size small.
    const evidence = await crawlWebsite(safe.toString(), { includeScreenshots: false, maxPages: 8 })
    return { evidence, fromCache: evidence.usage?.cached === true }
  } catch (e) {
    logger.warn("marketing.seo.crawl", "crawl failed", {
      host: safeHost(safe.toString()),
      message: e instanceof Error ? e.message : String(e),
    })
    throw new AppError("FIRECRAWL_UNAVAILABLE")
  }
}

function safeHost(raw: string): string {
  try {
    return new URL(raw).host
  } catch {
    return "invalid-url"
  }
}
