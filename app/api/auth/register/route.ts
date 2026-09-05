import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { findUserByEmail, createPasswordUser, normalizeEmail, toPublicUser } from "@/lib/auth/users"
import { hashPassword, isPasswordStrongEnough } from "@/lib/auth/crypto"
import { createSession, setSessionCookie } from "@/lib/auth/session"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { issueAndSendVerificationEmail } from "@/lib/auth/verification"
import { captureReferral } from "@/lib/referrals/referrals"
import { logger } from "@/lib/logging/logger"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Email/password registration (spec section 3). Creates an unverified
 * account, issues a hashed 24h verification token, emails the link, and logs
 * the user in immediately — protected routes gate on `emailVerified`
 * separately so the UI can nudge without blocking navigation.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string; name?: string; ref?: string }
    const email = (body.email ?? "").trim()
    const password = body.password ?? ""
    const name = (body.name ?? "").trim()
    const referralCode = (body.ref ?? "").trim().toUpperCase()

    if (!EMAIL_RE.test(email)) return fail("VALIDATION", "Please enter a valid email address.", 422)
    if (!name || name.length > 80) return fail("VALIDATION", "Please enter your name.", 422)
    if (!isPasswordStrongEnough(password)) return fail("VALIDATION", "Password must be at least 8 characters.", 422)

    await checkRateLimit({ action: "register", identifier: normalizeEmail(email), limit: 5, windowMs: 60 * 60 * 1000 })

    const existing = await findUserByEmail(email)
    if (existing) return fail("EMAIL_ALREADY_REGISTERED", undefined, 409)

    const passwordHash = await hashPassword(password)
    const user = await createPasswordUser({ email, name, passwordHash })

    logger.info("api.auth.register", "user created, issuing verification email", { userId: user.id })
    const verification = await issueAndSendVerificationEmail(user.id, user.email, user.name)
    logger.info("api.auth.register", "verification email result", { userId: user.id, sent: verification?.sent ?? false })

    // Capture referral relationship if a referral code was provided
    let referralCaptured = false
    if (referralCode) {
      const referral = await captureReferral(user.id, referralCode)
      referralCaptured = !!referral
      logger.info("api.auth.register", "captureReferral result", { referralCaptured, referralId: referral?.id, userId: user.id })
    }

    const token = await createSession(user.id)
    await setSessionCookie(token)

    return ok({ user: toPublicUser(user), verificationEmail: verification, referralCaptured }, { status: 201 })
  } catch (e) {
    return handleRouteError("api.auth.register", e)
  }
}
