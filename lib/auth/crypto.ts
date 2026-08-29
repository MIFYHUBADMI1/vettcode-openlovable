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
