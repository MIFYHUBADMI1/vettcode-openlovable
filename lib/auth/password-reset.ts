import { ensureIndexes, usersCol, verificationTokensCol } from "@/lib/db/collections"
import { getMongoClient } from "@/lib/db/mongodb"
import { hashPassword, hashToken } from "@/lib/auth/crypto"
import { setPasswordHash } from "@/lib/auth/users"
import { destroyAllSessionsForUser } from "@/lib/auth/session"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { AppError } from "@/lib/errors"

export async function resetPassword(token: string, password: string): Promise<void> {
  await ensureIndexes()
  const tokens = await verificationTokensCol()
  const tokenHash = hashToken(token)
  const filter = { tokenHash, purpose: "password_reset" as const }
  const existing = await tokens.findOne(filter)
  if (!existing || existing.usedAt !== undefined) {
    throw new AppError("VERIFICATION_INVALID", "This reset link is invalid or has already been used.")
  }
  if (existing.expiresAt.getTime() <= Date.now()) {
    throw new AppError("VERIFICATION_EXPIRED", "This reset link has expired. Please request a new one.")
  }
  await checkRateLimit({ action: "password_reset_account", identifier: existing.userId, limit: 10, windowMs: 15 * 60_000 })
  const passwordHash = await hashPassword(password)
  const client = await getMongoClient()
  const session = client.startSession()
  try {
    await session.withTransaction(async () => {
      const now = Date.now()
      const claimed = await tokens.findOneAndUpdate(
        { ...filter, usedAt: { $exists: false }, expiresAt: { $gt: new Date(now) } },
        { $set: { usedAt: now } },
        { session, returnDocument: "after" },
      )
      if (!claimed) throw new AppError("VERIFICATION_INVALID", "This reset link is invalid, expired, or already used.")
      const user = await (await usersCol()).findOne({ id: claimed.userId, deletedAt: { $exists: false }, banned: { $ne: true }, suspended: { $ne: true } }, { session })
      if (!user?.passwordHash) throw new AppError("VERIFICATION_INVALID")
      if (!await setPasswordHash(claimed.userId, passwordHash, session)) {
        throw new AppError("VERIFICATION_INVALID")
      }
      await destroyAllSessionsForUser(claimed.userId, session)
      await tokens.updateMany(
        { userId: claimed.userId, purpose: "password_reset", usedAt: { $exists: false } },
        { $set: { usedAt: now } },
        { session },
      )
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, maxCommitTimeMS: 10_000 })
  } finally {
    await session.endSession()
  }
}
