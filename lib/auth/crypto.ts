import { randomBytes, createHash } from "node:crypto"
import bcrypt from "bcryptjs"

/** Password hashing (spec section 4). Cost factor 12 balances security and
 * request latency on serverless. */
const BCRYPT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Constant hash used when no real hash exists, so unknown-email and
// no-password logins burn the same bcrypt time as a real mismatch.
const DUMMY_HASH = bcrypt.hashSync("dummy-for-timing-equalization", BCRYPT_ROUNDS)

/**
 * Verify a password when the account has no usable hash (unknown email,
 * OAuth-only account). Costs the same as a real check so response time
 * does not leak which emails are registered.
 */
export async function verifyPasswordWithoutUser(password: string): Promise<false> {
  await bcrypt.compare(password, DUMMY_HASH)
  return false
}

export function isPasswordStrongEnough(password: string): boolean {
  return typeof password === "string" && password.length >= 8
}

/**
 * Opaque bearer tokens (sessions, email verification, password reset). We
 * never store the raw token — only a SHA-256 hash — so a database read
 * (backup, log leak, etc.) can't be used to forge a session or verification
 * link (spec section 6).
 */
export function generateToken(): string {
  return randomBytes(32).toString("base64url")
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}
