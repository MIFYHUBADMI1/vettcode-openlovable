import { rateLimitsCol, ensureIndexes } from "@/lib/db/collections"
import { AppError } from "@/lib/errors"

const rejectedUntil = new Map<string, number>()
const MEMORY_BUCKET_CAP = 5_000

export function resetMemoryRateLimitForTests() {
  rejectedUntil.clear()
}

export async function checkRateLimit(params: {
  action: string
  identifier: string
  limit: number
  windowMs: number
  errorCode?: "RATE_LIMITED" | "VERIFICATION_RATE_LIMITED"
}): Promise<void> {
  const key = `${params.action}:${params.identifier}`
  const now = Date.now()
  function reject(expiresAt: number): never {
    const error = new AppError(params.errorCode ?? "RATE_LIMITED")
    error.retryAfterSeconds = Math.max(1, Math.ceil((expiresAt - now) / 1000))
    throw error
  }
  const cached = rejectedUntil.get(key)
  if (cached && cached > now) reject(cached)
  rejectedUntil.delete(key)

  function enforce(bucket: { count: number; windowStart: number }) {
    if (bucket.count <= params.limit) return
    const expiresAt = bucket.windowStart + params.windowMs
    for (const [cachedKey, until] of rejectedUntil) {
      if (until <= now) rejectedUntil.delete(cachedKey)
    }
    if (rejectedUntil.size >= MEMORY_BUCKET_CAP) rejectedUntil.delete(rejectedUntil.keys().next().value!)
    // Use Mongo's window, not the time this instance first encountered the bucket.
    rejectedUntil.set(key, expiresAt)
    reject(expiresAt)
  }

  await ensureIndexes()
  const col = await rateLimitsCol()
  const activeFilter = { key, windowStart: { $gt: now - params.windowMs } }
  const inWindow = await col.findOneAndUpdate(activeFilter, { $inc: { count: 1 } }, { returnDocument: "after" })
  if (inWindow) {
    enforce(inWindow)
    return
  }

  try {
    await col.updateOne(
      { key, windowStart: { $lte: now - params.windowMs } },
      { $set: { key, count: 1, windowStart: now, expiresAt: new Date(now + params.windowMs) } },
      { upsert: true },
    )
  } catch (error) {
    if (!(error instanceof Error && /E11000|duplicate key/i.test(error.message))) throw error
    const folded = await col.findOneAndUpdate(activeFilter, { $inc: { count: 1 } }, { returnDocument: "after" })
    if (!folded) throw new AppError("DATABASE_UNAVAILABLE")
    enforce(folded)
  }
}
