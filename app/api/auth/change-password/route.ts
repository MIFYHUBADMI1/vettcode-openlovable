import { requireUser } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { hashPassword, verifyPassword, isPasswordStrongEnough } from "@/lib/auth/crypto"
import { setPasswordHash } from "@/lib/auth/users"
import { createSession, setSessionCookie, destroyAllSessionsForUser } from "@/lib/auth/session"
import { checkRateLimit } from "@/lib/auth/rate-limit"

/** Change the authenticated user's password. Requires current password. */
export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const body = (await req.json().catch(() => ({}))) as {
      currentPassword?: string
      newPassword?: string
    }

    if (!body.currentPassword || !body.newPassword) {
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
