import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { randomBytes } from "node:crypto"
import { buildGoogleAuthUrl } from "@/lib/auth/google"
import { handleRouteError } from "@/lib/api/respond"

const STATE_COOKIE = "mirrorsite_oauth_state"

/** Redirects to Google's consent screen with a random CSRF `state`, stashed
 * in a short-lived cookie for the callback to verify (spec section 3). */
export async function GET() {
  try {
    const state = randomBytes(16).toString("hex")
    const url = buildGoogleAuthUrl(state)
    const jar = await cookies()
    jar.set(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 10,
    })
    return NextResponse.redirect(url)
  } catch (e) {
    return handleRouteError("api.auth.google.start", e)
  }
}
