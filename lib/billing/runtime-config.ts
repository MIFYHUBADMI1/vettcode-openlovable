import { getDb } from "@/lib/db/mongodb"
import { z } from "zod"
import { logger } from "@/lib/logging/logger"

/**
 * Runtime billing configuration.
 *
 * Some billing knobs need to change without a deploy. This service stores
 * overrides in a single `app_settings` document and layers them ON TOP of
 * the code defaults — a missing or invalid override always falls back to
 * the default, so a corrupted or wiped collection can never break billing.
 */

const SETTINGS_COLLECTION = "app_settings"
const SETTINGS_DOC_ID = "billing"
const CACHE_TTL_MS = 30_000

const CollaborateCostsSchema = z.object({
  /** Credits charged per co-founder chat message. */
  chatMessageCost: z.number().int().min(0).max(10_000),
  /** Credits charged per AI plan analysis run. */
  planAnalysisCost: z.number().int().min(0).max(100_000),
})
export type CollaborateCosts = z.infer<typeof CollaborateCostsSchema>

export const DEFAULT_COLLABORATE_COSTS: CollaborateCosts = {
  chatMessageCost: 2,
  planAnalysisCost: 10,
}

const BillingSettingsSchema = z.object({
  collaborate: CollaborateCostsSchema,
})
type BillingSettings = z.infer<typeof BillingSettingsSchema>

interface SettingsDoc {
  _id: string
  collaborate?: Partial<CollaborateCosts>
  updatedAt: number
}

let cache: { value: BillingSettings; at: number } | null = null

/** Clear the in-process cache (called after an admin update so the change
 * applies immediately on this instance). */
export function invalidateBillingSettings(): void {
  cache = null
}

async function loadSettings(): Promise<BillingSettings> {
  const now = Date.now()
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.value

  let value: BillingSettings = { collaborate: { ...DEFAULT_COLLABORATE_COSTS } }
  try {
    const db = await getDb()
    const doc = await db.collection<SettingsDoc>(SETTINGS_COLLECTION).findOne({ _id: SETTINGS_DOC_ID })
    if (doc) {
      const parsed = BillingSettingsSchema.safeParse({
        collaborate: { ...DEFAULT_COLLABORATE_COSTS, ...(doc.collaborate ?? {}) },
      })
      if (parsed.success) value = parsed.data
    }
  } catch (e) {
    // DB unavailable → fall back to defaults (and don't cache failures for long).
    logger.warn("billing.runtime-config", "failed to load settings, using defaults", {
      message: e instanceof Error ? e.message : String(e),
    })
    cache = { value, at: now - CACHE_TTL_MS + 5_000 } // retry in ~5s, not 30s
    return value
  }

  cache = { value, at: now }
  return value
}

/** Current Collaborate AI costs (DB override layered over code defaults). */
export async function getCollaborateCosts(): Promise<CollaborateCosts> {
  const settings = await loadSettings()
  return settings.collaborate
}

/** Persist Collaborate cost overrides. Passing a field sets it; the caller
 * (admin API) is responsible for authorization. */
export async function updateCollaborateCosts(costs: Partial<CollaborateCosts>): Promise<CollaborateCosts> {
  const db = await getDb()
  const current = await getCollaborateCosts()
  const merged = CollaborateCostsSchema.parse({ ...current, ...costs })

  await db.collection<SettingsDoc>(SETTINGS_COLLECTION).updateOne(
    { _id: SETTINGS_DOC_ID },
    { $set: { collaborate: merged, updatedAt: Date.now() } },
    { upsert: true },
  )
  invalidateBillingSettings()

  logger.info("billing.runtime-config", "collaborate costs updated", { costs: merged })
  return merged
}
