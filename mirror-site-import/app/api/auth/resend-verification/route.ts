import { requireUser } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { issueAndSendVerificationEmail } from "@/lib/auth/verification"

/**
 * Resend the verification email for the signed-in user (spec section 5).
 * Tightly rate-limited (3/hour) since each call sends a real email.
 */
export async function POST() {
  try {
    const user = await requireUser()
    if (user.emailVerified) return ok({ alreadyVerified: true })

    await checkRateLimit({
      action: "resend_verification",
      identifier: user.id,
      limit: 3,
      windowMs: 60 * 60 * 1000,
      errorCode: "VERIFICATION_RATE_LIMITED",
    })

    await issueAndSendVerificationEmail(user.id, user.email, user.name)
    return ok({ sent: true })
  } catch (e) {
    return handleRouteError("api.auth.resend_verification", e)
  }
}
