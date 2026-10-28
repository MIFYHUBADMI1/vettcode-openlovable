import "server-only"
import { ProviderNotConfiguredError } from "../shared/errors"
import { boundedTimeoutMs } from "../shared/http"
import { getPaymentEnvironment } from "@/lib/env"

/**
 * Atai Runtime — Dodo Payments adapter configuration (server-only).
 *
 * Server-side credential access for the Dodo Payments provider. The generated
 * application never learns about Dodo — it only knows "payments" as a
 * provider-neutral capability.
 *
 * @module lib/runtime/router/adapters/dodo/config
 */

/**
 * Dodo hosts per environment (verified against the official SDK: the API is
 * served at the ROOT path — no `/v1` prefix):
 *   live_mode → https://live.dodopayments.com
 *   test_mode → https://test.dodopayments.com
 */
export const DODO_ENVIRONMENT_BASE_URLS = {
  live_mode: "https://live.dodopayments.com",
  test_mode: "https://test.dodopayments.com",
} as const

export const DEFAULT_DODO_TIMEOUT_MS = 30_000

export function getDodoBaseUrl(): string {
  const canonical = DODO_ENVIRONMENT_BASE_URLS[getDodoEnvironment()]
  const override = process.env.DODO_PAYMENTS_BASE_URL
  if (process.env.NODE_ENV === "production" && override && override.replace(/\/$/, "") !== canonical) {
    throw new ProviderNotConfiguredError("dodo")
  }
  return override || canonical
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

/**
 * Server-configured Dodo product id (`pdt_…`) billed when a checkout item
 * carries no explicit productId. Dodo checkouts can only bill catalog
 * products — there is no ad-hoc-price endpoint (live verified 2026-10-26).
 */
export function getDodoDefaultCheckoutProductId(): string | undefined {
  const raw = process.env.DODO_CHECKOUT_DEFAULT_PRODUCT_ID
  return raw && /^pdt_[A-Za-z0-9]+$/.test(raw) ? raw : undefined
}

/** Dodo Payments environment: test_mode or live_mode. */
export function getDodoEnvironment(): "test_mode" | "live_mode" {
  return getPaymentEnvironment()
}

/** Headers for a Dodo Payments API request: provider credential only. */
export function dodoHeaders(): Record<string, string> {
  return {
    authorization: `Bearer ${getDodoApiKey()}`,
    "content-type": "application/json",
    accept: "application/json",
  }
}
