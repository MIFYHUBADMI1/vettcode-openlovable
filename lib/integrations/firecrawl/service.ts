import "server-only"
import { logger } from "@/lib/logging/logger"
import { scrapeUrl, mapUrl, crawlSiteUrl, isFirecrawlConfigured, searchWeb, type FirecrawlSearchResult } from "./client"
import type { FirecrawlOptions, FirecrawlPageEvidence, WebsiteEvidence } from "./types"
import { firecrawlCacheCol } from "@/lib/db/collections"

export { isFirecrawlConfigured }

/** Firecrawl cost-control defaults (spec section 24). */
const DEFAULTS = {
  maxPages: 7,
  includeScreenshots: true,
  timeoutMs: 45_000,
  maxScreenshots: 3,
  maxContentChars: 20_000,
}

/** Cache TTL: 7 days (in milliseconds) */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Get cached website evidence from database
 */
async function getCachedEvidence(url: string, crawlMode: "smart" | "deep"): Promise<WebsiteEvidence | null> {
  try {
    const col = await firecrawlCacheCol()
    const cached = await col.findOne({ url, crawlMode })

    if (!cached) {
      logger.info("firecrawl.cache", "cache miss", { url, crawlMode })
      return null
    }

    // Check if cache is still valid
    if (cached.expiresAt < Date.now()) {
      logger.info("firecrawl.cache", "cache expired", { url, crawlMode, expiresAt: cached.expiresAt })
      // Let TTL index handle deletion
      return null
    }

    logger.info("firecrawl.cache", "cache hit", {
      url,
      crawlMode,
      age: Date.now() - cached.collectedAt
    })

    return cached.evidence as WebsiteEvidence
  } catch (error) {
    logger.warn("firecrawl.cache", "cache read failed", {
      url,
      crawlMode,
      error: error instanceof Error ? error.message : String(error)
    })
    return null
  }
}

/**
 * Store website evidence in database cache
 */
async function setCachedEvidence(url: string, crawlMode: "smart" | "deep", evidence: WebsiteEvidence): Promise<void> {
  try {
    const col = await firecrawlCacheCol()
    const now = Date.now()

    await col.updateOne(
      { url, crawlMode },
      {
        $set: {
          evidence,
          collectedAt: now,
          expiresAt: now + CACHE_TTL_MS,
          createdAt: now,
        },
      },
      { upsert: true }
    )

    logger.info("firecrawl.cache", "cache stored", { url, crawlMode, ttl: CACHE_TTL_MS })
  } catch (error) {
    logger.warn("firecrawl.cache", "cache write failed", {
      url,
      crawlMode,
      error: error instanceof Error ? error.message : String(error)
    })
    // Don't throw - caching is best-effort
  }
}

export function normalizeUrl(input: string): string {
  let url = input.trim()
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  const u = new URL(url)
  u.hash = ""
  // Drop trailing slash for a stable cache key.
  const path = u.pathname.replace(/\/+$/, "")
  return `${u.protocol}//${u.host}${path}${u.search}`
}

/**
 * Extract the application/site name from a URL for web search queries.
 * Examples: "netflix.com" -> "Netflix", "github.com" -> "GitHub"
 */
function extractAppName(url: string): string {
  try {
    const u = new URL(url)
    const hostname = u.hostname.replace(/^www\./, "")
    const parts = hostname.split(".")
    // Take the main domain part (before TLD)
    const mainPart = parts[parts.length - 2] || parts[0]
    // Capitalize first letter
    return mainPart.charAt(0).toUpperCase() + mainPart.slice(1)
  } catch {
    return "the website"
  }
}

/**
 * Perform web searches to supplement direct crawl data.
 * Used when crawling fails or returns minimal data (e.g., anti-bot protection).
 */
async function supplementWithWebSearch(url: string, appName: string): Promise<FirecrawlPageEvidence[]> {
  logger.info("firecrawl.webSearch", "supplementing crawl data", { url, appName })

  const searches = [
    `${appName} features and functionality`,
    `${appName} about page user guide`,
    `${appName} help documentation`,
    `what is ${appName} app`,
  ]

  const allResults: FirecrawlPageEvidence[] = []

  for (const query of searches) {
    try {
      const searchResult = await searchWeb(query, {
        limit: 3,
        scrapeOptions: {
          formats: ["markdown", "links"],
        }
      })

      // Convert search results to page evidence
      const webResults = searchResult.data.web ?? []
      for (const result of webResults) {
        if (!result.url || !result.markdown) continue

        const markdown = result.markdown.slice(0, DEFAULTS.maxContentChars)
        const headings = markdown
          ? markdown
            .split("\n")
            .filter((l) => /^#{1,3}\s/.test(l))
            .map((l) => l.replace(/^#{1,3}\s/, "").trim())
            .slice(0, 40)
          : []

        allResults.push({
          url: result.url,
          title: result.title,
          description: result.description,
          markdown,
          headings,
          links: result.links ?? [],
          images: [],
          screenshot: result.screenshot,
          metadata: {
            sourceURL: result.url,
            fromWebSearch: true,
            searchQuery: query,
          },
        })
      }
    } catch (error) {
      logger.warn("firecrawl.webSearch", "search failed", {
        query,
        error: error instanceof Error ? error.message : String(error)
      })
      // Continue with other searches even if one fails
    }
  }

  logger.info("firecrawl.webSearch", "supplement complete", {
    url,
    searchesPerformed: searches.length,
    pagesFound: allResults.length
  })

  return allResults
}

function toPageEvidence(url: string, data: Record<string, unknown> | undefined): FirecrawlPageEvidence {
  const meta = (data?.metadata ?? {}) as Record<string, unknown>
  const links = Array.isArray(data?.links) ? (data!.links as string[]).slice(0, 60) : []
  const markdown = typeof data?.markdown === "string" ? data.markdown.slice(0, DEFAULTS.maxContentChars) : undefined
  const headings = markdown
    ? markdown
      .split("\n")
      .filter((l) => /^#{1,3}\s/.test(l))
      .map((l) => l.replace(/^#{1,3}\s/, "").trim())
      .slice(0, 40)
    : []
  const images = markdown ? [...markdown.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]).slice(0, 30) : []
  return {
    url,
    title: (meta.title as string) ?? (data?.title as string),
    description: (meta.description as string) ?? undefined,
    markdown,
    headings,
    links,
    images,
    screenshot: typeof data?.screenshot === "string" ? (data.screenshot as string) : undefined,
    metadata: Object.keys(meta).length > 0 ? meta : undefined,
  }
}

/**
 * Score a URL path by how likely it is to reveal application structure and
 * functionality. Higher = more useful for understanding the app.
 */
function scorePageUrl(pathname: string): number {
  const p = pathname.toLowerCase().replace(/\/+$/, "") || "/"

  // High-value pages that describe what the app IS and DOES
  const highValue = ["about", "features", "pricing", "product", "overview", "demo", "solutions", "services", "platform", "capabilities", "integrations", "docs", "documentation", "help", "support", "faq", "changelog", "blog"]
  if (highValue.includes(p.replace(/^\//, ""))) return 10
  // Homepage / landing
  if (p === "/") return 9
  // Feature-adjacent paths (2+ segments but still informational)
  if (p.startsWith("/blog/") || p.startsWith("/docs/")) return 8
  if (p.startsWith("/features/") || p.startsWith("/solutions/")) return 8
  // Generic inner pages (likely informational)
  if (p.split("/").length === 2) return 5

  // Low-value / noisy patterns — avoid user-generated content
  if (p.includes("/share/")) return -10
  if (p.startsWith("/s/")) return -10
  if (p.startsWith("/g/")) return -10
  if (p.startsWith("/c/")) return -10
  if (p.includes("/user/")) return -10
  if (p.includes("/profile/")) return -10
  if (p.includes("/conversation/")) return -10
  if (p.includes("/chat/")) return -10
  if (/\.(jpg|jpeg|png|gif|svg|webp|css|js|ico|woff|woff2|ttf|map)$/i.test(p)) return -10
  if (p.startsWith("/api")) return -10
  if (p.startsWith("/auth")) return -10
  if (p.startsWith("/login") || p.startsWith("/signup") || p.startsWith("/register") || p.startsWith("/signin")) return -10
  if (p.startsWith("/settings") || p.startsWith("/account") || p.startsWith("/dashboard")) return -10
  if (p.includes("?")) return -5 // query-string pages are often session-specific

  // Neutral fallback
  return 2
}

/** Select the most relevant subpages to scrape, ranked by usefulness. */
function selectRelevantPages(root: string, discovered: string[], max: number): string[] {
  const rootHost = new URL(root).host
  const seen = new Set<string>([normalizeUrl(root)])
  const candidates: { url: string; score: number }[] = []

  for (const raw of discovered) {
    try {
      const n = normalizeUrl(raw)
      if (seen.has(n)) continue
      if (new URL(n).host !== rootHost) continue
      seen.add(n)
      candidates.push({ url: n, score: scorePageUrl(new URL(n).pathname) })
    } catch {
      /* ignore malformed url */
    }
  }

  // Sort highest score first, then by discovery order for ties.
  candidates.sort((a, b) => b.score - a.score)
  return candidates
    .filter((c) => c.score > 0) // skip outright noise
    .slice(0, max - 1)
    .map((c) => c.url)
}

/**
 * crawlWebsite — collects rich, normalized website evidence with strict cost
 * controls. Uses map (cheap) to discover URLs, then scrapes a capped set of the
 * most relevant pages with screenshots on the primary pages only.
 * 
 * Now uses database-backed caching with 7-day TTL.
 */
export async function crawlWebsite(inputUrl: string, options: FirecrawlOptions = {}): Promise<WebsiteEvidence> {
  const opts = { ...DEFAULTS, ...options }
  const root = normalizeUrl(inputUrl)

  // Check database cache
  const cached = await getCachedEvidence(root, "smart")
  if (cached) {
    console.log("[v0] firecrawl.crawl: cache hit", { root })
    return { ...cached, usage: { ...cached.usage, cached: true } }
  }

  console.log("[v0] firecrawl.crawl: step 1/3 scraping root page", { root, includeScreenshots: opts.includeScreenshots })
  logger.info("firecrawl.crawl", "starting", { root, maxPages: opts.maxPages })

  // 1. Scrape the root page (with screenshot).
  const rootRes = await scrapeUrl(root, opts.includeScreenshots, opts.timeoutMs)
  const rootPage = toPageEvidence(root, rootRes.data)
  console.log("[v0] firecrawl.crawl: step 1/3 root page scraped", { root, hasScreenshot: Boolean(rootPage.screenshot) })

  // 2. Discover subpages cheaply and pick a relevant, deduped subset.
  console.log("[v0] firecrawl.crawl: step 2/3 discovering subpages via mapUrl", { root })
  let discovered: string[] = []
  try {
    const mapRes = await mapUrl(root, 40, Math.min(opts.timeoutMs, 20_000))
    discovered = (mapRes.links ?? []).map((l) => (typeof l === "string" ? l : l.url)).filter(Boolean)
    console.log("[v0] firecrawl.crawl: step 2/3 mapUrl discovered links", { root, count: discovered.length })
  } catch (e) {
    console.log("[v0] firecrawl.crawl: step 2/3 mapUrl FAILED, continuing with root only", {
      root,
      message: (e as Error).message,
    })
    logger.warn("firecrawl.map", "map failed, continuing with root only", { message: (e as Error).message })
  }
  const targets = selectRelevantPages(root, discovered, opts.maxPages)
  console.log("[v0] firecrawl.crawl: step 3/3 scraping selected subpages", { root, targets })

  // 3. Scrape selected subpages (screenshots only up to maxScreenshots total).
  const pages: FirecrawlPageEvidence[] = [rootPage]
  let screenshotBudget = opts.includeScreenshots ? DEFAULTS.maxScreenshots - (rootPage.screenshot ? 1 : 0) : 0
  for (const t of targets) {
    try {
      const wantShot = screenshotBudget > 0
      const res = await scrapeUrl(t, wantShot, opts.timeoutMs)
      const page = toPageEvidence(t, res.data)
      if (page.screenshot) screenshotBudget--
      pages.push(page)
      console.log("[v0] firecrawl.crawl: subpage scraped", { url: t, hasScreenshot: Boolean(page.screenshot) })
    } catch (e) {
      console.log("[v0] firecrawl.crawl: subpage FAILED", { url: t, message: (e as Error).message })
      logger.warn("firecrawl.scrape", "subpage failed", { url: t, message: (e as Error).message })
    }
  }

  const screenshots = pages.map((p) => p.screenshot).filter((s): s is string => Boolean(s))
  const assets = [...new Set(pages.flatMap((p) => p.images))].slice(0, 40)
  const navigation = [...new Set(rootPage.links.map((l) => l))].slice(0, 30)

  const evidence: WebsiteEvidence = {
    sourceUrl: root,
    title: rootPage.title,
    description: rootPage.description,
    pages,
    navigation,
    assets,
    screenshots,
    metadata: { discoveredCount: discovered.length, scrapedCount: pages.length },
    usage: { pagesCrawled: pages.length, creditsEstimated: pages.length + screenshots.length, cached: false },
    collectedAt: Date.now(),
  }

  // Store in database cache
  await setCachedEvidence(root, "smart", evidence)

  logger.info("firecrawl.crawl", "complete", { root, pages: pages.length, screenshots: screenshots.length })
  return evidence
}

/**
 * crawlWebsiteDeep — recursively crawls the ENTIRE site using Firecrawl's
 * /v2/crawl endpoint. Returns all discovered pages with their full content.
 * Used for "deep crawl" / exact-replica mode where the user wants the
 * crawled findings passed directly to the builder without AI interpretation.
 * 
 * Now uses database-backed caching with 7-day TTL.
 */
export async function crawlWebsiteDeep(inputUrl: string, maxPages = 50): Promise<WebsiteEvidence> {
  const root = normalizeUrl(inputUrl)
  const timeoutMs = 900_000 // 15 minutes for deep crawl

  // Check database cache
  const cached = await getCachedEvidence(root, "deep")
  if (cached) {
    console.log("[v0] firecrawl.deepCrawl: cache hit", { root })
    return { ...cached, usage: { ...cached.usage, cached: true } }
  }

  console.log("[v0] firecrawl.deepCrawl: starting", { root, maxPages })
  logger.info("firecrawl.deepCrawl", "starting", { root, maxPages })

  // Use the /v2/crawl endpoint to recursively fetch the entire site
  const crawlResult = await crawlSiteUrl(root, maxPages, timeoutMs)
  console.log("[v0] firecrawl.deepCrawl: crawl returned", { root, pageCount: crawlResult.pages.length })

  // Safety net: If crawl returned very few pages, supplement with web search
  const needsWebSearchSupplement = crawlResult.pages.length < 5
  if (needsWebSearchSupplement) {
    logger.warn("firecrawl.deepCrawl", "low page count, will supplement with web search", {
      root,
      pagesCrawled: crawlResult.pages.length,
      threshold: 5
    })
    console.log("[v0] firecrawl.deepCrawl: supplementing with web search", {
      pagesCrawled: crawlResult.pages.length
    })
  }

  // Convert raw crawl results into our normalized evidence format
  const pages: FirecrawlPageEvidence[] = []
  const allScreenshots: string[] = []
  const allAssets: string[] = []
  const allNavigation: string[] = []

  for (const raw of crawlResult.pages) {
    const url = (raw.metadata as Record<string, unknown>)?.sourceURL as string ?? raw.url as string ?? ""
    if (!url) continue

    const page = toPageEvidence(url, raw)
    pages.push(page)
    if (page.screenshot) allScreenshots.push(page.screenshot)
    allAssets.push(...page.images)
    allNavigation.push(...page.links)
  }

  // Also scrape the root page with a screenshot if we don't have one yet
  const hasRootPage = pages.some((p) => normalizeUrl(p.url) === root)
  if (!hasRootPage) {
    try {
      const rootRes = await scrapeUrl(root, true, 45_000)
      pages.unshift(toPageEvidence(root, rootRes.data))
    } catch (e) {
      console.log("[v0] firecrawl.deepCrawl: root screenshot failed", { message: (e as Error).message })
    }
  }

  // Supplement with web search if we have very few pages
  if (needsWebSearchSupplement) {
    const appName = extractAppName(root)
    try {
      const webSearchPages = await supplementWithWebSearch(root, appName)
      pages.push(...webSearchPages)
      console.log("[v0] firecrawl.deepCrawl: added web search results", {
        webSearchPages: webSearchPages.length,
        totalPages: pages.length
      })
      logger.info("firecrawl.deepCrawl", "web search supplement added", {
        root,
        webSearchPages: webSearchPages.length,
        totalPages: pages.length
      })
    } catch (error) {
      logger.error("firecrawl.deepCrawl", "web search supplement failed", {
        root,
        error: error instanceof Error ? error.message : String(error)
      })
      // Continue without web search if it fails
    }
  }

  const rootPage = pages.find((p) => normalizeUrl(p.url) === root)
  const screenshots = [...new Set([...allScreenshots, ...(rootPage?.screenshot ? [rootPage.screenshot] : [])])].slice(0, 10)
  const assets = [...new Set(allAssets)].slice(0, 80)
  const navigation = [...new Set(allNavigation)].slice(0, 50)

  // Count pages from direct crawl vs web search
  const crawledPages = pages.filter(p => !p.metadata?.fromWebSearch).length
  const webSearchPages = pages.filter(p => p.metadata?.fromWebSearch).length

  const evidence: WebsiteEvidence = {
    sourceUrl: root,
    title: rootPage?.title,
    description: rootPage?.description,
    pages,
    navigation,
    assets,
    screenshots,
    metadata: {
      crawlMode: "deep",
      discoveredCount: crawlResult.pages.length,
      scrapedCount: pages.length,
      crawledPages,
      webSearchPages,
      supplementedWithWebSearch: webSearchPages > 0
    },
    usage: { pagesCrawled: pages.length, creditsEstimated: pages.length, cached: false },
    collectedAt: Date.now(),
  }

  // Store in database cache
  await setCachedEvidence(root, "deep", evidence)

  console.log("[v0] firecrawl.deepCrawl: complete", {
    root,
    totalPages: pages.length,
    crawledPages,
    webSearchPages,
    screenshots: screenshots.length
  })
  logger.info("firecrawl.deepCrawl", "complete", {
    root,
    totalPages: pages.length,
    crawledPages,
    webSearchPages,
    screenshots: screenshots.length
  })
  return evidence
}
