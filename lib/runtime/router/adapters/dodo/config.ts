import "server-only"
import { ProviderNotConfiguredError } from "../shared/errors"
import { boundedTimeoutMs } from "../shared/http"

/**
 * Atai Runtime — Dodo Payments adapter configuration (server-only).
 *
 * Server-side credential access for the Dodo Payments provider. The generated
 * application never learns about Dodo — it only knows "payments" as a
 * provider-neutral capability.
 *
 * @module lib/runtime/router/adapters/dodo/config
 */

/** Official Dodo Payments API root. */
export const DODO_API_BASE = "https://api.dodopayments.com"
export const DODO_API_VERSION = "v1"

export const DEFAULT_DODO_TIMEOUT_MS = 30_000

export function getDodoBaseUrl(): string {
  return process.env.DODO_PAYMENTS_BASE_URL || `${DODO_API_BASE}/${DODO_API_VERSION}`
}

/** The server-side Dodo Payments credential (missing → provider config problem). */
export function getDodoApiKey(): string {
  const key = process.env.DODO_PAYMENTS_API_KEY
  if (!key) throw new ProviderNotConfiguredError("dodo")
  return key
}

export function isDodoConfigured(): boolean {
  return Boolean(process.env.DODO_PAYMENTS_API_KEY)
}

export function getDodoTimeoutMs(): number {
  return boundedTimeoutMs(process.env.DODO_PAYMENTS_TIMEOUT_MS, DEFAULT_DODO_TIMEOUT_MS)
}

/** Dodo Payments environment: test_mode or live_mode. */
export function getDodoEnvironment(): "test_mode" | "live_mode" {
  const env = process.env.DODO_PAYMENTS_ENVIRONMENT
  if (env === "live_mode") return "live_mode"
  return "test_mode"
}

/** Headers for a Dodo Payments API request: provider credential only. */
export function dodoHeaders(): Record<string, string> {
  return {
    authorization: `Bearer ${getDodoApiKey()}`,
    "content-type": "application/json",
    accept: "application/json",
  }
}
