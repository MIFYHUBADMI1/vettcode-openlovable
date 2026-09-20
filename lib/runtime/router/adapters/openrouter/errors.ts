import { ProviderExecutionError } from "@/lib/runtime/router/adapter"

/**
 * Atai Runtime — OpenRouter adapter error boundary (server-only).
 *
 * Converts raw provider failures (HTTP statuses, network faults, malformed
 * payloads) into the normalized ProviderExecutionError categories the Phase 5
 * router boundary understands (Phase 6 §34/§35/§48). Raw OpenRouter details —
 * message text, metadata, stack traces — stay server-side inside `detail`
 * (which only the structured logger sees; clients receive the normalized
 * runtime_* taxonomy). Provider credentials never appear here (§36).
 *
 * OpenRouter error contract (official docs, verified for Phase 6):
 *   HTTP { error: { code: number, message: string, metadata?: object } }
 *   Documented statuses: 400, 401, 402, 403, 408, 429, 502, 503.
 *   A 200 response may STILL carry an error body (mid-generation failure) —
 *   the client must check the body, not just the status (§103).
 *
 * @module lib/runtime/router/adapters/openrouter/errors
 */

/** Documented OpenRouter failure statuses (official error table). */
export type OpenRouterHttpStatus =
  | 400 | 401 | 402 | 403 | 408 | 429 | 502 | 503

/**
 * The server-side OpenRouter credential is missing (Phase 6 §99). A provider
 * CONFIGURATION problem — deliberately distinct from customer authentication
 * failures; the router serializes it as a 503-class runtime error without
 * revealing the environment variable name (§36/§100).
 */
export class ProviderNotConfiguredError extends Error {
  readonly code = "PROVIDER_NOT_CONFIGURED" as const
  constructor(public readonly provider: string) {
    super(`${provider} is not configured`)
    this.name = "ProviderNotConfiguredError"
  }
}

/**
 * Map a documented OpenRouter HTTP status to a normalized failure category
 * (Phase 6 §35). Distinctions preserved where the Phase 5 taxonomy has them:
 * timeout (408) ≠ unavailable (502/503) ≠ rate limit (429) ≠ rejected request
 * (400/402/403) ≠ Atai-side configuration problem (401).
 */
export function categoryForStatus(status: number): ProviderExecutionError["category"] {
  switch (status) {
    case 408:
      return "provider_timeout"
    case 429:
      return "provider_rate_limited"
    case 401:
      // Atai's credential was rejected — a server/provider CONFIGURATION
      // problem, never surfaced as a customer authentication failure (§100).
      return "provider_error"
    case 502:
    case 503:
      return "provider_unavailable"
    case 400:
    case 402:
    case 403:
      // 402 = OpenRouter account out of credits; 403 = forbidden/moderation.
      // All three are "OpenRouter rejected the request" from the caller's
      // perspective — the request itself or the account behind it.
      return "provider_error"
    default:
      return "provider_error"
  }
}

/** Safe client-facing message per category — no provider internals (§36). */
const CATEGORY_MESSAGES: Record<ProviderExecutionError["category"], string> = {
  provider_timeout: "The AI provider timed out.",
  provider_rate_limited: "The AI provider is rate limiting requests. Please retry later.",
  provider_unavailable: "The AI provider is temporarily unavailable.",
  provider_error: "The AI provider returned an error.",
  unsupported_operation: "The requested operation is not supported.",
}

/**
 * Build the normalized error for an OpenRouter failure. `detail` carries the
 * raw provider message server-side (logger redaction applies); it is NEVER
 * serialized to clients by the router boundary (Phase 5 §22/§29).
 */
export function openRouterFailure(
  category: ProviderExecutionError["category"],
  message: string,
  detail?: string,
): ProviderExecutionError {
  return new ProviderExecutionError(category, CATEGORY_MESSAGES[category], detail)
}

/** Network fault or aborted request → normalized timeout/unavailable (§102). */
export function categoryForNetworkError(e: unknown): ProviderExecutionError["category"] {
  if (e instanceof Error && e.name === "AbortError") return "provider_timeout"
  return "provider_unavailable"
}
