import { requireUser } from "@/lib/auth/session"
import { ok, handleRouteError } from "@/lib/api/respond"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { issueAndSendVerificationEmail } from "@/lib/auth/verification"
import { logger } from "@/lib/logging/logger"

/**
 * Resend the verification email for the signed-in user (spec section 5).
 * Tightly rate-limited (3/hour) since each call sends a real email.
 */
export async function POST() {
  try {
    const user = await requireUser()
    logger.info("api.auth.resend_verification", "requested", { userId: user.id })
    if (user.emailVerified) {
      return ok({ alreadyVerified: true })
    }

    await checkRateLimit({
      action: "resend_verification",
      identifier: user.id,
      limit: 3,
      windowMs: 60 * 60 * 1000,
      errorCode: "VERIFICATION_RATE_LIMITED",
    })

    const result = await issueAndSendVerificationEmail(user.id, user.email, user.name)
    logger.info("api.auth.resend_verification", "email sent", { userId: user.id })
    return ok(result)
  } catch (e) {
    return handleRouteError("api.auth.resend_verification", e)
  }
}
