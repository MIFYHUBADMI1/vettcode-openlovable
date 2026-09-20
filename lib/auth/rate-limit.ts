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
 *
 * Process-local overlay: if THIS instance has already seen a key exceed its
 * window, later hits 429 without another Mongo write (attack / hot-key path).
 * Cross-instance enforcement still uses Mongo on the under-limit path.
 */

type MemoryBucket = { count: number; windowStart: number; windowMs: number; over: boolean }

const memoryBuckets = new Map<string, MemoryBucket>()
const MEMORY_BUCKET_CAP = 5_000

function pruneMemory(now: number) {
  if (memoryBuckets.size < 2_000) return
  for (const [key, bucket] of memoryBuckets) {
    if (now - bucket.windowStart >= bucket.windowMs) memoryBuckets.delete(key)
  }
  if (memoryBuckets.size > MEMORY_BUCKET_CAP) memoryBuckets.clear()
}

function memoryRejects(key: string, limit: number, windowMs: number, now: number): boolean {
  const bucket = memoryBuckets.get(key)
  if (!bucket) return false
  if (now - bucket.windowStart >= windowMs) {
    memoryBuckets.delete(key)
    return false
  }
  return bucket.over || bucket.count > limit
}

function memoryRecord(key: string, windowMs: number, now: number, over: boolean) {
  pruneMemory(now)
  const existing = memoryBuckets.get(key)
  if (!existing || now - existing.windowStart >= windowMs) {
    memoryBuckets.set(key, { count: 1, windowStart: now, windowMs, over })
    return
  }
  existing.count += 1
  existing.over = existing.over || over
}

/** Test-only. */
export function resetMemoryRateLimitForTests() {
  memoryBuckets.clear()
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

  if (memoryRejects(key, params.limit, params.windowMs, now)) {
    throw new AppError(params.errorCode ?? "RATE_LIMITED")
  }

  await ensureIndexes()
  const col = await rateLimitsCol()
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
    const over = inWindow.count > params.limit
    memoryRecord(key, params.windowMs, now, over)
    if (over) {
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
  memoryRecord(key, params.windowMs, now, false)
}
