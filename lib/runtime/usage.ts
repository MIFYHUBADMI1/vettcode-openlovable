import "server-only"
import { ObjectId } from "mongodb"
import { runtimeUsageCol, ensureRuntimeIndexes } from "@/lib/db/runtime-collections"
import { cryptoId } from "@/lib/store/id"
import { logger } from "@/lib/logging/logger"
import { RuntimeUsageEventSchema } from "@/runtime/contracts/capabilities"
import type { RuntimeUsageEvent } from "@/runtime/contracts/capabilities"
import type { RuntimeUsageDoc } from "./types"

/**
 * Atai Runtime — usage event service (server-only).
 *
 * Foundation for metering: later phases will call recordUsage after each
 * provider call (attributed to userId/projectId/apiKeyId) and dashboards will
 * query by project/user. Charging (ledger writes) is NOT implemented here.
 *
 * Content policy: usage docs carry attribution/metrics ONLY — never request
 * bodies, prompts, responses, or credentials (contract §16). recordUsage
 * validates against the shared contract and strips unknown keys.
 *
 * @module lib/runtime/usage
 */

/** Validate + persist one usage event. Invalid events are logged and dropped, never thrown — telemetry must not fail requests. */
export async function recordUsage(event: RuntimeUsageEvent): Promise<boolean> {
  const parsed = RuntimeUsageEventSchema.safeParse(event)
  if (!parsed.success) {
    logger.warn("runtime.usage", "invalid usage event dropped", {
      issues: parsed.error.issues.slice(0, 5),
      requestId: event.requestId,
    })
    return false
  }

  const attempts = 3
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await ensureRuntimeIndexes()
      const col = await runtimeUsageCol()
      const doc: RuntimeUsageDoc = { _id: new ObjectId(), ...parsed.data }
      await col.insertOne(doc)
      return true
    } catch (e) {
      lastError = e
      logger.warn("runtime.usage", "usage write failed (retrying)", {
        requestId: event.requestId,
        attempt,
        message: e instanceof Error ? e.message : String(e),
      })
    }
  }
  logger.error("runtime.usage", "usage write failed after retries (non-fatal)", {
    requestId: event.requestId,
    message: lastError instanceof Error ? lastError.message : String(lastError),
  })
  return false
}

/** All usage events for a request (joins request → provider → billing). */
export async function findUsageByRequestId(requestId: string): Promise<RuntimeUsageEvent[]> {
  const col = await runtimeUsageCol()
  return col.find({ requestId }).sort({ createdAt: 1 }).toArray()
}

/** Usage events for a project (dashboard analytics foundation). */
export async function listUsageByProject(
  projectId: string,
  opts: { limit?: number; since?: number } = {},
): Promise<RuntimeUsageEvent[]> {
  const col = await runtimeUsageCol()
  const filter: Record<string, unknown> = { projectId }
  if (opts.since) filter.createdAt = { $gte: opts.since }
  return col
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(opts.limit ?? 100)
    .toArray()
}

/** Usage events for a user across all their projects. */
export async function listUsageByUser(
  userId: string,
  opts: { limit?: number; since?: number } = {},
): Promise<RuntimeUsageEvent[]> {
  const col = await runtimeUsageCol()
  const filter: Record<string, unknown> = { userId }
  if (opts.since) filter.createdAt = { $gte: opts.since }
  return col
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(opts.limit ?? 100)
    .toArray()
}

/** Build a valid usage event with generated id — convenience for later phases. */
export function makeUsageEvent(params: Omit<RuntimeUsageEvent, "id">): RuntimeUsageEvent {
  return { ...params, id: `rusage_${cryptoId()}` }
}
