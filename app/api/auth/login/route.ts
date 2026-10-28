import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { findUserByEmail, normalizeEmail, toPublicUser, touchLastLogin } from "@/lib/auth/users"
import { verifyPassword, verifyPasswordWithoutUser } from "@/lib/auth/crypto"
import { createSession, setSessionCookie } from "@/lib/auth/session"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { AppError } from "@/lib/errors"
import { checkAuthRequest } from "@/lib/auth/request-limit"
import { readAuthBody } from "@/lib/api/request-body"

/**
 * Email/password login (spec section 3). Rate-limited per email to slow
 * brute-force guessing, and returns the same generic error whether the
 * account doesn't exist, has no password (Google-only), or the password is
 * wrong — never reveals which. Ban/suspension is only disclosed AFTER the
 * password is proven, and bcrypt runs even for unknown emails, so login
 * cannot be used as an account-existence oracle.
 */
export async function POST(req: Request) {
  try {
    await checkAuthRequest(req, "login")
    const body = await readAuthBody(req)
    const email = typeof body.email === "string" ? body.email.trim() : ""
    const password = typeof body.password === "string" ? body.password : ""
    if (!email || email.length > 254 || !password || password.length > 1024) return fail("VALIDATION", "Please enter your email and password.", 422)

    await checkRateLimit({ action: "login", identifier: normalizeEmail(email), limit: 10, windowMs: 15 * 60 * 1000 })

    const user = await findUserByEmail(email)
    if (!user || !user.passwordHash) {
      // Same cost as a real verify — never tell the caller which case they hit.
      await verifyPasswordWithoutUser(password)
      throw new AppError("AUTHENTICATION_FAILED")
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) throw new AppError("AUTHENTICATION_FAILED")

    if (user.banned) {
      return fail("FORBIDDEN", "This account has been banned. Please contact support.", 403)
    }
    if (user.suspended) {
      return fail("FORBIDDEN", "This account has been suspended. Please contact support.", 403)
    }

    await touchLastLogin(user.id)
    const token = await createSession(user.id)
    await setSessionCookie(token)

    return ok({ user: toPublicUser(user) })
  } catch (e) {
    return handleRouteError("api.auth.login", e)
  }
}
