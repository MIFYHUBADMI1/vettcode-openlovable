import "server-only"
import { ProviderNotConfiguredError } from "./errors"

/**
 * Atai Runtime — OpenRouter adapter configuration (server-only).
 *
 * ONE controlled access point for the OpenRouter credential (Phase 6 §10/§12).
 * Never imported into client code; the secret is read lazily at call time so
 * that only runtime requests which actually reach the provider require it.
 * The credential never appears in RuntimeAuthContext, RuntimeRequest,
 * RuntimeResponse, logs, or database documents (Phase 6 §10).
 *
 * @module lib/runtime/router/adapters/openrouter/config
 */

/** Official OpenRouter API root (Phase 6 §13). Override only for tests. */
export const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1"

/**
 * Optional, stable Atai-controlled attribution headers (Phase 6 §26). Read
 * lazily at request time so test/tooling environments are respected.
 */
function appAttributionHeaders(): Record<string, string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  return {
    "X-OpenRouter-Title": "Atai",
    ...(appUrl ? { "HTTP-Referer": appUrl } : {}),
  }
}

/**
 * OpenRouter endpoint override — TRUSTED SERVER CONFIGURATION ONLY.
 *
 * SECURITY (Phase 6 §96/§97): runtime callers can never influence this value.
 * It exists solely so integration tests can point the adapter at a mock HTTP
 * server. Requests cannot set it through body/query/metadata/headers.
 */
export function getOpenRouterBaseUrl(): string {
  return process.env.OPENROUTER_BASE_URL || OPENROUTER_API_BASE
}

/**
 * The server-side OpenRouter credential. Throws ProviderNotConfiguredError
 * when missing — a PROVIDER configuration problem, never a customer
 * authentication failure (Phase 6 §99/§100).
 */
export function getOpenRouterApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) {
    throw new ProviderNotConfiguredError("openrouter")
  }
  return key
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY)
}

/**
 * Headers for an OpenRouter API request: the provider credential (§25) plus
 * stable Atai-controlled attribution headers (§26). Never sends Atai API keys,
 * session cookies, or internal credentials.
 */
export function openRouterHeaders(): Record<string, string> {
  return {
    authorization: `Bearer ${getOpenRouterApiKey()}`,
    "content-type": "application/json",
    ...appAttributionHeaders(),
  }
}
