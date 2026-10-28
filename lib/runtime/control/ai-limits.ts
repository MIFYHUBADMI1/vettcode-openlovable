import { checkRateLimit } from "@/lib/auth/rate-limit"
import { acquireAiLease, AI_DEADLINE_MS } from "@/lib/api/ai-lease"
import { aiContext } from "@/lib/api/ai-context"
import { runtimeError } from "@/runtime/contracts/errors"
import { logger } from "@/lib/logging/logger"

export async function runRuntimeAi<T>(userId: string, capability: string, execute: () => Promise<T>): Promise<T> {
  const parent = aiContext.getStore()
  if (parent?.signal.aborted) throw runtimeError("runtime_provider_timeout")
  if (parent?.userId === userId) return execute()
  const heavy = ["ai.image", "ai.video", "web.crawl"].includes(capability)
  let release: () => Promise<void>
  try {
    await checkRateLimit({ action: heavy ? "runtime_ai_heavy" : "runtime_ai_burst", identifier: userId, limit: heavy ? 6 : 30, windowMs: 60_000 })
    await checkRateLimit({ action: "runtime_ai_volume", identifier: userId, limit: 300, windowMs: 3_600_000 })
    release = await acquireAiLease(userId, capability)
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "RATE_LIMITED") {
      const limited = runtimeError("runtime_rate_limited")
      limited.retryAfterSeconds = "retryAfterSeconds" in error && typeof error.retryAfterSeconds === "number" ? error.retryAfterSeconds : 5
      throw limited
    }
    throw error
  }
  try {
    const signal = AbortSignal.any([...(parent ? [parent.signal] : []), AbortSignal.timeout(AI_DEADLINE_MS)])
    if (signal.aborted) throw runtimeError("runtime_provider_timeout")
    return await aiContext.run({ signal, userId }, execute)
  } finally {
    try { await release() } catch { logger.warn("runtime.ai", "Lease cleanup failed; expiry will recover the slot") }
  }
}
