import "server-only"
import { logger } from "@/lib/logging/logger"
import type {
  ProviderExecutionRequest,
  ProviderExecutionResponse,
} from "@/runtime/contracts/router"
import type { RuntimeProviderAdapter } from "@/lib/runtime/router/adapter"
import { executeSendNotification } from "./client"
import { toFirebaseRequest, toNotificationResult, type NotificationSendResultData } from "./mapper"

/**
 * Atai Runtime — Firebase provider adapter (server-only).
 *
 * Serves the provider-neutral `notifications`/`send` capability+operation
 * (Phase 10 §15) through the EXISTING RuntimeProviderAdapter interface. No
 * second notification system is created — FCM sits behind the runtime
 * adapter boundary exactly like every other provider.
 *
 * @module lib/runtime/router/adapters/firebase/adapter
 */

export const FIREBASE_PROVIDER_ID = "firebase"

class FirebaseAdapter implements RuntimeProviderAdapter {
  readonly provider = FIREBASE_PROVIDER_ID

  supports(capability: string, operation: string): boolean {
    return capability === "notifications" && operation === "send"
  }

  async execute(request: ProviderExecutionRequest): Promise<ProviderExecutionResponse<NotificationSendResultData>> {
    // 1. Translate (validates; credentials never enter the contract).
    const translated = toFirebaseRequest(request.request.input)

    // 2. Call FCM v1 (single bounded attempt — no automatic retries).
    const response = await executeSendNotification({ body: translated.body, requestId: request.requestId })

    // 3. Normalize.
    const result = toNotificationResult(response)
    logger.info("runtime.firebase", "provider execution complete", {
      requestId: request.requestId,
      provider: this.provider,
      capability: request.request.capability,
      operation: request.request.operation,
      latencyMs: Date.now(),
    })
    return result
  }
}

/** The singleton adapter instance registered with the Phase 5 registry. */
export const firebaseAdapter = new FirebaseAdapter()
