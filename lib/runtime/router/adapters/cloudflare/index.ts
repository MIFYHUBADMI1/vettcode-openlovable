import "server-only"
import { cloudflareAdapter } from "./adapter"
import { registerProviderAdapter } from "@/lib/runtime/router/provider-registry"

/**
 * Atai Runtime — Cloudflare adapter barrel (server-only).
 *
 * Registration into the Phase 5 provider registry is OPT-IN (mirrors the
 * other Phase 10 adapters).
 *
 * @module lib/runtime/router/adapters/cloudflare
 */

export { cloudflareAdapter, CLOUDFLARE_PROVIDER_ID } from "./adapter"
export { isCloudflareConfigured, namespaceForProject } from "./config"
export { VectorDeleteInputSchema, VectorSearchInputSchema, VectorUpsertInputSchema } from "./mapper"
export type { VectorDeleteResultData, VectorSearchResultData, VectorUpsertResultData } from "./mapper"

/** Register Cloudflare as the provider for its capability+operations. */
export function registerCloudflareAdapter(): void {
  registerProviderAdapter(cloudflareAdapter)
}
