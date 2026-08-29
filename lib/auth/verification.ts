import { ObjectId } from "mongodb"
import { verificationTokensCol, ensureIndexes } from "@/lib/db/collections"
import { generateToken, hashToken } from "@/lib/auth/crypto"
import { sendMail } from "@/lib/email/mailer"
import { verificationEmail } from "@/lib/email/templates"
import { getAppUrl, isSmtpConfigured } from "@/lib/env"
import { AppError } from "@/lib/errors"
import { logger } from "@/lib/logging/logger"

/**
 * Issues a hashed, 24h email-verification token and sends the branded
 * verification email (spec section 5). Shared by registration and the
 * resend-verification endpoint. Route handlers may only export HTTP method
 * functions, so this lives here rather than in a route.ts file.
 */
export async function issueAndSendVerificationEmail(userId: string, email: string, name: string): Promise<void> {
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

  if (!isSmtpConfigured()) {
    logger.warn("email.verification_skipped_unconfigured", "SMTP is not configured", { userId })
    return
  }

  const verifyUrl = `${getAppUrl()}/verify-email?token=${token}`
  const { subject, html, text } = verificationEmail(name, verifyUrl)
  try {
    await sendMail({ to: email, subject, html, text })
  } catch (e) {
    if (e instanceof AppError) {
      logger.warn("email.verification_send_failed", "SMTP delivery failed", { userId })
      return // Don't fail registration just because email delivery failed.
    }
    throw e
  }
}
