import "server-only"
import { logger } from "@/lib/logging/logger"
import type {
  ProviderExecutionRequest,
  ProviderExecutionResponse,
} from "@/runtime/contracts/router"
import type { RuntimeProviderAdapter } from "@/lib/runtime/router/adapter"
import { executeSendEmail } from "./client"
import { toEmailSendResult, toResendRequest, type EmailSendResultData } from "./mapper"

/**
 * Atai Runtime — Resend provider adapter (server-only).
 *
 * Serves the provider-neutral `email`/`send` capability+operation (Phase 10
 * §13) through the EXISTING RuntimeProviderAdapter interface. The platform
 * sender identity and the provider credential are server-side concerns;
 * callers provide only recipients, subject, and content.
 *
 * @module lib/runtime/router/adapters/resend/adapter
 */

export const RESEND_PROVIDER_ID = "resend"

class ResendAdapter implements RuntimeProviderAdapter {
  readonly provider = RESEND_PROVIDER_ID

  supports(capability: string, operation: string): boolean {
    return capability === "email" && operation === "send"
  }

  async execute(request: ProviderExecutionRequest): Promise<ProviderExecutionResponse<EmailSendResultData>> {
    // 1. Translate (validates; injects the platform sender).
    const translated = toResendRequest(request.request.input)

    // 2. Call Resend (single bounded attempt — no automatic retries).
    const response = await executeSendEmail({ body: translated.body, requestId: request.requestId })

    // 3. Normalize.
    const result = toEmailSendResult(response)
    logger.info("runtime.resend", "provider execution complete", {
      requestId: request.requestId,
      provider: this.provider,
      capability: request.request.capability,
      operation: request.request.operation,
      recipientCount: translated.body.to.length,
      latencyMs: Date.now(),
    })
    return result
  }
}

/** The singleton adapter instance registered with the Phase 5 registry. */
export const resendAdapter = new ResendAdapter()
