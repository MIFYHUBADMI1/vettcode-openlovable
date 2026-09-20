/**
 * Atai SDK — configuration validation and URL construction.
 *
 * Configuration is validated once, at client construction. Requests can
 * never influence the base URL or the credential (URL security invariant).
 *
 * @module config
 */

import { AtaiError } from "./errors.js"
import type { AtaiConfig } from "./types.js"

/**
 * Canonical Atai Runtime API origin. This is the deployment established by
 * the Atai application itself; it is NOT a provider endpoint and never will
 * be. The runtime API lives on the apex domain — no subdomain.
 */
export const DEFAULT_ATAI_BASE_URL = "https://atai.ink"

/**
 * The runtime API version path established by Phase 5. Centralized so a
 * future v2 migration touches exactly one constant.
 */
export const RUNTIME_API_VERSION_PATH = "/api/runtime/v1"

/**
 * Atai runtime keys look like `atai_<environment>_<secret>` — the same
 * shallow shape check the server applies before any database work. This is
 * client-side DX validation only; the server remains authoritative for
 * whether a key is active/authorized.
 */
const API_KEY_SHAPE = /^atai_[a-z]+_[A-Za-z0-9_-]+$/

/** Normalized, immutable configuration used by the transport. */
export interface ResolvedConfig {
  /** Atai Runtime API key (never logged, never serialized). */
  readonly apiKey: string
  /** Base origin without trailing slash, e.g. "https://atai.ink". */
  readonly baseUrl: string
}

/** Validate and normalize SDK configuration. Throws AtaiError on bad config. */
export function resolveConfig(config: AtaiConfig): ResolvedConfig {
  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    throw new AtaiError("atai_invalid_config", "Atai client configuration must be an object with an `apiKey` field.")
  }
  const apiKey = config.apiKey
  if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
    throw new AtaiError("atai_missing_api_key", "An Atai API key is required. Pass it as `new Atai({ apiKey })`.")
  }
  if (!API_KEY_SHAPE.test(apiKey)) {
    throw new AtaiError(
      "atai_invalid_api_key",
      "The configured API key does not look like an Atai runtime key (expected `atai_<environment>_<secret>`).",
    )
  }
  const rawBaseUrl = config.baseUrl ?? DEFAULT_ATAI_BASE_URL
  if (typeof rawBaseUrl !== "string" || rawBaseUrl.trim().length === 0) {
    throw new AtaiError("atai_invalid_config", "baseUrl must be a non-empty string when provided.")
  }
  let parsed: URL
  try {
    parsed = new URL(rawBaseUrl)
  } catch {
    throw new AtaiError("atai_invalid_config", "baseUrl must be an absolute URL, e.g. https://atai.ink")
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AtaiError("atai_invalid_config", "baseUrl must use http: or https:.")
  }
  // Strip any path/query/hash and trailing slashes: the base is an origin
  // (plus optional mount path), and URL joining below can never produce a
  // doubled or malicious path.
  const baseUrl = `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, "")}`
  return { apiKey, baseUrl }
}

/**
 * Join the configured base URL with a runtime API path segment, safely:
 *   resolveConfig(...).baseUrl = "https://atai.ink"
 *   buildUrl(cfg, "/")          -> "https://atai.ink/api/runtime/v1"
 *   buildUrl(cfg, "/health")    -> "https://atai.ink/api/runtime/v1/health"
 * Caller-provided strings can never escape the configured origin because
 * `base` always comes from client configuration, never from a request.
 */
export function buildUrl(config: ResolvedConfig, path: string): string {
  return `${config.baseUrl}${RUNTIME_API_VERSION_PATH}${path}`
}
