import { ObjectId } from "mongodb"
import { after } from "next/server"
import { ok, handleRouteError } from "@/lib/api/respond"
import { readAuthBody } from "@/lib/api/request-body"
import { verificationTokensCol } from "@/lib/db/collections"
import { findUserByEmail } from "@/lib/auth/users"
import { generateToken, hashToken } from "@/lib/auth/crypto"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { checkAuthRequest } from "@/lib/auth/request-limit"
import { passwordResetEmail } from "@/lib/email/templates"
import { sendMail } from "@/lib/email/mailer"
import { getAppUrl } from "@/lib/env"
import { logger } from "@/lib/logging/logger"

export async function POST(request: Request) {
  try {
    await checkAuthRequest(request, "password_reset_request")
    const body = await readAuthBody(request)
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return ok({ sent: true })
    await checkRateLimit({ action: "password_reset", identifier: hashToken(email), limit: 3, windowMs: 60 * 60 * 1000, errorCode: "VERIFICATION_RATE_LIMITED" })
    // Keep every account-dependent operation outside the response path, not just SMTP.
    after(async () => {
      try {
        const user = await findUserByEmail(email)
        if (!user?.passwordHash) return
        const token = generateToken()
        const col = await verificationTokensCol()
        const now = Date.now()
        // Only the newest link stays valid, so a leaked or forgotten earlier
        // link cannot consume the account later.
        await col.updateMany({ userId: user.id, purpose: "password_reset", usedAt: { $exists: false } }, { $set: { usedAt: now } })
        await col.insertOne({ _id: new ObjectId(), userId: user.id, purpose: "password_reset", tokenHash: hashToken(token), createdAt: now, expiresAt: new Date(now + 60 * 60 * 1000) })
        const message = passwordResetEmail(user.name, `${getAppUrl()}/reset-password?token=${encodeURIComponent(token)}`)
        await sendMail({ to: user.email, ...message })
      } catch {
        logger.error("api.auth.forgot_password", "Reset email could not be issued or delivered.")
      }
    })
    return ok({ sent: true }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return handleRouteError("api.auth.forgot_password", error)
  }
}
