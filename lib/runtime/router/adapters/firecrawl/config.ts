import "server-only"
import { ProviderNotConfiguredError } from "../shared/errors"
import { boundedTimeoutMs } from "../shared/http"

/**
 * Atai Runtime — Firecrawl adapter configuration (server-only, Phase 10).
 *
 * REUSES the existing FIRECRAWL_API_KEY server credential — the same
 * environment variable the build-time mirror pipeline uses (Phase 10 §9: do
 * not invent duplicate environment configuration). The two FLOWS remain
 * strictly separate: this adapter serves runtime requests through the
 * Runtime Router; the build pipeline keeps its own client under
 * lib/integrations/firecrawl (§63/§64). No code or state is shared.
 *
 * @module lib/runtime/router/adapters/firecrawl/config
 */

/** Official Firecrawl API root. Override only for tests (trusted server env). */
export const FIRECRAWL_API_BASE = "https://api.firecrawl.dev"

export const DEFAULT_FIRECRAWL_TIMEOUT_MS = 60_000

export function getFirecrawlBaseUrl(): string {
  return process.env.FIRECRAWL_BASE_URL || FIRECRAWL_API_BASE
}

export function getFirecrawlApiKey(): string {
  const key = process.env.FIRECRAWL_API_KEY
  if (!key) throw new ProviderNotConfiguredError("firecrawl")
  return key
}

export function isFirecrawlRuntimeConfigured(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY)
}

export function getFirecrawlTimeoutMs(): number {
  return boundedTimeoutMs(process.env.FIRECRAWL_TIMEOUT_MS, DEFAULT_FIRECRAWL_TIMEOUT_MS)
}

export function firecrawlHeaders(): Record<string, string> {
  return {
    authorization: `Bearer ${getFirecrawlApiKey()}`,
    "content-type": "application/json",
  }
}
