import "server-only"
import { RUNTIME_AUTH_SCHEME } from "@/runtime/contracts/auth"

/**
 * Atai Runtime — canonical API-key extraction (server-only).
 *
 * ONE extraction path for the whole runtime API (Phase 4 §7/§12): handlers
 * never parse Authorization headers independently, so no endpoint can drift
 * into subtly different security behavior.
 *
 * The Authorization header is consumed for its credential value only and is
 * NEVER logged anywhere in the runtime module.
 *
 * @module lib/runtime/auth/extract
 */

const BEARER_PREFIX = `${RUNTIME_AUTH_SCHEME} `

/**
 * Extract the runtime credential from a Request.
 *
 * Returns `null` for: missing header, wrong scheme, missing/empty token,
 * or a token that does not look like an Atai runtime key. `null` is the
 * "malformed/missing" classification — never an error throw, so callers map
 * it to one stable authentication failure.
 *
 * The shape check (`atai_<environment>_...`) is deliberately shallow: it
 * rejects obviously-not-runtime credentials (session tokens, internal keys,
 * provider tokens) BEFORE any database work, without confirming or denying
 * anything about key validity.
 */
export function extractApiKey(request: Request): string | null {
  const header = request.headers.get("authorization")
  if (!header) return null

  // Exactly one space after the scheme; tolerate stray outer whitespace but
  // reject embedded newlines (header smuggling / log-injection hygiene).
  const parts = header.trim().split(" ")
  if (parts.length !== 2 || parts[0] !== RUNTIME_AUTH_SCHEME) return null

  const token = parts[1].trim()
  if (!token) return null

  // Atai runtime keys look like atai_<environment>_<secret>. Anything else
  // (opaque session tokens, provider tokens, bare UUIDs) is rejected here.
  if (!/^atai_[a-z]+_[A-Za-z0-9_-]+$/.test(token)) return null

  return token
}

/**
 * True when the credential is syntactically an Atai runtime key but the
 * environment segment is not one of the known runtime environments.
 * Useful for classification/logging only — validation still happens against
 * the key record, never against the string alone.
 */
export function hasUnknownEnvironmentSegment(token: string): boolean {
  const match = /^atai_([a-z]+)_/.exec(token)
  return match !== null && !["development", "production"].includes(match[1])
}

export { BEARER_PREFIX }
