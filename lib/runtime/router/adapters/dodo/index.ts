import "server-only"
import { dodoAdapter } from "./adapter"
import { registerProviderAdapter } from "@/lib/runtime/router/provider-registry"

/**
 * Atai Runtime — Dodo Payments adapter barrel (server-only).
 *
 * Registration into the Phase 5 provider registry is OPT-IN (mirrors the
 * other Phase 10 adapters).
 *
 * @module lib/runtime/router/adapters/dodo
 */

export { dodoAdapter, DODO_PROVIDER_ID } from "./adapter"
export { isDodoConfigured } from "./config"
export { CreateCheckoutInputSchema } from "./mapper"
export type { CreateCheckoutResultData } from "./mapper"

/** Register Dodo Payments as the provider for its capability+operation. */
export function registerDodoAdapter(): void {
  registerProviderAdapter(dodoAdapter)
}
