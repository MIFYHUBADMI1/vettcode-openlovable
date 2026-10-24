/**
 * Atai SDK — Payments capability.
 *
 * Provider-neutral payment operations (`payments`): checkout sessions,
 * recurring subscriptions, the read-only payment feed, and account-level
 * payout records. The application never learns which payment provider Atai
 * operates behind the runtime.
 *
 * @module capabilities/payments
 */

import { AtaiError } from "../errors.js"
import { execute } from "../transport.js"
import type { ResolvedConfig } from "../config.js"
import type {
  AtaiRequestOptions,
  PaymentsCreateCheckoutInput,
  PaymentsCreateCheckoutResult,
  PaymentsCreateSubscriptionInput,
  PaymentsCreateSubscriptionResult,
  PaymentsListPaymentsInput,
  PaymentsListPaymentsResult,
  PaymentsListPayoutsInput,
  PaymentsListPayoutsResult,
} from "../types.js"

/** Client-side validation (developer experience only; the server is authoritative). */
function validateCheckoutInput(input: PaymentsCreateCheckoutInput): void {
  if (input === null || typeof input !== "object") {
    throw new AtaiError("atai_invalid_request", "Checkout input must be an object with `items`.")
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new AtaiError("atai_invalid_request", "Checkout requires at least one item.")
  }
  for (const item of input.items) {
    if (typeof item.name !== "string" || item.name.length === 0) {
      throw new AtaiError("atai_invalid_request", "Each item must have a non-empty `name`.")
    }
    if (typeof item.quantity !== "number" || item.quantity < 1) {
      throw new AtaiError("atai_invalid_request", "Each item must have a positive integer `quantity`.")
    }
    if (typeof item.price !== "number" || item.price <= 0) {
      throw new AtaiError("atai_invalid_request", "Each item must have a positive `price`.")
    }
  }
}

/** The Atai payments capability. Exposed as `atai.payments` on the client. */
export class PaymentsCapability {
  constructor(private readonly config: ResolvedConfig) {}

  /** Create a checkout session (`payments`/`createCheckout`). */
  async createCheckout(input: PaymentsCreateCheckoutInput, options?: AtaiRequestOptions): Promise<PaymentsCreateCheckoutResult> {
    validateCheckoutInput(input)

    const body = {
      capability: "payments",
      operation: "createCheckout",
      input: {
        items: input.items,
        ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
        ...(input.successUrl !== undefined ? { successUrl: input.successUrl } : {}),
        ...(input.cancelUrl !== undefined ? { cancelUrl: input.cancelUrl } : {}),
        ...(input.customerEmail !== undefined ? { customerEmail: input.customerEmail } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      },
    }

    const { envelope } = await execute<typeof body, PaymentsCreateCheckoutResult>(this.config, {
      path: "",
      method: "POST",
      body,
      options,
    })

    return assertCheckoutResult(envelope.data.data)
  }

  /** Create a recurring subscription (`payments`/`createSubscription`). Real charge — not retried. */
  async createSubscription(input: PaymentsCreateSubscriptionInput, options?: AtaiRequestOptions): Promise<PaymentsCreateSubscriptionResult> {
    validateSubscriptionInput(input)

    const body = {
      capability: "payments",
      operation: "createSubscription",
      input: {
        productId: input.productId,
        ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
        customer: input.customer,
        billing: input.billing,
        ...(input.returnUrl !== undefined ? { returnUrl: input.returnUrl } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      },
    }

    const { envelope } = await execute<typeof body, PaymentsCreateSubscriptionResult>(this.config, {
      path: "",
      method: "POST",
      body,
      options,
    })

    return assertSubscriptionResult(envelope.data.data)
  }

  /** Read the payment feed (`payments`/`listPayments`). Read-only — safe to call freely. */
  async listPayments(input: PaymentsListPaymentsInput = {}, options?: AtaiRequestOptions): Promise<PaymentsListPaymentsResult> {
    const body = {
      capability: "payments",
      operation: "listPayments",
      input: {
        ...(input.limit !== undefined ? { limit: input.limit } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.subscriptionId !== undefined ? { subscriptionId: input.subscriptionId } : {}),
        ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
      },
    }

    const { envelope } = await execute<typeof body, PaymentsListPaymentsResult>(this.config, {
      path: "",
      method: "POST",
      body,
      options,
    })

    return assertPaymentsPage(envelope.data.data)
  }

  /** Read account-level payout records (`payments`/`listPayouts`). Read-only. */
  async listPayouts(input: PaymentsListPayoutsInput = {}, options?: AtaiRequestOptions): Promise<PaymentsListPayoutsResult> {
    const body = {
      capability: "payments",
      operation: "listPayouts",
      input: {
        ...(input.limit !== undefined ? { limit: input.limit } : {}),
      },
    }

    const { envelope } = await execute<typeof body, PaymentsListPayoutsResult>(this.config, {
      path: "",
      method: "POST",
      body,
      options,
    })

    return assertPayoutsPage(envelope.data.data)
  }
}

/** Client-side validation for subscription input (developer experience only). */
function validateSubscriptionInput(input: PaymentsCreateSubscriptionInput): void {
  if (input === null || typeof input !== "object") {
    throw new AtaiError("atai_invalid_request", "Subscription input must be an object.")
  }
  if (typeof input.productId !== "string" || input.productId.length === 0) {
    throw new AtaiError("atai_invalid_request", "A Dodo `productId` is required for a subscription.")
  }
  if (!input.customer || typeof input.customer.email !== "string" || input.customer.email.length === 0) {
    throw new AtaiError("atai_invalid_request", "A customer email is required for a subscription.")
  }
  if (!input.billing || typeof input.billing.country !== "string" || input.billing.country.length !== 2) {
    throw new AtaiError("atai_invalid_request", "A two-letter `billing.country` is required for a subscription.")
  }
  if (input.quantity !== undefined && (typeof input.quantity !== "number" || input.quantity < 1)) {
    throw new AtaiError("atai_invalid_request", "`quantity` must be a positive integer.")
  }
}

/** Narrow runtime check on the returned payload (server responses are never trusted blindly). */
function assertSubscriptionResult(payload: unknown): PaymentsCreateSubscriptionResult {
  if (typeof payload !== "object" || payload === null) {
    throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.")
  }
  const p = payload as Record<string, unknown>
  if (typeof p.subscriptionId !== "string" || typeof p.paymentId !== "string") {
    throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.")
  }
  return payload as unknown as PaymentsCreateSubscriptionResult
}

function assertPaymentsPage(payload: unknown): PaymentsListPaymentsResult {
  if (typeof payload !== "object" || payload === null || !Array.isArray((payload as { payments?: unknown }).payments)) {
    throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.")
  }
  const items = (payload as { payments: Array<Record<string, unknown>> }).payments
  for (const item of items) {
    if (typeof item.paymentId !== "string") {
      throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.")
    }
  }
  return payload as unknown as PaymentsListPaymentsResult
}

function assertPayoutsPage(payload: unknown): PaymentsListPayoutsResult {
  if (typeof payload !== "object" || payload === null || !Array.isArray((payload as { payouts?: unknown }).payouts)) {
    throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.")
  }
  const items = (payload as { payouts: Array<Record<string, unknown>> }).payouts
  for (const item of items) {
    if (typeof item.payoutId !== "string") {
      throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.")
    }
  }
  return payload as unknown as PaymentsListPayoutsResult
}

/** Narrow runtime check on the returned payload (server responses are never trusted blindly). */
function assertCheckoutResult(payload: unknown): PaymentsCreateCheckoutResult {
  if (typeof payload !== "object" || payload === null) {
    throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.")
  }
  const p = payload as Record<string, unknown>
  if (typeof p.checkoutId !== "string" || typeof p.checkoutUrl !== "string" || typeof p.status !== "string") {
    throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.")
  }
  return payload as unknown as PaymentsCreateCheckoutResult
}
