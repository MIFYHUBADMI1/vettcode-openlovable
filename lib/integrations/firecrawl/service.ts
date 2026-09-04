import "server-only"
import { logger } from "@/lib/logging/logger"
import { scrapeUrl, mapUrl, crawlSiteUrl, isFirecrawlConfigured } from "./client"
import type { FirecrawlOptions, FirecrawlPageEvidence, WebsiteEvidence } from "./types"

export { isFirecrawlConfigured }

/** Firecrawl cost-control defaults (spec section 24). */
const DEFAULTS = {
  maxPages: 7,
  includeScreenshots: true,
  timeoutMs: 45_000,
  maxScreenshots: 3,
  maxContentChars: 20_000,
}

// Simple in-process cache so repeating the same URL does not repeat expensive
// crawls (spec sections 24 & 45). Swap for a shared cache when a DB is added.
const globalForCache = globalThis as unknown as { __fcCache?: Map<string, WebsiteEvidence> }
const cache: Map<string, WebsiteEvidence> = globalForCache.__fcCache ?? new Map()
if (!globalForCache.__fcCache) globalForCache.__fcCache = cache

export function normalizeUrl(input: string): string {
  let url = input.trim()
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  const u = new URL(url)
  u.hash = ""
  // Drop trailing slash for a stable cache key.
  const path = u.pathname.replace(/\/+$/, "")
  return `${u.protocol}//${u.host}${path}${u.search}`
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
  }
}

/**
 * Score a URL path by how likely it is to reveal application structure and
 * functionality. Higher = more useful for understanding the app.
 */
function scorePageUrl(pathname: string): number {
  const p = pathname.toLowerCase().replace(/\/+$/, "") || "/"

  // High-value pages that describe what the app IS and DOES
  const highValue = ["about","features","pricing","product","overview","demo","solutions","services","platform","capabilities","integrations","docs","documentation","help","support","faq","changelog","blog"]
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
 */
export async function crawlWebsite(inputUrl: string, options: FirecrawlOptions = {}): Promise<WebsiteEvidence> {
  const opts = { ...DEFAULTS, ...options }
  const root = normalizeUrl(inputUrl)

  const cached = cache.get(root)
  if (cached) {
    console.log("[v0] firecrawl.crawl: cache hit", { root })
    logger.info("firecrawl.cache", "cache hit", { root })
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

  cache.set(root, evidence)
  logger.info("firecrawl.crawl", "complete", { root, pages: pages.length, screenshots: screenshots.length })
  return evidence
}

/**
 * crawlWebsiteDeep — recursively crawls the ENTIRE site using Firecrawl's
 * /v2/crawl endpoint. Returns all discovered pages with their full content.
 * Used for "deep crawl" / exact-replica mode where the user wants the
 * crawled findings passed directly to the builder without AI interpretation.
 */
export async function crawlWebsiteDeep(inputUrl: string, maxPages = 50): Promise<WebsiteEvidence> {
  const root = normalizeUrl(inputUrl)
  const timeoutMs = 120_000 // 2 minutes for deep crawl

  console.log("[v0] firecrawl.deepCrawl: starting", { root, maxPages })
  logger.info("firecrawl.deepCrawl", "starting", { root, maxPages })

  // Use the /v2/crawl endpoint to recursively fetch the entire site
  const crawlResult = await crawlSiteUrl(root, maxPages, timeoutMs)
  console.log("[v0] firecrawl.deepCrawl: crawl returned", { root, pageCount: crawlResult.pages.length })

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

  const rootPage = pages.find((p) => normalizeUrl(p.url) === root)
  const screenshots = [...new Set([...allScreenshots, ...(rootPage?.screenshot ? [rootPage.screenshot] : [])])].slice(0, 10)
  const assets = [...new Set(allAssets)].slice(0, 80)
  const navigation = [...new Set(allNavigation)].slice(0, 50)

  const evidence: WebsiteEvidence = {
    sourceUrl: root,
    title: rootPage?.title,
    description: rootPage?.description,
    pages,
    navigation,
    assets,
    screenshots,
    metadata: { crawlMode: "deep", discoveredCount: crawlResult.pages.length, scrapedCount: pages.length },
    usage: { pagesCrawled: pages.length, creditsEstimated: pages.length, cached: false },
    collectedAt: Date.now(),
  }

  console.log("[v0] firecrawl.deepCrawl: complete", { root, pages: pages.length, screenshots: screenshots.length })
  logger.info("firecrawl.deepCrawl", "complete", { root, pages: pages.length, screenshots: screenshots.length })
  return evidence
}
