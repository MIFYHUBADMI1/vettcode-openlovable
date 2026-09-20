import "server-only"
import { ProviderNotConfiguredError } from "../shared/errors"
import { boundedTimeoutMs } from "../shared/http"

/**
 * Atai Runtime — Twilio adapter configuration (server-only, Phase 10 §14).
 *
 * ONE controlled access point for the Twilio credentials and the platform
 * sender numbers. Callers can NEVER set the sender, the account, or any
 * credential (§14: no arbitrary credential injection). WhatsApp and SMS use
 * separate platform-configured senders.
 *
 * @module lib/runtime/router/adapters/twilio/config
 */

/** Official Twilio REST API root. Override only for tests (trusted server env). */
export const TWILIO_API_BASE = "https://api.twilio.com"

export const DEFAULT_TWILIO_TIMEOUT_MS = 20_000

export function getTwilioBaseUrl(): string {
  return process.env.TWILIO_BASE_URL || TWILIO_API_BASE
}

export function getTwilioAccountSid(): string {
  const sid = process.env.TWILIO_ACCOUNT_SID
  if (!sid) throw new ProviderNotConfiguredError("twilio")
  return sid
}

export function getTwilioAuthToken(): string {
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!token) throw new ProviderNotConfiguredError("twilio")
  return token
}

export function isTwilioConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
}

/** Platform SMS sender (E.164). Missing → provider config problem. */
export function getTwilioSmsFromNumber(): string | undefined {
  return process.env.TWILIO_FROM_NUMBER || undefined
}

/** Platform WhatsApp sender (E.164 WITHOUT the whatsapp: prefix). */
export function getTwilioWhatsappFromNumber(): string | undefined {
  return process.env.TWILIO_WHATSAPP_FROM_NUMBER || undefined
}

export function getTwilioTimeoutMs(): number {
  return boundedTimeoutMs(process.env.TWILIO_TIMEOUT_MS, DEFAULT_TWILIO_TIMEOUT_MS)
}

/** Basic auth header (sid:token) — server-side only, never logged. */
export function twilioHeaders(): Record<string, string> {
  const basic = Buffer.from(`${getTwilioAccountSid()}:${getTwilioAuthToken()}`).toString("base64")
  return {
    authorization: `Basic ${basic}`,
    "content-type": "application/x-www-form-urlencoded",
  }
}
