import "server-only"
import { elevenLabsAdapter } from "./adapter"
import { registerProviderAdapter } from "@/lib/runtime/router/provider-registry"

/**
 * Atai Runtime — ElevenLabs adapter barrel (server-only).
 *
 * Registration into the Phase 5 provider registry is OPT-IN: importing this
 * module does NOT mutate global registry state. The runtime route module
 * calls registerElevenLabsAdapter() once at startup, keeping the registry
 * default (no adapters) intact for every other import path and for tests
 * that construct their own registry state.
 *
 * @module lib/runtime/router/adapters/elevenlabs
 */

export { elevenLabsAdapter, ELEVENLABS_PROVIDER_ID } from "./adapter"
export { isElevenLabsConfigured } from "./config"
export { SynthesizeInputSchema } from "./mapper"
export type { SynthesizeResultData } from "./mapper"

/** Register ElevenLabs as the provider for its capability+operation. */
export function registerElevenLabsAdapter(): void {
  registerProviderAdapter(elevenLabsAdapter)
}
