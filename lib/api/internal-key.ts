import { timingSafeEqual } from "node:crypto"

/**
 * Shared-secret authentication for the server-to-server internal API
 * (`/api/internal/*`).
 *
 * Two properties the previous inline `providedKey !== internalKey` checks did
 * not have:
 *
 *  1. Constant-time comparison — a plain `!==` leaks the matching prefix
 *     length through response timing, which is enough to recover a shared
 *     secret byte by byte.
 *  2. No secret material in logs — the old code printed the first 10-20
 *     characters of BOTH the configured key and the attacker-supplied key to
 *     the server log on every request. A credential prefix is a credential
 *     fragment: it belongs in neither the log nor an HTTP response.
 */

export type InternalKeyResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; code: string; message: string }

/** Compare two secrets without leaking their contents through timing. */
export function secretsMatch(provided: string | null | undefined, expected: string): boolean {
  if (!provided || !expected) return false
  const a = Buffer.from(provided, "utf8")
  const b = Buffer.from(expected, "utf8")
  // timingSafeEqual throws on length mismatch — the length is not secret
  // here (both are fixed-format shared secrets), so compare digests instead
  // of leaking the length through an exception.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Authenticate an internal-API request against `ATAI_INTERNAL_KEY`.
 *
 * Returns a discriminated result so the caller can map it onto its own
 * response envelope without ever logging key material.
 */
export function authorizeInternalRequest(headers: Headers): InternalKeyResult {
  const internalKey = process.env.ATAI_INTERNAL_KEY
  if (!internalKey) {
    return {
      ok: false,
      status: 503,
      code: "PROVIDER_NOT_CONFIGURED",
      message: "Internal API key is not configured.",
    }
  }

  const providedKey = headers.get("x-internal-key") ?? headers.get("X-Internal-Key")
  if (!secretsMatch(providedKey, internalKey)) {
    // Log the OUTCOME only — never the key, not even a prefix of it.
    console.warn("[internal-api] auth failed: missing or invalid x-internal-key")
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Invalid or missing internal API key.",
    }
  }

  return { ok: true }
}
