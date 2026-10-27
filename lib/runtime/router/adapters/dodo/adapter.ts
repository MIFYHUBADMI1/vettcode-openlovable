import "server-only"
import { logger } from "@/lib/logging/logger"
import type {
  ProviderExecutionRequest,
  ProviderExecutionResponse,
} from "@/runtime/contracts/router"
import type { RuntimeProviderAdapter } from "@/lib/runtime/router/adapter"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import { getDodoDefaultCheckoutProductId } from "./config"
import {
  executeCreateCheckout,
  executeCreateSubscription,
  executeListPayments,
  executeListPayouts,
} from "./client"
import {
  toDodoCheckoutRequest,
  toCheckoutResult,
  type CreateCheckoutResultData,
  toDodoSubscriptionRequest,
  toSubscriptionResult,
  type CreateSubscriptionResultData,
  toDodoListPaymentsQuery,
  toPaymentsPage,
  type PaymentsPageData,
  toDodoListPayoutsQuery,
  toPayoutsPage,
  type PayoutListItemData,
} from "./mapper"

/**
 * Atai Runtime — Dodo Payments provider adapter (server-only).
 *
 * Serves the provider-neutral `payments` capability (Phase 10 §20 + the
 * payments commerce wave) through the EXISTING RuntimeProviderAdapter
 * interface. This adapter is for GENERATED APPLICATION payments — NOT Atai's
 * own platform billing (§20: these are completely separate concepts):
 *
 *   createCheckout      → POST /checkouts          (one-time charge)
 *   createSubscription  → POST /subscriptions      (recurring charge on a Dodo product)
 *   listPayments        → GET  /payments           (read-only payment feed)
 *   listPayouts         → GET  /payouts            (read-only, ACCOUNT-LEVEL settlements)
 *
 * Security:
 * - Dodo API key remains server-side only (§9/§53)
 * - Generated apps never learn about Dodo
 * - Idempotency keys prevent duplicate checkouts/subscriptions (§46)
 * - Side effects: writes are single-attempt — no automatic retries (§45)
 * - Attribution: the platform stamps trusted identity metadata (projectId +
 *   apiKeyId + environment) onto checkout/subscription writes so completed
 *   payments are attributable per project. Callers cannot override these
 *   reserved keys — impersonating another project is impossible.
 *
 * @module lib/runtime/router/adapters/dodo/adapter
 */

export const DODO_PROVIDER_ID = "dodo"

/** Reserved attribution metadata keys — injected server-side, never caller-controlled. */
export const ATTRIBUTION_METADATA_KEYS = {
  projectId: "_ataiProjectId",
  apiKeyId: "_ataiApiKeyId",
  environment: "_ataiEnvironment",
} as const

export type DodoResultData =
  | CreateCheckoutResultData
  | CreateSubscriptionResultData
  | PaymentsPageData
  | { payouts: PayoutListItemData[] }

class DodoAdapter implements RuntimeProviderAdapter {
  readonly provider = DODO_PROVIDER_ID

  supports(capability: string, operation: string): boolean {
    return (
      capability === "payments" &&
      (operation === "createCheckout" ||
        operation === "createSubscription" ||
        operation === "listPayments" ||
        operation === "listPayouts")
    )
  }

  async execute(request: ProviderExecutionRequest): Promise<ProviderExecutionResponse<DodoResultData>> {
    const { operation } = request.request
    if (operation === "createCheckout") {
      // 1. Translate (validates; bad caller input → normalized 422-class error).
      const translated = toDodoCheckoutRequest(request.request.input, getDodoDefaultCheckoutProductId())
      // 2. Attribute: stamp trusted server-side metadata onto the checkout.
      const body: typeof translated.body = {
        ...translated.body,
        metadata: withAttribution(translated.body.metadata, request),
      }
      // 3. Call Dodo (single bounded attempt — no automatic retries for side effects).
      const response = await executeCreateCheckout({
        body,
        idempotencyKey: translated.idempotencyKey,
        requestId: request.requestId,
      })
      // 4. Normalize (the mapper consumes the DOCUMENTED Dodo response shape).
      const result = toCheckoutResult({
        checkout_id: response.checkoutId,
        checkout_url: response.checkoutUrl,
        status: response.status,
      })
      logger.info("runtime.dodo", "provider execution complete", {
        requestId: request.requestId,
        provider: this.provider,
        capability: request.request.capability,
        operation,
        checkoutId: response.checkoutId,
        latencyMs: response.latencyMs,
      })
      return result
    }

    if (operation === "createSubscription") {
      // 1. Translate + 2. attribute (trusted identity stamped server-side).
      const translated = toDodoSubscriptionRequest(request.request.input)
      const body: typeof translated.body = {
        ...translated.body,
        metadata: withAttribution(translated.body.metadata, request),
      }
      // 3. Call Dodo — never retried (real recurring charge).
      const { payload, latencyMs } = await executeCreateSubscription({
        body,
        requestId: request.requestId,
      })
      // 4. Normalize.
      const result = toSubscriptionResult(payload)
      logger.info("runtime.dodo", "provider execution complete", {
        requestId: request.requestId,
        provider: this.provider,
        capability: request.request.capability,
        operation,
        subscriptionId: result.data.subscriptionId,
        latencyMs,
      })
      return result
    }

    if (operation === "listPayments") {
      const translated = toDodoListPaymentsQuery(request.request.input)
      const { payload, latencyMs } = await executeListPayments({
        query: translated.query,
        requestId: request.requestId,
      })
      const result = toPaymentsPage(payload)
      logger.info("runtime.dodo", "provider execution complete", {
        requestId: request.requestId,
        provider: this.provider,
        capability: request.request.capability,
        operation,
        count: result.data.payments.length,
        latencyMs,
      })
      return result
    }

    if (operation === "listPayouts") {
      const translated = toDodoListPayoutsQuery(request.request.input)
      const { payload, latencyMs } = await executeListPayouts({
        query: translated.query,
        requestId: request.requestId,
      })
      const result = toPayoutsPage(payload)
      logger.info("runtime.dodo", "provider execution complete", {
        requestId: request.requestId,
        provider: this.provider,
        capability: request.request.capability,
        operation,
        count: result.data.payouts.length,
        latencyMs,
      })
      return result
    }

    // Unreachable through the router (supports gates), kept fail-safe.
    throw new ProviderExecutionError(
      "unsupported_operation",
      "The requested payments operation is not supported.",
      `operation=${operation}`,
    )
  }
}

/**
 * Merge trusted attribution metadata into a checkout/subscription body.
 * Caller metadata keys reserved for platform attribution are overwritten with
 * the authoritative values from the authenticated runtime context — a generated
 * app can never misattribute a payment to another project, key, or environment.
 */
function withAttribution(
  callerMetadata: Record<string, string | number | boolean> | Record<string, string> | undefined,
  request: ProviderExecutionRequest,
): Record<string, string | number | boolean> {
  return {
    ...(callerMetadata ?? {}),
    [ATTRIBUTION_METADATA_KEYS.projectId]: request.auth.projectId,
    [ATTRIBUTION_METADATA_KEYS.apiKeyId]: request.auth.apiKeyId,
    [ATTRIBUTION_METADATA_KEYS.environment]: request.auth.environment,
  }
}

/** The singleton adapter instance registered with the Phase 5 registry. */
export const dodoAdapter = new DodoAdapter()
