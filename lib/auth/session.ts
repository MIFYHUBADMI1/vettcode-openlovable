import { cookies, headers } from "next/headers"
import { ObjectId } from "mongodb"
import { sessionsCol } from "@/lib/db/collections"
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
const COOKIE = "Atai_session"
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days

// ─── Session resolution cache ────────────────────────────────────────────────
// getCurrentUser is the hottest DB path: 2 checkouts (sessions + users) on
// every authenticated request. A short-TTL in-memory cache collapses repeated
// lookups for the same token into zero DB calls, relieving pool pressure that
// previously caused MongoWaitQueueTimeoutError under moderate concurrency.
//
// Safety: keyed by token HASH (never the raw token), entries expire in 30s,
// and the cache is invalidated on logout (destroyCurrentSession) so revocation
// is still prompt. The cache only stores the user document, not the session —
// a revoked session's next request simply misses the cache and re-queries.

const SESSION_CACHE_MAX = 200
const SESSION_CACHE_TTL_MS = 30_000

interface CacheEntry {
  user: UserDoc | null
  expiresAt: number
}

const sessionCache = new Map<string, CacheEntry>()

function cacheGet(key: string): CacheEntry | null {
  const entry = sessionCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    sessionCache.delete(key)
    return null
  }
  return entry
}

function cacheSet(key: string, user: UserDoc | null): void {
  // Evict oldest entries when the cache is full
  if (sessionCache.size >= SESSION_CACHE_MAX) {
    const oldest = sessionCache.keys().next().value
    if (oldest) sessionCache.delete(oldest)
  }
  sessionCache.set(key, { user, expiresAt: Date.now() + SESSION_CACHE_TTL_MS })
}

function cacheInvalidate(key: string): void {
  sessionCache.delete(key)
}

/**
 * Cookie scope. A cookie's `Domain` must be a suffix of the host the browser
 * is actually talking to (RFC 6265 §5.2.3) — otherwise the browser silently
 * drops the `Set-Cookie` header and the user is left unauthenticated.
 * `NEXT_PUBLIC_APP_URL` is the CANONICAL production URL and is intentionally
 * left pointing at production while developing on localhost, so it can never
 * decide this: reading it alone made every local login emit
 * `Domain=.atai.ink` on a `localhost` response, which no browser stores.
 *
 * So the domain is derived from the REQUEST host, and the shared-parent-domain
 * behaviour is kept exactly where it is needed: a request that really arrived
 * on atai.ink / *.atai.ink (the developer portal is a rewrite inside this same
 * app) gets `.atai.ink`; everything else stays host-only.
 */
async function requestHost(): Promise<string> {
  try {
    const h = await headers()
    // `x-forwarded-host` may carry a comma list (proxy chain); the first entry
    // is the original client-facing host. Strip any port for host matching.
    const raw = h.get("x-forwarded-host") ?? h.get("host") ?? ""
    return raw.split(",")[0]?.trim().replace(/:\d+$/, "") ?? ""
  } catch {
    // Outside a request context (script/job): no host ⇒ host-only cookie.
    return ""
  }
}

function isApexOrSub(host: string, apex: string): boolean {
  return host === apex || host.endsWith(`.${apex}`)
}

async function sessionCookieDomain(): Promise<string | undefined> {
  const host = await requestHost()
  if (!host) return undefined
  return isApexOrSub(host, "atai.ink") ? ".atai.ink" : undefined
}

/** Local origins where `Secure` would only break the flow (plain http dev). */
function isLocalHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1" || host === "[::1]"
}

/**
 * `Secure` must describe the connection the browser actually used, not the
 * canonical URL. Precedence: the proxy's `x-forwarded-proto` when present
 * (Vercel always sets it) → a loopback request is insecure by definition →
 * otherwise fall back to the canonical HTTPS posture, so an origin we cannot
 * observe never gets a DOWNGRADED cookie.
 */
async function isSecureOrigin(): Promise<boolean> {
  const canonicalHttps = (process.env.NEXT_PUBLIC_APP_URL || "").startsWith("https://")
  let proto: string | null = null
  try {
    const h = await headers()
    proto = (h.get("x-forwarded-proto") ?? "").split(",")[0]?.trim().toLowerCase() || null
  } catch {
    proto = null
  }
  if (proto === "https") return true
  if (proto === "http") return false
  const host = await requestHost()
  if (host && isLocalHost(host)) return false
  return canonicalHttps
}

export async function createSession(userId: string): Promise<string> {
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
    secure: await isSecureOrigin(),
    path: "/",
    domain: await sessionCookieDomain(),
    maxAge: SESSION_TTL_MS / 1000,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies()
  // Deletion only removes a cookie whose name+path+DOMAIN match. A session set
  // on `.atai.ink` therefore has to be deleted with that same attribute, or
  // logout would leave the old cookie live in the browser.
  jar.delete({ name: COOKIE, path: "/", domain: await sessionCookieDomain() })
}

async function getSessionToken(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(COOKIE)?.value ?? null
}

/** Resolve the current request's authenticated user, or null if there is no
 * valid, unexpired session. Never throws — callers decide how to respond to
 * an unauthenticated request. Uses a 30s in-memory cache keyed by token hash
 * to avoid 2 DB checkouts on every request. */
export async function getCurrentUser(): Promise<UserDoc | null> {
  const token = await getSessionToken()
  if (!token) return null
  const tokenHash = hashToken(token)

  // Fast path: cache hit — zero DB checkouts
  const cached = cacheGet(tokenHash)
  if (cached) return cached.user

  // Slow path: resolve from DB (2 checkouts: sessions + users)
  const col = await sessionsCol()
  const session = await col.findOne({ tokenHash, expiresAt: { $gt: new Date() } })
  if (!session) {
    cacheSet(tokenHash, null)
    return null
  }
  const user = await findUserById(session.userId)
  const result = user ?? null
  cacheSet(tokenHash, result)
  return result
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
    // Invalidate the session cache so the next request doesn't serve a stale user
    cacheInvalidate(hashToken(token))
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
