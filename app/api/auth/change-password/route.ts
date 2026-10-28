import { requireUser } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { hashPassword, verifyPassword, isPasswordStrongEnough } from "@/lib/auth/crypto"
import { setPasswordHash } from "@/lib/auth/users"
import { createSession, setSessionCookie, destroyAllSessionsForUser } from "@/lib/auth/session"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { checkAuthRequest } from "@/lib/auth/request-limit"
import { readAuthBody } from "@/lib/api/request-body"

/** Change the authenticated user's password. Requires current password. */
export async function POST(req: Request) {
  try {
    await checkAuthRequest(req, "change_password")
    const user = await requireUser()
    const body = await readAuthBody(req)

    if (typeof body.currentPassword !== "string" || typeof body.newPassword !== "string" ||
        !body.currentPassword || !body.newPassword || body.currentPassword.length > 1024 || body.newPassword.length > 1024) {
      return fail("VALIDATION", "Please provide your current and new password.", 422)
    }

    // Rate limit: max 5 password changes per hour
    await checkRateLimit({
      action: "password_change",
      identifier: user.id,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    })

    // Password-auth users must verify current password
    if (user.authProvider === "password" && user.passwordHash) {
      const valid = await verifyPassword(body.currentPassword, user.passwordHash)
      if (!valid) {
        return fail("VALIDATION", "Current password is incorrect.", 422)
      }
    }

    // Validate new password strength
    if (!isPasswordStrongEnough(body.newPassword)) {
      return fail("VALIDATION", "New password must be at least 8 characters.", 422)
    }

    if (body.currentPassword === body.newPassword) {
      return fail("VALIDATION", "New password must be different from your current password.", 422)
    }

    // Hash and save new password
    const newHash = await hashPassword(body.newPassword)
    await setPasswordHash(user.id, newHash)

    // Revoke all other sessions for security, then create a fresh one
    await destroyAllSessionsForUser(user.id)
    const token = await createSession(user.id)
    await setSessionCookie(token)

    return ok({ message: "Password changed successfully." })
  } catch (e) {
    return handleRouteError("api.auth.change_password", e)
  }
}
