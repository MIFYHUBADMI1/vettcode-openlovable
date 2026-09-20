/**
 * Shared platform ceilings for the Runtime API.
 *
 * The per-key authenticated request cap lives in authenticate.ts historically;
 * project-level Control Center limits may only tighten this, never raise it.
 */

/** Authenticated runtime requests per API key per minute (platform ceiling). */
export const PLATFORM_RUNTIME_REQUESTS_PER_MINUTE = 300
export const PLATFORM_RUNTIME_REQUESTS_PER_MINUTE_WINDOW_MS = 60_000

/** Optional project daily cap ceiling (prevents unbounded owner-set values). */
export const PLATFORM_RUNTIME_REQUESTS_PER_DAY_MAX = 1_000_000
