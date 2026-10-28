import { NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/session"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { AppError } from "@/lib/errors"
import { handleRouteError } from "@/lib/api/respond"
import { logger } from "@/lib/logging/logger"
import { acquireAiLease, AI_DEADLINE_MS } from "./ai-lease"
import { aiContext } from "./ai-context"

// Initial quotas allow interactive chat while bounding multi-output research and images.
export const AI_LIMITS = {
  chat: { minute: 15, hour: 120 },
  analysis: { minute: 4, hour: 30 },
  autocomplete: { minute: 20, hour: 120 },
  resources: { minute: 6, hour: 30 },
  visual: { minute: 3, hour: 30 },
  studio: { minute: 6, hour: 60 },
} as const
const MAX_BODY_BYTES = 256 * 1024

async function boundedRequest(request: Request, signal: AbortSignal, bodySignal: AbortSignal = signal): Promise<NextRequest> {
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) throw new AppError("VALIDATION", "Request body is too large.", 413)
  const chunks: Uint8Array[] = []
  let size = 0
  const reader = request.body?.getReader()
  if (reader) {
    const abort = () => { void reader.cancel().catch(() => {}) }
    bodySignal.addEventListener("abort", abort, { once: true })
    try {
      while (true) {
        if (bodySignal.aborted && !signal.aborted) throw new AppError("VALIDATION", "The request timed out. Please try again.", 408)
        signal.throwIfAborted()
        const { value, done } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > MAX_BODY_BYTES) {
          await reader.cancel()
          throw new AppError("VALIDATION", "Request body is too large.", 413)
        }
        chunks.push(value)
      }
    } finally {
      signal.removeEventListener("abort", abort)
      reader.releaseLock()
    }
  }
  signal.throwIfAborted()
  return new NextRequest(request.url, { method: request.method, headers: request.headers, signal, ...(size ? { body: new Uint8Array(Buffer.concat(chunks)) } : {}) })
}

export function withAiProtection<Args extends unknown[]>(kind: keyof typeof AI_LIMITS, handler: (request: NextRequest, ...args: Args) => Promise<Response>) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    let release: (() => Promise<void>) | undefined
    let deferred = false
    const cleanup = async () => {
      if (!release) return
      try { await release() } catch { logger.warn("ai.lease", "Lease cleanup failed; expiry will recover the slot") }
    }
    try {
      const user = await requireUser()
      const limits = AI_LIMITS[kind]
      await checkRateLimit({ action: `ai_${kind}_burst`, identifier: user.id, limit: limits.minute, windowMs: 60_000 })
      await checkRateLimit({ action: `ai_${kind}_volume`, identifier: user.id, limit: limits.hour, windowMs: 3_600_000 })
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(AI_DEADLINE_MS)])
      const bounded = await boundedRequest(request, signal)
      release = await acquireAiLease(user.id, kind)
      signal.throwIfAborted()
      const context: { signal: AbortSignal; userId: string; completion?: Promise<void> } = { signal, userId: user.id }
      const response = await aiContext.run(context, () => handler(bounded, ...args))
      if (context.completion) {
        deferred = true
        void context.completion.then(cleanup, cleanup)
      }
      return response
    } catch (error) {
      return handleRouteError("api.ai", error)
    } finally {
      if (!deferred) await cleanup()
    }
  }
}
