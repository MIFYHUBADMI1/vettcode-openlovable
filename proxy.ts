import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Edge-level proxy (Next.js 16 — renamed from middleware.ts).
 *
 * Purpose: short-circuit API requests that have no session cookie at all,
 * before they reach any route handler. This eliminates the 2 MongoDB round-
 * trips (session lookup + user lookup) that every `requireUser` / `requireAdmin`
 * call would otherwise make for obviously unauthenticated requests — e.g.
 * a bot probing endpoints with no cookie.
 *
 * This is intentionally a shallow check (cookie PRESENCE only — not
 * validity). Full token hashing and DB validation still happen inside
 * `requireUser` / `requireAdmin`. Do NOT rely on this alone for auth.
 *
 * Excluded from the matcher:
 *  - Public auth routes (login, register, forgot-password, OAuth callback, etc.)
 *  - Billing webhook (signed with HMAC — has its own auth; no session cookie)
 *  - Static assets and Next.js internals
 */

const SESSION_COOKIE = "mirrorsite_session"

// API routes that are intentionally public (no session required).
const PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/verify-email",
  "/api/auth/confirm-email-change",
  "/api/auth/google",
  "/api/billing/webhook",
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only gate /api/* routes — page routes handle their own redirects client-side.
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  // Allow explicitly public API routes through without a session cookie.
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  // For all other /api/* routes: require the session cookie to be present.
  // If it's missing there's no point hitting the DB — return 401 immediately.
  const hasSession = request.cookies.has(SESSION_COOKIE)
  if (!hasSession) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Please sign in to continue." } },
      { status: 401 },
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Run on all paths except Next.js internals and static files.
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
}
