import "server-only"
import { logger } from "@/lib/logging/logger"
import type {
  ProviderExecutionRequest,
  ProviderExecutionResponse,
} from "@/runtime/contracts/router"
import type { RuntimeProviderAdapter } from "@/lib/runtime/router/adapter"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import { executeCreateCheckout } from "./client"
import { toDodoCheckoutRequest, toCheckoutResult, type CreateCheckoutResultData } from "./mapper"

/**
 * Atai Runtime — Dodo Payments provider adapter (server-only).
 *
 * Serves the provider-neutral `payments`/`createCheckout` capability+operation
 * (Phase 10 §20) through the EXISTING RuntimeProviderAdapter interface. This
 * adapter is for GENERATED APPLICATION payments — NOT Atai's own platform
 * billing (§20: these are completely separate concepts).
 *
 * Security:
 * - Dodo API key remains server-side only (§9/§53)
 * - Generated apps never learn about Dodo
 * - Idempotency keys prevent duplicate checkouts (§46)
 * - Side effects: checkout creation is a side effect — no automatic retries (§45)
 *
 * @module lib/runtime/router/adapters/dodo/adapter
 */

export const DODO_PROVIDER_ID = "dodo"

class DodoAdapter implements RuntimeProviderAdapter {
  readonly provider = DODO_PROVIDER_ID

  supports(capability: string, operation: string): boolean {
    return capability === "payments" && operation === "createCheckout"
  }

  async execute(request: ProviderExecutionRequest): Promise<ProviderExecutionResponse<CreateCheckoutResultData>> {
    // 1. Translate (validates; bad caller input → normalized 422-class error).
    const translated = toDodoCheckoutRequest(request.request.input)

    // 2. Call Dodo (single bounded attempt — no automatic retries for side effects).
    const response = await executeCreateCheckout({
      body: translated.body,
      idempotencyKey: translated.idempotencyKey,
      requestId: request.requestId,
    })

    // 3. Normalize.
    const result = toCheckoutResult(response)
    logger.info("runtime.dodo", "provider execution complete", {
      requestId: request.requestId,
      provider: this.provider,
      capability: request.request.capability,
      operation: request.request.operation,
      checkoutId: response.checkoutId,
      latencyMs: response.latencyMs,
    })
    return result
  }
}

/** The singleton adapter instance registered with the Phase 5 registry. */
export const dodoAdapter = new DodoAdapter()
