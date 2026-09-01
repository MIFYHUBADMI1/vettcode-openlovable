import { ObjectId } from "mongodb"
import { ok, handleRouteError } from "@/lib/api/respond"
import { ensureIndexes, verificationTokensCol } from "@/lib/db/collections"
import { findUserByEmail } from "@/lib/auth/users"
import { generateToken, hashToken } from "@/lib/auth/crypto"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { passwordResetEmail } from "@/lib/email/templates"
import { sendMail } from "@/lib/email/mailer"
import { getAppUrl } from "@/lib/env"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
    if (!email) return ok({ sent: true })
    await checkRateLimit({ action: "password_reset", identifier: email, limit: 3, windowMs: 60 * 60 * 1000, errorCode: "VERIFICATION_RATE_LIMITED" })
    const user = await findUserByEmail(email)
    if (user?.passwordHash) {
      await ensureIndexes()
      const token = generateToken()
      const col = await verificationTokensCol()
      await col.deleteMany({ userId: user.id, purpose: "password_reset" })
      await col.insertOne({ _id: new ObjectId(), userId: user.id, purpose: "password_reset", tokenHash: hashToken(token), createdAt: Date.now(), expiresAt: new Date(Date.now() + 60 * 60 * 1000) })
      const message = passwordResetEmail(user.name, `${getAppUrl()}/reset-password?token=${encodeURIComponent(token)}`)
      await sendMail({ to: user.email, ...message })
    }
    return ok({ sent: true })
  } catch (error) {
    return handleRouteError("api.auth.forgot_password", error)
  }
}
