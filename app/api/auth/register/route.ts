import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { findUserByEmail, createPasswordUser, normalizeEmail, toPublicUser } from "@/lib/auth/users"
import { hashPassword, isPasswordStrongEnough } from "@/lib/auth/crypto"
import { createSession, setSessionCookie } from "@/lib/auth/session"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { issueAndSendVerificationEmail } from "@/lib/auth/verification"
import { captureReferral } from "@/lib/referrals/referrals"
import { logger } from "@/lib/logging/logger"
import { checkAuthRequest } from "@/lib/auth/request-limit"
import { readAuthBody } from "@/lib/api/request-body"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Email/password registration (spec section 3). Creates an unverified
 * account, issues a hashed 24h verification token, emails the link, and logs
 * the user in immediately — protected routes gate on `emailVerified`
 * separately so the UI can nudge without blocking navigation.
 */
export async function POST(req: Request) {
  try {
    await checkAuthRequest(req, "register")
    const body = await readAuthBody(req)
    const email = typeof body.email === "string" ? body.email.trim() : ""
    const password = typeof body.password === "string" ? body.password : ""
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const referralCode = typeof body.ref === "string" ? body.ref.trim().toUpperCase() : ""

    if (email.length > 254 || !EMAIL_RE.test(email)) return fail("VALIDATION", "Please enter a valid email address.", 422)
    if (!name || name.length > 80) return fail("VALIDATION", "Please enter your name.", 422)
    if (referralCode.length > 100) return fail("VALIDATION", "Please enter a valid referral code.", 422)
    if (!isPasswordStrongEnough(password) || password.length > 1024) return fail("VALIDATION", "Choose a password between 8 and 1,024 characters.", 422)

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
