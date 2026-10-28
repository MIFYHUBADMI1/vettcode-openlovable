import { generateText } from "ai"
import { MODEL } from "@/lib/analysis/model"
import { logger } from "@/lib/logging/logger"
import { aiSignal } from "@/lib/api/ai-context"

/**
 * Retry wrapper for AI generation — free models can be flaky.
 * Retries up to maxRetries times with exponential backoff (1s, 2s, 4s...).
 * Returns the generated text on success, throws the last error on failure.
 */
export async function generateWithRetry(
  messages: { system: string; prompt: string },
  options: { maxOutputTokens?: number; maxRetries?: number } = {},
): Promise<string> {
  const { maxOutputTokens = 2000, maxRetries = 2 } = options
  let lastError: Error | null = null
  const signal = aiSignal()

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    signal.throwIfAborted()
    try {
      const result = await generateText({
        model: MODEL,
        system: messages.system,
        prompt: messages.prompt,
        maxOutputTokens,
        abortSignal: signal,
      })
      return result.text
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      // Don't retry on the last attempt
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s...
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)))
      }
    }
  }
  throw lastError
}

/** Log AI provider failure with context for debugging. */
export function logAIFailure(
  stage: string,
  error: unknown,
  context: { projectId: string; userId: string; operation: string },
): void {
  logger.error(stage, "AI provider failed after retries", {
    message: error instanceof Error ? error.message : String(error),
    ...context,
  })
}
