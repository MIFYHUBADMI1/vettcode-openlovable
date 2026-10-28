import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { readAuthBody } from "@/lib/api/request-body"
import { isPasswordStrongEnough } from "@/lib/auth/crypto"
import { resetPassword } from "@/lib/auth/password-reset"
import { checkAuthRequest } from "@/lib/auth/request-limit"
import { AppError } from "@/lib/errors"
import { logger } from "@/lib/logging/logger"

export async function POST(req: Request) {
  try {
    await checkAuthRequest(req, "password_reset_submit")
    const body = await readAuthBody(req)
    const token = typeof body.token === "string" ? body.token : ""
    const password = typeof body.password === "string" ? body.password : ""
    if (!token || !password) return fail("VALIDATION", "Please open your reset link and choose a new password.", 422)
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return fail("VERIFICATION_INVALID", "This reset link is invalid.", 400)
    if (!isPasswordStrongEnough(password) || password.length > 1024) {
      return fail("VALIDATION", "Choose a password between 8 and 1,024 characters.", 422)
    }
    await resetPassword(token, password)
    return ok({ reset: true }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof AppError) return handleRouteError("api.auth.reset_password", error)
    logger.error("api.auth.reset_password", "Password reset could not complete.")
    return fail("DATABASE_UNAVAILABLE", "We couldn't complete the reset. Please try again shortly.", 503)
  }
}
