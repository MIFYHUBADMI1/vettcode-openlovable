import { cookies, headers } from "next/headers"
import { ObjectId } from "mongodb"
import { sessionsCol, ensureIndexes } from "@/lib/db/collections"
import { generateToken, hashToken } from "@/lib/auth/crypto"
import { findUserById, type UserDoc } from "@/lib/auth/users"
import { AppError } from "@/lib/errors"

/**
 * Real, database-backed sessions (spec section 6). A random opaque token is
 * set in an httpOnly cookie; only its SHA-256 hash is stored server-side, so
 * a DB read alone can never be replayed as a valid session. Sessions expire
 * server-side (TTL index) and can be revoked individually (logout) or in
 * bulk (logout-all-devices, account deletion).
 */
const COOKIE = "mirrorsite_session"
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days

export async function createSession(userId: string): Promise<string> {
  await ensureIndexes()
  const col = await sessionsCol()
  const token = generateToken()
  const tokenHash = hashToken(token)
  const now = Date.now()
  let userAgent: string | undefined
  try {
    const h = await headers()
    userAgent = h.get("user-agent") ?? undefined
  } catch {
    userAgent = undefined
  }
  await col.insertOne({
    _id: new ObjectId(),
    userId,
    tokenHash,
    userAgent,
    createdAt: now,
    expiresAt: new Date(now + SESSION_TTL_MS),
  })
  return token
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies()
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies()
  jar.delete(COOKIE)
}

async function getSessionToken(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(COOKIE)?.value ?? null
}

/** Resolve the current request's authenticated user, or null if there is no
 * valid, unexpired session. Never throws — callers decide how to respond to
 * an unauthenticated request. */
export async function getCurrentUser(): Promise<UserDoc | null> {
  const token = await getSessionToken()
  if (!token) return null
  const col = await sessionsCol()
  const tokenHash = hashToken(token)
  const session = await col.findOne({ tokenHash, expiresAt: { $gt: new Date() } })
  if (!session) return null
  const user = await findUserById(session.userId)
  return user ?? null
}

/** Returns the current user id, throwing-free — used by routes that must
 * reject unauthenticated callers. Prefer `requireUser` in API routes. */
export async function getUserId(): Promise<string | null> {
  const user = await getCurrentUser()
  return user?.id ?? null
}

/** Resolve the current user or throw a typed 401 — the standard guard for
 * any API route that requires authentication. */
export async function requireUser(): Promise<UserDoc> {
  const user = await getCurrentUser()
  if (!user) throw new AppError("UNAUTHORIZED")
  return user
}

/** Resolve the current user as an admin or throw 403. */
export async function requireAdmin(): Promise<UserDoc> {
  const user = await requireUser()
  if (!user.isAdmin) throw new AppError("UNAUTHORIZED", "Admin access required.", 403)
  return user
}

export async function destroyCurrentSession(): Promise<void> {
  const token = await getSessionToken()
  if (token) {
    const col = await sessionsCol()
    await col.deleteOne({ tokenHash: hashToken(token) })
  }
  await clearSessionCookie()
}

/** Revoke every active session for a user — used on password change and
 * account deletion (spec section 6). */
export async function destroyAllSessionsForUser(userId: string): Promise<void> {
  const col = await sessionsCol()
  await col.deleteMany({ userId })
}
