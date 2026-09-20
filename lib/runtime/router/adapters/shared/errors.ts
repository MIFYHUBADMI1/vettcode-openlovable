import "server-only"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"

/**
 * Atai Runtime — shared adapter error primitives (server-only).
 *
 * Phase 10 providers (ElevenLabs, Firecrawl, Resend, Twilio, Firebase,
 * Mapbox) all need the same two primitives OpenRouter carries in its own
 * errors.ts: a not-configured error and network-fault categorization. They
 * live here so each adapter stays small — NOT a second adapter layer; every
 * adapter still owns its own status→category mapping and safe messages.
 *
 * @module lib/runtime/router/adapters/shared/errors
 */

/**
 * The server-side credential for a provider is missing. A provider
 * CONFIGURATION problem — deliberately distinct from customer authentication
 * failures (mirrors OpenRouter's ProviderNotConfiguredError; the router
 * serializes it as a 503-class runtime error without revealing the
 * environment variable name).
 */
export class ProviderNotConfiguredError extends Error {
  readonly code = "PROVIDER_NOT_CONFIGURED" as const
  constructor(public readonly provider: string) {
    super(`${provider} is not configured`)
    this.name = "ProviderNotConfiguredError"
  }
}

/**
 * Map provider-specific HTTP statuses onto the normalized failure taxonomy.
 * Phase 10 convention (verified per provider's documented error table):
 *   400/404/422 (provider rejected the request or the account behind it)
 *     and 401/403 (Atai's credential was rejected — a server CONFIG problem)
 *     → provider_error
 *   408/timeout semantics → provider_timeout
 *   429 → provider_rate_limited
 *   5xx → provider_unavailable
 */
export function categoryForStatus(status: number): ProviderExecutionError["category"] {
  if (status === 408) return "provider_timeout"
  if (status === 429) return "provider_rate_limited"
  if (status >= 500) return "provider_unavailable"
  return "provider_error"
}

/** Network fault or aborted request → normalized timeout/unavailable. */
export function categoryForNetworkError(e: unknown): ProviderExecutionError["category"] {
  if (e instanceof Error && e.name === "AbortError") return "provider_timeout"
  return "provider_unavailable"
}

/**
 * Already-normalized adapter failures must pass through the network boundary
 * UNCHANGED (same rationale as OpenRouter's client: name-based detection
 * stays correct under module-instance duplication in the bundler).
 */
export function isAlreadyNormalized(e: unknown): boolean {
  if (e instanceof ProviderExecutionError) return true
  if (e instanceof ProviderNotConfiguredError) return true
  if (e instanceof Error && e.name === "ProviderExecutionError") return true
  return e instanceof Error && e.name === "ProviderNotConfiguredError"
}
