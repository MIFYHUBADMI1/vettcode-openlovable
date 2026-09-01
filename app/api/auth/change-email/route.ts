import { ObjectId } from "mongodb"
import { requireUser } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { usersCol, verificationTokensCol, ensureIndexes } from "@/lib/db/collections"
import { generateToken, hashToken } from "@/lib/auth/crypto"
import { sendMail } from "@/lib/email/mailer"
import { emailChangeEmail } from "@/lib/email/templates"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { getAppUrl, isSmtpConfigured } from "@/lib/env"
import { normalizeEmail } from "@/lib/auth/users"
import { AppError } from "@/lib/errors"
import { logger } from "@/lib/logging/logger"

/** Request an email change — sends a confirmation link to the new email. */
export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const body = (await req.json().catch(() => ({}))) as { newEmail?: string }

    if (!body.newEmail || typeof body.newEmail !== "string") {
      return fail("VALIDATION", "Please provide a new email address.", 422)
    }

    const newEmail = normalizeEmail(body.newEmail)

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return fail("VALIDATION", "Please enter a valid email address.", 422)
    }

    // Can't change to the same email
    if (newEmail === user.email) {
      return fail("VALIDATION", "This is already your current email address.", 422)
    }

    // Check if the new email is already taken by another user
    const col = await usersCol()
    const existing = await col.findOne({
      email: newEmail,
      id: { $ne: user.id },
      deletedAt: { $exists: false },
    })
    if (existing) {
      return fail("VALIDATION", "This email address is already associated with another account.", 422)
    }

    // Rate limit: max 3 email change requests per hour
    await checkRateLimit({
      action: "change_email",
      identifier: user.id,
      limit: 3,
      windowMs: 60 * 60 * 1000,
      errorCode: "RATE_LIMITED",
    })

    // Issue a confirmation token
    await ensureIndexes()
    const tokenCol = await verificationTokensCol()
    const token = generateToken()
    const now = Date.now()

    // Remove any previous pending email change tokens
    await tokenCol.deleteMany({ userId: user.id, purpose: "email_change" })

    await tokenCol.insertOne({
      _id: new ObjectId(),
      userId: user.id,
      purpose: "email_change",
      tokenHash: hashToken(token),
      metadata: { newEmail },
      createdAt: now,
      expiresAt: new Date(now + 60 * 60 * 1000), // 1 hour
    })

    if (!isSmtpConfigured()) {
      logger.warn("email.change_email_skipped", "SMTP not configured", { userId: user.id })
      return ok({ sent: false, reason: "unconfigured" })
    }

    const confirmUrl = `${getAppUrl()}/confirm-email-change?token=${token}`
    const { subject, html, text } = emailChangeEmail(user.name, newEmail, confirmUrl)

    try {
      await sendMail({ to: newEmail, subject, html, text })
      return ok({ sent: true })
    } catch (e) {
      if (e instanceof AppError) {
        return fail("EMAIL_UNAVAILABLE", "Failed to send confirmation email. Please try again.", 503)
      }
      throw e
    }
  } catch (e) {
    return handleRouteError("api.auth.change_email", e)
  }
}
