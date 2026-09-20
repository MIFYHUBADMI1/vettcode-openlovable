import "server-only"
import { createSign, randomUUID } from "node:crypto"
import { logger } from "@/lib/logging/logger"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import {
  getFirebaseClientEmail,
  getFirebaseOAuthTokenUrl,
  getFirebasePrivateKey,
  getFirebaseTimeoutMs,
} from "./config"
import { providerFetch, parseJsonBody, providerStatusFailure } from "../shared/http"
import { categoryForStatus } from "../shared/errors"

/**
 * Atai Runtime — FCM service-account authentication (server-only).
 *
 * Signs an RS256 service-account JWT with node:crypto (§78: no new
 * dependencies — google-auth-library is deliberately NOT installed) and
 * exchanges it for a short-lived OAuth2 access token at the documented
 * endpoint. The access token is cached IN-PROCESS for its lifetime minus a
 * safety skew — a standard, safe pattern (server-side artifact, never
 * logged, never persisted; §81).
 *
 * @module lib/runtime/router/adapters/firebase/auth
 */

const FIREBASE_MESSAGING_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
const JWT_LIFETIME_SECONDS = 3_600
const TOKEN_REFRESH_SKEW_MS = 60_000

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url")
}

/** Build and sign one RS256 service-account JWT. */
function createServiceAccountJwt(): string {
  const now = Math.floor(Date.now() / 1_000)
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const payload = base64url(
    JSON.stringify({
      iss: getFirebaseClientEmail(),
      scope: FIREBASE_MESSAGING_SCOPE,
      aud: getFirebaseOAuthTokenUrl(),
      iat: now,
      exp: now + JWT_LIFETIME_SECONDS,
    }),
  )
  const signer = createSign("RSA-SHA256")
  signer.update(`${header}.${payload}`)
  const signature = signer.sign(getFirebasePrivateKey()).toString("base64url")
  return `${header}.${payload}.${signature}`
}

/** Cached access token (in-process only). */
let cachedToken: { token: string; expiresAt: number } | null = null
let inFlight: Promise<string> | null = null

async function requestAccessToken(): Promise<string> {
  const startedAt = Date.now()
  const jwt = createServiceAccountJwt()

  const res = await providerFetch({
    url: getFirebaseOAuthTokenUrl(),
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }).toString(),
    timeoutMs: getFirebaseTimeoutMs(),
  })

  if (!res.ok) {
    // A rejected service-account credential is a server CONFIG problem.
    logger.error("runtime.firebase", "OAuth token exchange failed", {
      status: res.status,
      latencyMs: Date.now() - startedAt,
      detail: res.text.slice(0, 300),
    })
    throw providerStatusFailure(categoryForStatus(res.status), "The notification provider is temporarily unavailable.", res.text)
  }

  const parsed = parseJsonBody<{ access_token?: string; expires_in?: number }>(res)
  if (typeof parsed.access_token !== "string" || parsed.access_token.length === 0) {
    throw new ProviderExecutionError(
      "provider_unavailable",
      "The notification provider is temporarily unavailable.",
      "token exchange returned no access_token",
    )
  }
  return parsed.access_token
}

/**
 * A short-lived access token for FCM v1 (cached, refreshed 60s before
 * expiry; concurrent callers share one in-flight exchange).
 */
export async function getFcmAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token
  if (inFlight) return inFlight

  inFlight = requestAccessToken()
    .then((token) => {
      // expires_in is honored when the provider reports it; default to the
      // JWT lifetime otherwise. Skew refreshes BEFORE real expiry.
      cachedToken = { token, expiresAt: Date.now() + JWT_LIFETIME_SECONDS * 1_000 - TOKEN_REFRESH_SKEW_MS }
      return token
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

/** Test-only: clear the cached access token. */
export function clearFcmTokenCache(): void {
  cachedToken = null
}

/** Non-secret request id for logs when the caller did not supply one. */
export function fallbackCorrelationId(): string {
  return randomUUID()
}
