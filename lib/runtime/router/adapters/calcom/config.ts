import "server-only"
import { ProviderNotConfiguredError } from "../shared/errors"
import { boundedTimeoutMs } from "../shared/http"

/**
 * Atai Runtime — Cal.com adapter configuration (server-only).
 *
 * ONE controlled access point for the Cal.com credential (mirrors the other
 * Phase 10 adapters, Phase 10 §9/§49). The secret is read lazily at call
 * time and never appears in RuntimeAuthContext, RuntimeRequest,
 * RuntimeResponse, logs, or database documents.
 *
 * The platform API key binds the runtime to ONE platform-owned Cal.com
 * account (the managed scheduling calendar generated applications book
 * against) — the same trust model as RESEND_FROM_EMAIL for the platform
 * sender. Callers can never supply credentials or account identifiers.
 *
 * @module lib/runtime/router/adapters/calcom/config
 */

/** Official Cal.com API root. Override only for tests (trusted server env). */
export const CALCOM_API_BASE = "https://api.cal.com"

/** Documented Cal.com API v2 bookings version header (Cal.com docs, v2). */
export const CALCOM_DEFAULT_API_VERSION = "2024-08-13"

export const DEFAULT_CALCOM_TIMEOUT_MS = 30_000

export function getCalComBaseUrl(): string {
  return process.env.CALCOM_BASE_URL || CALCOM_API_BASE
}

/** The server-side Cal.com credential (missing → provider config problem). */
export function getCalComApiKey(): string {
  const key = process.env.CALCOM_API_KEY
  if (!key) throw new ProviderNotConfiguredError("calcom")
  return key
}

export function isCalComConfigured(): boolean {
  return Boolean(process.env.CALCOM_API_KEY)
}

/** Documented `cal-api-version` header value; override only via trusted env. */
export function getCalComApiVersion(): string {
  return process.env.CALCOM_API_VERSION || CALCOM_DEFAULT_API_VERSION
}

export function getCalComTimeoutMs(): number {
  return boundedTimeoutMs(process.env.CALCOM_TIMEOUT_MS, DEFAULT_CALCOM_TIMEOUT_MS)
}

/**
 * Server-configured default event type the platform books against when the
 * caller does not specify one (callers may target any event type inside the
 * platform's own Cal.com account — never another account).
 */
export function getCalComDefaultEventTypeId(): number | undefined {
  const raw = process.env.CALCOM_DEFAULT_EVENT_TYPE_ID
  if (!raw) return undefined
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

/** Headers for a Cal.com API v2 request: provider credential + API version. */
export function calComHeaders(): Record<string, string> {
  return {
    authorization: `Bearer ${getCalComApiKey()}`,
    "cal-api-version": getCalComApiVersion(),
    "content-type": "application/json",
    accept: "application/json",
  }
}
