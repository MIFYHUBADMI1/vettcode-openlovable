import "server-only"
import { openRouterAdapter } from "./adapter"
import { registerProviderAdapter } from "@/lib/runtime/router/provider-registry"

/**
 * Atai Runtime — OpenRouter adapter barrel (server-only).
 *
 * Registration into the Phase 5 provider registry is OPT-IN: importing this
 * module does NOT mutate global registry state. The runtime route module
 * calls registerOpenRouterAdapter() once at startup, keeping the Phase 5
 * default (no adapters) intact for every other import path and for tests
 * that construct their own registry state (Phase 6 §44).
 *
 * @module lib/runtime/router/adapters/openrouter
 */

export { openRouterAdapter, OPENROUTER_PROVIDER_ID } from "./adapter"
export { isOpenRouterConfigured } from "./config"
export { ChatInputSchema } from "./mapper"
export type { ChatResultData } from "./mapper"

/** Register OpenRouter as the provider for its capability+operation. */
export function registerOpenRouterAdapter(): void {
  registerProviderAdapter(openRouterAdapter)
}
