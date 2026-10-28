import { randomUUID } from "node:crypto"
import { getDb } from "@/lib/db/mongodb"
import { AppError } from "@/lib/errors"

export const AI_CONCURRENT_OPERATIONS = 2
export const AI_DEADLINE_MS = 9 * 60_000
export const AI_LEASE_MS = 10 * 60_000

interface LeaseDoc { _id: string; owner: string; operation: string; expiresAt: Date }
let indexes: Promise<unknown> | undefined

export async function acquireAiLease(userId: string, operation: string): Promise<() => Promise<void>> {
  const col = (await getDb()).collection<LeaseDoc>("ai_operation_leases")
  indexes ??= col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch((error) => { indexes = undefined; throw error })
  await indexes
  const owner = randomUUID()
  for (let slot = 0; slot < AI_CONCURRENT_OPERATIONS; slot++) {
    const id = `${userId}:${slot}`
    const now = new Date()
    try {
      const claimed = await col.findOneAndUpdate(
        { _id: id, expiresAt: { $lte: now } },
        { $set: { owner, operation, expiresAt: new Date(now.getTime() + AI_LEASE_MS) } },
        { upsert: true, returnDocument: "after" },
      )
      if (!claimed) continue
      let released = false
      return async () => {
        if (released) return
        await col.deleteOne({ _id: id, owner })
        released = true
      }
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error
    }
  }
  const error = new AppError("RATE_LIMITED", "Please wait for an active operation to finish.")
  error.retryAfterSeconds = 5
  throw error
}
