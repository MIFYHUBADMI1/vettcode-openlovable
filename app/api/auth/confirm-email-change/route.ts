import { verificationTokensCol, usersCol } from "@/lib/db/collections"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { hashToken } from "@/lib/auth/crypto"
import { normalizeEmail } from "@/lib/auth/users"
import { AppError } from "@/lib/errors"
import { logger } from "@/lib/logging/logger"

/**
 * Confirms an email change by consuming the verification token sent to the
 * new email address. The token is single-use and expires in 1 hour.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { token?: string }
    const token = body.token ?? ""
    if (!token) return fail("VERIFICATION_INVALID", "Invalid or expired link.", 400)

    const tokenCol = await verificationTokensCol()
    const tokenHash = hashToken(token)
    const record = await tokenCol.findOneAndUpdate(
      { tokenHash, purpose: "email_change", usedAt: { $exists: false } },
      { $set: { usedAt: Date.now() } },
      { returnDocument: "after" },
    )

    if (!record) {
      throw new AppError("VERIFICATION_INVALID")
    }

    const newEmail = (record as { metadata?: { newEmail?: string } }).metadata?.newEmail
    if (!newEmail) {
      logger.error("email.confirm_change", "Token missing newEmail metadata", { userId: record.userId })
      return fail("VERIFICATION_INVALID", "Invalid verification token.", 400)
    }

    // Check the new email isn't already taken (race condition guard)
    const users = await usersCol()
    const conflict = await users.findOne({
      email: normalizeEmail(newEmail),
      id: { $ne: record.userId },
      deletedAt: { $exists: false },
    })
    if (conflict) {
      return fail("VALIDATION", "This email address has been taken by another account since the request was made.", 422)
    }

    // Update the email
    await users.updateOne(
      { id: record.userId },
      { $set: { email: normalizeEmail(newEmail), updatedAt: Date.now() } },
    )

    logger.info("email.change_confirmed", "Email changed successfully", {
      userId: record.userId,
      newEmail: normalizeEmail(newEmail),
    })

    return ok({ message: "Email address updated successfully." })
  } catch (e) {
    return handleRouteError("api.auth.confirm_email_change", e)
  }
}
