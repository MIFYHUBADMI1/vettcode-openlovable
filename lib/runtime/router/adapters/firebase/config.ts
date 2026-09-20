import "server-only"
import { ProviderNotConfiguredError } from "../shared/errors"
import { boundedTimeoutMs } from "../shared/http"

/**
 * Atai Runtime — Firebase adapter configuration (server-only, Phase 10 §15).
 *
 * ONE controlled access point for the FCM service-account credential. The
 * private key NEVER appears in RuntimeAuthContext, RuntimeRequest,
 * RuntimeResponse, logs, or database documents — callers provide only the
 * runtime operation payload allowed by the contract (§15).
 *
 * @module lib/runtime/router/adapters/firebase/config
 */

/** Official FCM v1 + Google OAuth roots. Override only for tests. */
export const FCM_API_BASE = "https://fcm.googleapis.com"
export const FIREBASE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"

export const DEFAULT_FIREBASE_TIMEOUT_MS = 20_000

export function getFirebaseBaseUrl(): string {
  return process.env.FCM_BASE_URL || FCM_API_BASE
}

export function getFirebaseOAuthTokenUrl(): string {
  return process.env.FIREBASE_OAUTH_URL || FIREBASE_OAUTH_TOKEN_URL
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new ProviderNotConfiguredError("firebase")
  return value
}

export function getFirebaseProjectId(): string {
  return requiredEnv("FIREBASE_PROJECT_ID")
}

export function getFirebaseClientEmail(): string {
  return requiredEnv("FIREBASE_CLIENT_EMAIL")
}

/**
 * The service-account private key. Accepts the common one-line form with
 * literal `\n` escapes (env vars can't hold raw newlines reliably).
 */
export function getFirebasePrivateKey(): string {
  const raw = requiredEnv("FIREBASE_PRIVATE_KEY")
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw
}

export function isFirebaseConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY,
  )
}

export function getFirebaseTimeoutMs(): number {
  return boundedTimeoutMs(process.env.FIREBASE_TIMEOUT_MS, DEFAULT_FIREBASE_TIMEOUT_MS)
}
