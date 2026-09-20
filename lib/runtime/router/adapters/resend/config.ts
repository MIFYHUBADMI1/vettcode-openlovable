import "server-only"
import { ProviderNotConfiguredError } from "../shared/errors"
import { boundedTimeoutMs } from "../shared/http"

/**
 * Atai Runtime — Resend adapter configuration (server-only, Phase 10 §13).
 *
 * ONE controlled access point for the Resend credential AND the platform
 * sender identity. The sender (`from`) is a PLATFORM decision: untrusted
 * runtime callers can never set it, which prevents sender spoofing from
 * generated applications. Caller-supplied sender fields are rejected at the
 * mapper layer.
 *
 * @module lib/runtime/router/adapters/resend/config
 */

/** Official Resend API root. Override only for tests (trusted server env). */
export const RESEND_API_BASE = "https://api.resend.com"

export const DEFAULT_RESEND_TIMEOUT_MS = 20_000

export function getResendBaseUrl(): string {
  return process.env.RESEND_BASE_URL || RESEND_API_BASE
}

export function getResendApiKey(): string {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new ProviderNotConfiguredError("resend")
  return key
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

/**
 * The platform sender (e.g. "Atai <noreply@atai.ink>"). Required for the
 * email.send operation to function — a provider configuration problem when
 * missing, never a customer authentication failure.
 */
export function getResendFromAddress(): string | undefined {
  return process.env.RESEND_FROM_EMAIL || undefined
}

export function getResendTimeoutMs(): number {
  return boundedTimeoutMs(process.env.RESEND_TIMEOUT_MS, DEFAULT_RESEND_TIMEOUT_MS)
}

export function resendHeaders(idempotencyKey?: string): Record<string, string> {
  return {
    authorization: `Bearer ${getResendApiKey()}`,
    "content-type": "application/json",
    // Side-effect operation (§45/§46): Resend supports idempotent sends — the
    // runtime requestId is the natural key, so an internal retry of the SAME
    // logical request can never create a duplicate email.
    ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
  }
}
