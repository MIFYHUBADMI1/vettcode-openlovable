import "server-only"
import { logger } from "@/lib/logging/logger"
import type {
  ProviderExecutionRequest,
  ProviderExecutionResponse,
} from "@/runtime/contracts/router"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import type { RuntimeProviderAdapter } from "@/lib/runtime/router/adapter"
import { executeSendMessage } from "./client"
import {
  toMessageResult,
  toTwilioSmsRequest,
  toTwilioWhatsappRequest,
  type MessageSendResultData,
} from "./mapper"

/**
 * Atai Runtime — Twilio provider adapter (server-only).
 *
 * Serves the provider-neutral `sms`/`send` and `whatsapp`/`send` capability+
 * operation pairs (Phase 10 §14) through the EXISTING RuntimeProviderAdapter
 * interface. Destination validation, sender injection, and credentials are
 * all server-side concerns.
 *
 * @module lib/runtime/router/adapters/twilio/adapter
 */

export const TWILIO_PROVIDER_ID = "twilio"

class TwilioAdapter implements RuntimeProviderAdapter {
  readonly provider = TWILIO_PROVIDER_ID

  supports(capability: string, operation: string): boolean {
    return (capability === "sms" || capability === "whatsapp") && operation === "send"
  }

  async execute(request: ProviderExecutionRequest): Promise<ProviderExecutionResponse<MessageSendResultData>> {
    const { capability } = request.request

    // 1. Translate (validates E.164 + body; injects the platform sender).
    const translated =
      capability === "whatsapp"
        ? toTwilioWhatsappRequest(request.request.input)
        : toTwilioSmsRequest(request.request.input)

    // 2. Call Twilio (single bounded attempt — no automatic retries).
    const response = await executeSendMessage({ form: translated.form, requestId: request.requestId })

    // 3. Normalize.
    const result = toMessageResult(response)
    logger.info("runtime.twilio", "provider execution complete", {
      requestId: request.requestId,
      provider: this.provider,
      capability: request.request.capability,
      operation: request.request.operation,
      status: result.data.status,
      latencyMs: Date.now(),
    })
    return result
  }
}

/** The singleton adapter instance registered with the Phase 5 registry. */
export const twilioAdapter = new TwilioAdapter()
