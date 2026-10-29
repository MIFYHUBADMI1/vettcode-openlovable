import { checkRateLimit } from "@/lib/auth/rate-limit"

// Initial quotas allow interactive chat while bounding multi-output research and images.
export const AI_LIMITS = {
  chat: { minute: 15, hour: 120 },
  analysis: { minute: 4, hour: 30 },
  autocomplete: { minute: 20, hour: 120 },
  resources: { minute: 6, hour: 30 },
  visual: { minute: 3, hour: 30 },
  studio: { minute: 6, hour: 60 },
} as const

export type AiOperation = keyof typeof AI_LIMITS

/** Per-account burst + hourly quotas sharing the `ai_<kind>_*` buckets, so a
 * manual retry that restarts Understand/Plan draws from the same budget as a
 * fresh analysis request. */
export async function checkAiQuota(kind: AiOperation, userId: string): Promise<void> {
  const limits = AI_LIMITS[kind]
  await checkRateLimit({ action: `ai_${kind}_burst`, identifier: userId, limit: limits.minute, windowMs: 60_000 })
  await checkRateLimit({ action: `ai_${kind}_volume`, identifier: userId, limit: limits.hour, windowMs: 3_600_000 })
}
