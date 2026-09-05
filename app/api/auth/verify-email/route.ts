import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { verificationTokensCol } from "@/lib/db/collections"
import { hashToken } from "@/lib/auth/crypto"
import { markEmailVerified } from "@/lib/auth/users"
import { AppError } from "@/lib/errors"
import { processVerificationReward } from "@/lib/referrals/referrals"
import { logger } from "@/lib/logging/logger"

/**
 * Consumes an email-verification token (spec section 5). Tokens are single
 * use (`usedAt` set atomically on first use) and time-limited via the Mongo
 * TTL index, so an expired token simply won't be found.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { token?: string }
    const token = body.token ?? ""
    if (!token) return fail("VERIFICATION_INVALID", undefined, 400)

    const col = await verificationTokensCol()
    const tokenHash = hashToken(token)
    const record = await col.findOneAndUpdate(
      { tokenHash, purpose: "email_verify", usedAt: { $exists: false } },
      { $set: { usedAt: Date.now() } },
      { returnDocument: "after" },
    )

    if (!record) {
      // Either never existed, already used, or expired-and-purged by TTL.
      throw new AppError("VERIFICATION_INVALID")
    }

    await markEmailVerified(record.userId)
    logger.info("api.auth.verify_email", "user verified", { userId: record.userId })

    // Process referral verification reward if applicable
    const rewardResult = await processVerificationReward(record.userId).catch((e) => {
      logger.error("api.auth.verify_email", "verification reward failed", { userId: record.userId, error: (e as Error).message })
      return false
    })
    logger.info("api.auth.verify_email", "reward result", { userId: record.userId, awarded: rewardResult })

    return ok({ verified: true })
  } catch (e) {
    return handleRouteError("api.auth.verify_email", e)
  }
}
