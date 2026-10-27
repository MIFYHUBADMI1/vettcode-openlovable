import "server-only"
import { logger } from "@/lib/logging/logger"
import { getSupabaseServiceRoleKey, getSupabaseTimeoutMs, getSupabaseUrl } from "./config"
import { categoryForStatus } from "../shared/errors"
import { providerFetch, providerStatusFailure } from "../shared/http"
import type { TranslatedNotificationRequest } from "./mapper"

/**
 * Atai Runtime — Supabase Realtime broadcast client (server-only).
 *
 * Uses the documented HTTP broadcast endpoint:
 *   POST /realtime/v1/api/broadcast/{topic}/events/{event}
 * with the project key in the `apikey` header. Side-effect operation: NO
 * automatic retries — a duplicate notification is a real-world side effect.
 *
 * @module lib/runtime/router/adapters/supabase/client
 */

export async function executeBroadcastNotification(params: {
  request: TranslatedNotificationRequest
  requestId?: string
}): Promise<{ status: number }> {
  const startedAt = Date.now()
  const { channel, event, payload, privateChannel } = params.request
  const query = privateChannel ? "?private=true" : ""
  const url =
    `${getSupabaseUrl()}/realtime/v1/api/broadcast/` +
    `${encodeURIComponent(channel)}/events/${encodeURIComponent(event)}${query}`

  const res = await providerFetch({
    url,
    method: "POST",
    headers: {
      apikey: getSupabaseServiceRoleKey(),
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    timeoutMs: getSupabaseTimeoutMs(),
    requestId: params.requestId,
  })

  const latencyMs = Date.now() - startedAt
  if (!res.ok) {
    logger.error("runtime.supabase", "provider returned an error status", {
      ...(params.requestId ? { requestId: params.requestId } : {}),
      status: res.status,
      latencyMs,
      detail: res.text.slice(0, 300),
    })
    throw providerStatusFailure(categoryForStatus(res.status), "The notification provider returned an error.", res.text)
  }

  logger.info("runtime.supabase", "notification broadcast", {
    ...(params.requestId ? { requestId: params.requestId } : {}),
    status: res.status,
    latencyMs,
  })
  return { status: res.status }
}
