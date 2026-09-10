import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { exchangeGoogleCode } from "@/lib/auth/google"
import { findUserByEmail, findUserByGoogleId, createGoogleUser, linkGoogleToUser, touchLastLogin } from "@/lib/auth/users"
import { createSession, setSessionCookie } from "@/lib/auth/session"
import { getAppUrl } from "@/lib/env"
import { logger } from "@/lib/logging/logger"
import { captureReferral } from "@/lib/referrals/referrals"

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
  let stage = "start"
  try {
    const url = new URL(req.url)
    stage = "state"
    const code = url.searchParams.get("code")
    const state = url.searchParams.get("state")
    const jar = await cookies()
    const expectedState = jar.get(STATE_COOKIE)?.value
    jar.delete(STATE_COOKIE)
    const [stateNonce, encodedNext] = state?.split(".") ?? []
    const [expectedNonce] = expectedState?.split(".") ?? []
    const nextFromState = encodedNext ? Buffer.from(encodedNext, "base64url").toString("utf8") : "/workspace"

    if (!code || !stateNonce || !expectedNonce || stateNonce !== expectedNonce) {
      return NextResponse.redirect(`${appUrl}/login?error=google_auth_failed`)
    }

    stage = "exchange"
    const profile = await exchangeGoogleCode(code)

    stage = "find-google-user"
    let user = await findUserByGoogleId(profile.googleId)
    let isNewUser = false

    if (!user) {
      stage = "find-email-user"
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
        isNewUser = true
      }
    }

    // Capture referral if this is a new user and a referral code was stored
    if (isNewUser) {
      const referralCookie = jar.get("mirrorsite_referral")?.value
      if (referralCookie) {
        await captureReferral(user.id, referralCookie).catch((e) => {
          logger.error("api.auth.google.callback", "referral capture failed", { error: e instanceof Error ? e.message : String(e) })
        })
      }
      jar.delete("mirrorsite_referral")
    }

    if (user.banned || user.suspended) {
      const reason = user.banned ? "banned" : "suspended"
      return NextResponse.redirect(`${appUrl}/login?error=account_${reason}`)
    }

    stage = "touch-login"
    await touchLastLogin(user.id)
    stage = "create-session"
    const token = await createSession(user.id)
    await setSessionCookie(token)

    const next = nextFromState.startsWith("/") && !nextFromState.startsWith("//") ? nextFromState : "/workspace"
    return NextResponse.redirect(`${appUrl}${next}`)
  } catch (e) {
    logger.error("api.auth.google.callback", "OAuth callback failed", { stage, errorName: e instanceof Error ? e.name : "UnknownError", errorMessage: e instanceof Error ? e.message : String(e) })
    const params = new URLSearchParams({ error: "google_auth_failed", stage })
    return NextResponse.redirect(`${appUrl}/login?${params.toString()}`)
  }
}
