import { rateLimitsCol, ensureIndexes } from "@/lib/db/collections"
import { AppError } from "@/lib/errors"

/**
 * Fixed-window rate limiter backed by Mongo (spec sections 7 & 28). Reused
 * across login attempts, registration, resend-verification, and password
 * reset requests. Keys are `${action}:${identifier}` so different actions
 * for the same identifier (e.g. same email) don't share a bucket.
 */
export async function checkRateLimit(params: {
  action: string
  identifier: string
  limit: number
  windowMs: number
  errorCode?: "RATE_LIMITED" | "VERIFICATION_RATE_LIMITED"
}): Promise<void> {
  await ensureIndexes()
  const col = await rateLimitsCol()
  const key = `${params.action}:${params.identifier}`
  const now = Date.now()

  const existing = await col.findOne({ key })
  if (!existing || now - existing.windowStart > params.windowMs) {
    await col.updateOne(
      { key },
      {
        $set: {
          key,
          count: 1,
          windowStart: now,
          expiresAt: new Date(now + params.windowMs),
        },
      },
      { upsert: true },
    )
    return
  }

  if (existing.count >= params.limit) {
    throw new AppError(params.errorCode ?? "RATE_LIMITED")
  }

  await col.updateOne({ key }, { $inc: { count: 1 } })
}
