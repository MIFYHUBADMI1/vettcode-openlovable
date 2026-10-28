import { cookies, headers } from "next/headers"
import { ObjectId, type ClientSession } from "mongodb"
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
  if (process.env.NODE_ENV === "production") return true
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

export async function getCurrentUser(): Promise<UserDoc | null> {
  const token = await getSessionToken()
  if (!token) return null
  const tokenHash = hashToken(token)

  // Authoritative reads enforce revocations and account restrictions across instances.
  const col = await sessionsCol()
  const session = await col.findOne({ tokenHash, expiresAt: { $gt: new Date() } })
  if (!session) return null
  const user = await findUserById(session.userId)
  if (!user || user.banned || user.suspended) return null
  return user
}

/** Returns the current user id, throwing-free — used by routes that must
 * reject unauthenticated callers. Prefer `requireUser` in API routes. */
export async function getUserId(): Promise<string | null> {
  const user = await getCurrentUser()
  return user?.id ?? null
}

/** Resolve the current user or throw a typed 401 — the standard guard for
 * any API route that requires authentication. Ban/suspension is enforced
 * here, not only at login: a session created before a ban must die with it. */
export async function requireUser(): Promise<UserDoc> {
  const user = await getCurrentUser()
  if (!user) throw new AppError("UNAUTHORIZED")
  if (user.banned || user.suspended) throw new AppError("UNAUTHORIZED")
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
export async function destroyAllSessionsForUser(userId: string, session?: ClientSession): Promise<void> {
  const col = await sessionsCol()
  await col.deleteMany({ userId }, { session })
}
