import "server-only"
import { firecrawlAdapter } from "./adapter"
import { registerProviderAdapter } from "@/lib/runtime/router/provider-registry"

/**
 * Atai Runtime — Firecrawl adapter barrel (server-only).
 *
 * Registration into the Phase 5 provider registry is OPT-IN (same pattern as
 * the OpenRouter/ElevenLabs barrels).
 *
 * @module lib/runtime/router/adapters/firecrawl
 */

export { firecrawlAdapter, FIRECRAWL_PROVIDER_ID } from "./adapter"
export { isFirecrawlRuntimeConfigured } from "./config"
export { SearchWebInputSchema, ScrapeInputSchema, assertPublicHttpUrl } from "./mapper"
export type { WebSearchResultData, ScrapeResultData } from "./mapper"

/** Register Firecrawl as the provider for its capability+operation pairs. */
export function registerFirecrawlAdapter(): void {
  registerProviderAdapter(firecrawlAdapter)
}
