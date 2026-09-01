import { ObjectId } from "mongodb"
import { verificationTokensCol, ensureIndexes } from "@/lib/db/collections"
import { generateToken, hashToken } from "@/lib/auth/crypto"
import { sendMail } from "@/lib/email/mailer"
import { verificationEmail } from "@/lib/email/templates"
import { getAppUrl, isSmtpConfigured } from "@/lib/env"
import { AppError } from "@/lib/errors"
import { logger } from "@/lib/logging/logger"

export type VerificationEmailResult =
  | { sent: true }
  | { sent: false; reason: "unconfigured" | "delivery_failed" }

/**
 * Issues a hashed, 24h email-verification token and sends the branded
 * verification email (spec section 5). Shared by registration and the
 * resend-verification endpoint. Route handlers may only export HTTP method
 * functions, so this lives here rather than in a route.ts file.
 *
 * Returns a result describing what actually happened instead of silently
 * succeeding, so callers (and the UI) can tell a real send apart from a
 * skipped one when SMTP isn't configured.
 */
export async function issueAndSendVerificationEmail(
  userId: string,
  email: string,
  name: string,
): Promise<VerificationEmailResult> {
  console.log("[v0] verification: issuing token", { userId })
  await ensureIndexes()
  const col = await verificationTokensCol()
  const token = generateToken()
  const now = Date.now()
  await col.insertOne({
    _id: new ObjectId(),
    userId,
    purpose: "email_verify",
    tokenHash: hashToken(token),
    createdAt: now,
    expiresAt: new Date(now + 24 * 60 * 60 * 1000),
  })
  console.log("[v0] verification: token stored", { userId })

  if (!isSmtpConfigured()) {
    console.log("[v0] verification: SMTP not configured, skipping send", { userId })
    logger.warn("email.verification_skipped_unconfigured", "SMTP is not configured", { userId })
    return { sent: false, reason: "unconfigured" }
  }

  const verifyUrl = `${getAppUrl()}/verify-email?token=${token}`
  const { subject, html, text } = verificationEmail(name, verifyUrl)
  console.log("[v0] verification: sending email", { userId, to: email })
  try {
    await sendMail({ to: email, subject, html, text })
    console.log("[v0] verification: email sent", { userId })
    return { sent: true }
  } catch (e) {
    if (e instanceof AppError) {
      console.log("[v0] verification: SMTP delivery failed", { userId, error: e.message })
      logger.warn("email.verification_send_failed", "SMTP delivery failed", { userId })
      return { sent: false, reason: "delivery_failed" } // Don't fail registration just because email delivery failed.
    }
    throw e
  }
}
