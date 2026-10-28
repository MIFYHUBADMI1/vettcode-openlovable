import { AsyncLocalStorage } from "node:async_hooks"

export const aiContext = new AsyncLocalStorage<{ signal: AbortSignal; userId?: string; completion?: Promise<void> }>()

export function aiSignal(signal?: AbortSignal): AbortSignal {
  const current = aiContext.getStore()?.signal
  return AbortSignal.any([...(current ? [current] : []), ...(signal ? [signal] : []), AbortSignal.timeout(180_000)])
}

export function trackAiCompletion(completion: Promise<void>): void {
  const context = aiContext.getStore()
  if (context) context.completion = completion
}
