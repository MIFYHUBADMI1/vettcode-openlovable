import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { verificationTokensCol } from "@/lib/db/collections"
import { hashToken } from "@/lib/auth/crypto"
import { markEmailVerified } from "@/lib/auth/users"
import { AppError } from "@/lib/errors"

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
    return ok({ verified: true })
  } catch (e) {
    return handleRouteError("api.auth.verify_email", e)
  }
}
