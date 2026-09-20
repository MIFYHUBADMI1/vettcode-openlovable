import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import { categoryForStatus } from "../shared/errors"

/**
 * Atai Runtime — ElevenLabs adapter error boundary (server-only).
 *
 * Raw provider failures map to the normalized ProviderExecutionError
 * categories; raw detail stays server-side inside `detail` (logger
 * redaction applies). Credentials never appear here (Phase 10 §40).
 *
 * @module lib/runtime/router/adapters/elevenlabs/errors
 */

/** Safe client-facing message per category — no provider internals. */
const CATEGORY_MESSAGES: Record<ProviderExecutionError["category"], string> = {
  provider_timeout: "The voice provider timed out.",
  provider_rate_limited: "The voice provider is rate limiting requests. Please retry later.",
  provider_unavailable: "The voice provider is temporarily unavailable.",
  provider_error: "The voice provider returned an error.",
  unsupported_operation: "The requested operation is not supported.",
}

export function elevenLabsFailure(
  category: ProviderExecutionError["category"],
  message: string,
  detail?: string,
): ProviderExecutionError {
  return new ProviderExecutionError(category, CATEGORY_MESSAGES[category], detail)
}

/** Non-2xx provider status → normalized failure with capped server detail. */
export function failureForStatus(status: number, bodyText: string): ProviderExecutionError {
  return elevenLabsFailure(
    categoryForStatus(status),
    "ElevenLabs request failed",
    bodyText ? bodyText.slice(0, 300) : undefined,
  )
}
