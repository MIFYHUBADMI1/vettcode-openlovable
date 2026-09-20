/**
 * Atai SDK — configuration validation and URL construction.
 *
 * Configuration is validated once, at client construction. Requests can
 * never influence the base URL or the credential (URL security invariant).
 *
 * @module config
 */
import type { AtaiConfig } from "./types.js";
/**
 * Canonical Atai Runtime API origin. This is the deployment established by
 * the Atai application itself; it is NOT a provider endpoint and never will
 * be. The runtime API lives on the apex domain — no subdomain.
 */
export declare const DEFAULT_ATAI_BASE_URL = "https://atai.ink";
/**
 * The runtime API version path established by Phase 5. Centralized so a
 * future v2 migration touches exactly one constant.
 */
export declare const RUNTIME_API_VERSION_PATH = "/api/runtime/v1";
/** Normalized, immutable configuration used by the transport. */
export interface ResolvedConfig {
    /** Atai Runtime API key (never logged, never serialized). */
    readonly apiKey: string;
    /** Base origin without trailing slash, e.g. "https://atai.ink". */
    readonly baseUrl: string;
}
/** Validate and normalize SDK configuration. Throws AtaiError on bad config. */
export declare function resolveConfig(config: AtaiConfig): ResolvedConfig;
/**
 * Join the configured base URL with a runtime API path segment, safely:
 *   resolveConfig(...).baseUrl = "https://atai.ink"
 *   buildUrl(cfg, "/")          -> "https://atai.ink/api/runtime/v1"
 *   buildUrl(cfg, "/health")    -> "https://atai.ink/api/runtime/v1/health"
 * Caller-provided strings can never escape the configured origin because
 * `base` always comes from client configuration, never from a request.
 */
export declare function buildUrl(config: ResolvedConfig, path: string): string;
//# sourceMappingURL=config.d.ts.map