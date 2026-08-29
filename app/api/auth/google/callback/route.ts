import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { exchangeGoogleCode } from "@/lib/auth/google"
import { findUserByEmail, findUserByGoogleId, createGoogleUser, linkGoogleToUser, touchLastLogin } from "@/lib/auth/users"
import { createSession, setSessionCookie } from "@/lib/auth/session"
import { getAppUrl } from "@/lib/env"
import { logger } from "@/lib/logging/logger"

const STATE_COOKIE = "mirrorsite_oauth_state"

/**
 * Google OAuth callback (spec section 3). Verifies the CSRF `state`,
 * exchanges the code for a verified ID token, then either:
 *   1. Logs in an existing Google-linked user,
 *   2. Links Google onto an existing password account with the same email
 *      (account-linking-by-email), or
 *   3. Creates a brand-new, pre-verified Google user.
 * Any failure redirects back to /login with an error flag rather than
 * throwing a raw 500 — this endpoint is hit via full-page browser redirect.
 */
export async function GET(req: Request) {
  const appUrl = getAppUrl()
  try {
    const url = new URL(req.url)
    const code = url.searchParams.get("code")
    const state = url.searchParams.get("state")
    const jar = await cookies()
    const expectedState = jar.get(STATE_COOKIE)?.value
    jar.delete(STATE_COOKIE)

    if (!code || !state || !expectedState || state !== expectedState) {
      return NextResponse.redirect(`${appUrl}/login?error=google_auth_failed`)
    }

    const profile = await exchangeGoogleCode(code)

    let user = await findUserByGoogleId(profile.googleId)

    if (!user) {
      const existingByEmail = await findUserByEmail(profile.email)
      if (existingByEmail) {
        await linkGoogleToUser(existingByEmail.id, profile.googleId, profile.imageUrl)
        user = { ...existingByEmail, googleId: profile.googleId }
      } else {
        user = await createGoogleUser({
          email: profile.email,
          name: profile.name,
          googleId: profile.googleId,
          imageUrl: profile.imageUrl,
        })
      }
    }

    await touchLastLogin(user.id)
    const token = await createSession(user.id)
    await setSessionCookie(token)

    return NextResponse.redirect(`${appUrl}/`)
  } catch (e) {
    logger.error("api.auth.google.callback", "OAuth callback failed", { error: String(e) })
    return NextResponse.redirect(`${appUrl}/login?error=google_auth_failed`)
  }
}
