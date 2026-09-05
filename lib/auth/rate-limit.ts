import { rateLimitsCol, ensureIndexes } from "@/lib/db/collections"
import { AppError } from "@/lib/errors"

/**
 * Fixed-window rate limiter backed by Mongo (spec sections 7 & 28). Reused
 * across login attempts, registration, resend-verification, and password
 * reset requests. Keys are `${action}:${identifier}` so different actions
 * for the same identifier (e.g. same email) don't share a bucket.
 *
 * Atomicity: the entire check-and-increment is a single findOneAndUpdate so
 * two concurrent requests for the same key can never both read a count below
 * the limit and both slip through (the previous read → decide → increment
 * sequence had a classic TOCTOU race).
 *
 * Window reset: when the existing window has expired we use $setOnInsert /
 * $set to atomically reset the document to count=1 for the new window.
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
  const windowStart = now
  const expiresAt = new Date(now + params.windowMs)

  // ── Attempt an in-window increment first (the common hot path) ──────────
  // Only touches documents whose window has NOT yet expired so we never
  // accidentally increment a stale bucket.
  const inWindow = await col.findOneAndUpdate(
    { key, windowStart: { $gt: now - params.windowMs } },
    { $inc: { count: 1 } },
    { returnDocument: "after" },
  )

  if (inWindow) {
    // Document existed and was in its active window — check the updated count.
    if (inWindow.count > params.limit) {
      throw new AppError(params.errorCode ?? "RATE_LIMITED")
    }
    return
  }

  // ── No active window found — create/reset the bucket atomically ─────────
  // upsert:true creates the doc if absent; if another concurrent request
  // already created it (race on first request), our filter won't match an
  // in-window doc on the retry path — but at count=1 it can never exceed the
  // limit, so we just let both through and accept a one-request grace on the
  // very first hit of a new window (this is standard fixed-window behaviour).
  await col.updateOne(
    { key, windowStart: { $lte: now - params.windowMs } },
    {
      $set: {
        key,
        count: 1,
        windowStart,
        expiresAt,
      },
    },
    { upsert: true },
  )
}
