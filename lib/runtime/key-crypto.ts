import "server-only"
import { randomBytes, createHash, timingSafeEqual } from "node:crypto"
import type { RuntimeEnvironment } from "@/runtime/contracts/capabilities"

/**
 * Atai Runtime — API key generation & hashing (server-only).
 *
 * Plaintext keys are shown exactly once at creation and never persisted:
 *
 *   generate random secret → show plaintext once → hash → store hash → discard
 *
 * DESIGN NOTE — why SHA-256 (and not bcrypt): API keys are high-entropy random
 * secrets, not human passwords. A 256-bit random secret has no brute-force
 * exposure, so a fast one-way hash with a UNIQUE index gives O(1) lookup.
 * bcrypt (reserved in this repo for passwords, lib/auth/crypto.ts) would be
 * strictly worse: slow per-request lookups for zero added security. This
 * matches the existing session/verification token pattern (generateToken /
 * hashToken), which this module extends for runtime keys.
 *
 * @module lib/runtime/key-crypto
 */

const SECRET_BYTES = 32 // 256 bits of entropy — sufficient for bearer secrets

/** Format: atai_<environment>_<base64url secret> */
export function generateApiKeySecret(environment: RuntimeEnvironment): string {
  const secret = randomBytes(SECRET_BYTES).toString("base64url")
  return `atai_${environment}_${secret}`
}

/** SHA-256 hex digest — the only form of the key ever written to MongoDB. */
export function hashApiKey(secret: string): string {
  return createHash("sha256").update(secret).digest("hex")
}

/**
 * Safe display prefix: environment + first 4 chars of the secret only.
 * Reveals nothing reusable — a lookup still requires the full secret.
 *
 * NOTE: base64url secrets may themselves contain "_" or "-", so the key is
 * parsed by the known `atai_<env>_` prefix — never by splitting on "_".
 */
export function apiKeyDisplayPrefix(secret: string): string {
  const match = /^atai_([a-z]+)_/.exec(secret)
  const env = match?.[1] ?? "unknown"
  const secretPart = secret.slice((`atai_${env}_`).length)
  return `atai_${env}_${secretPart.slice(0, 4)}…`
}

/** Constant-time equality for two digests (used by tests / future middleware). */
export function hashesEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/**
 * The ONLY shape createApiKey may persist. Plaintext fields are deliberately
 * absent so future code cannot accidentally store the secret.
 */
export interface ApiKeyHashedSecret {
  keyHash: string
  keyPrefix: string
}

/** One-time result of key creation — plaintext lives only in memory here. */
export interface GeneratedApiKey extends ApiKeyHashedSecret {
  /** Full plaintext. Show once, then discard. NEVER persist. */
  secret: string
  environment: RuntimeEnvironment
}

export function generateApiKey(environment: RuntimeEnvironment): GeneratedApiKey {
  const secret = generateApiKeySecret(environment)
  return {
    secret,
    environment,
    keyHash: hashApiKey(secret),
    keyPrefix: apiKeyDisplayPrefix(secret),
  }
}
