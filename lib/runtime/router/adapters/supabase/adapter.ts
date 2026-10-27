import "server-only"
import { logger } from "@/lib/logging/logger"
import type {
  ProviderExecutionRequest,
  ProviderExecutionResponse,
} from "@/runtime/contracts/router"
import type { RuntimeProviderAdapter } from "@/lib/runtime/router/adapter"
import { executeBroadcastNotification } from "./client"
import { toNotificationResult, toSupabaseRequest, type NotificationSendResultData } from "./mapper"

/**
 * Atai Runtime — Supabase provider adapter (server-only).
 *
 * Serves the provider-neutral `notifications`/`send` capability through the
 * existing RuntimeProviderAdapter interface, using Supabase Realtime
 * Broadcast. Channels are scoped to the authenticated runtime project inside
 * the mapper.
 *
 * @module lib/runtime/router/adapters/supabase/adapter
 */

export const SUPABASE_PROVIDER_ID = "supabase"

class SupabaseAdapter implements RuntimeProviderAdapter {
  readonly provider = SUPABASE_PROVIDER_ID

  supports(capability: string, operation: string): boolean {
    return capability === "notifications" && operation === "send"
  }

  async execute(
    request: ProviderExecutionRequest,
  ): Promise<ProviderExecutionResponse<NotificationSendResultData>> {
    const startedAt = Date.now()

    // 1. Translate (validates input; scopes the channel by trusted project id).
    const translated = toSupabaseRequest(request.request.input, request.auth.projectId)

    // 2. Broadcast (single bounded attempt — no automatic retries).
    await executeBroadcastNotification({ request: translated, requestId: request.requestId })

    // 3. Normalize.
    const result = toNotificationResult(translated)
    logger.info("runtime.supabase", "provider execution complete", {
      requestId: request.requestId,
      provider: this.provider,
      capability: request.request.capability,
      operation: request.request.operation,
      latencyMs: Date.now() - startedAt,
    })
    return result
  }
}

/** The singleton adapter instance registered with the Phase 5 registry. */
export const supabaseAdapter = new SupabaseAdapter()
