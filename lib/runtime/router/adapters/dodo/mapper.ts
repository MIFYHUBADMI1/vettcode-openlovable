import "server-only"
import { z } from "zod"
import type { ProviderExecutionResponse } from "@/runtime/contracts/router"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"

/**
 * Atai Runtime — Dodo Payments request/response mapper (server-only).
 *
 * Owns the translations for the provider-neutral `payments` capability
 * (createCheckout, Phase 10 §20). Strict schemas; the generated application
 * never sees Dodo-specific wire formats.
 *
 * @module lib/runtime/router/adapters/dodo/mapper
 */

/** Maximum payload sizes (§43). */
export const MAX_CHECKOUT_ITEMS = 50
export const MAX_ITEM_NAME_LENGTH = 255

// ── createCheckout (payments/createCheckout) ────────────────────────────────

export const CreateCheckoutInputSchema = z
  .object({
    /** Line items for the checkout. */
    items: z
      .array(
        z.object({
          name: z.string().min(1).max(MAX_ITEM_NAME_LENGTH),
          quantity: z.number().int().min(1).max(1000),
          price: z.number().positive().max(1_000_000),
        }),
      )
      .min(1)
      .max(MAX_CHECKOUT_ITEMS),
    /** Optional unique idempotency key for the checkout (Dodo deduplicates). */
    idempotencyKey: z.string().min(1).max(255).optional(),
    /** Optional redirect URLs after payment. */
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
    /** Customer email (optional). */
    customerEmail: z.string().email().optional(),
    /** Currency (default USD). */
    currency: z.string().length(3).optional(),
    /** Optional metadata attached to the checkout. */
    metadata: z.record(z.string(), z.string()).optional(),
  })
  .strict()

export type CreateCheckoutInput = z.infer<typeof CreateCheckoutInputSchema>

export interface TranslatedCheckoutRequest {
  body: {
    items: Array<{ name: string; quantity: number; price: number }>
    success_url?: string
    cancel_url?: string
    customer_email?: string
    currency?: string
    metadata?: Record<string, string>
  }
  idempotencyKey?: string
}

export function toDodoCheckoutRequest(input: unknown): TranslatedCheckoutRequest {
  const parsed = CreateCheckoutInputSchema.safeParse(input)
  if (!parsed.success) {
    throw invalid(`checkout input validation failed: ${firstIssue(parsed)}`)
  }
  return {
    body: {
      items: parsed.data.items,
      ...(parsed.data.successUrl !== undefined ? { success_url: parsed.data.successUrl } : {}),
      ...(parsed.data.cancelUrl !== undefined ? { cancel_url: parsed.data.cancelUrl } : {}),
      ...(parsed.data.customerEmail !== undefined ? { customer_email: parsed.data.customerEmail } : {}),
      ...(parsed.data.currency !== undefined ? { currency: parsed.data.currency } : {}),
      ...(parsed.data.metadata !== undefined ? { metadata: parsed.data.metadata } : {}),
    },
    idempotencyKey: parsed.data.idempotencyKey,
  }
}

/** Documented Dodo checkout response (subset the contract consumes). */
export interface DodoCheckoutResponse {
  checkout_id?: string
  checkout_url?: string
  status?: string
  errors?: unknown
}

export interface CreateCheckoutResultData {
  /** Unique checkout session ID from Dodo. */
  checkoutId: string
  /** URL to redirect the customer to for payment. */
  checkoutUrl: string
  /** Checkout status. */
  status: string
}

export function toCheckoutResult(response: DodoCheckoutResponse): ProviderExecutionResponse<CreateCheckoutResultData> {
  assertDodoOk(response)

  if (!response.checkout_id || !response.checkout_url) {
    throw new ProviderExecutionError(
      "provider_error",
      "The payment provider returned an invalid response.",
      "missing checkout_id or checkout_url",
    )
  }

  return {
    provider: "dodo",
    data: {
      checkoutId: response.checkout_id,
      checkoutUrl: response.checkout_url,
      status: response.status ?? "pending",
    },
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      metadata: { checkoutCreated: 1 },
    },
  }
}

// ── Shared ──────────────────────────────────────────────────────────────────

/** Dodo wraps failures in an error response. */
function assertDodoOk(response: { errors?: unknown }): void {
  if (response.errors !== undefined && response.errors !== null) {
    const summary =
      typeof response.errors === "string"
        ? response.errors.slice(0, 200)
        : "provider reported errors"
    throw new ProviderExecutionError(
      "provider_error",
      "The payment provider returned an error.",
      summary,
    )
  }
}

function invalid(detail: string): ProviderExecutionError {
  return new ProviderExecutionError(
    "unsupported_operation",
    "The request body is invalid for this capability.",
    detail,
  )
}

function firstIssue(parsed: { error: { issues: Array<{ path: Array<string | number | symbol>; message: string }> } }): string {
  const issue = parsed.error.issues[0]
  return `${issue?.path.join(".") ?? "unknown"} ${issue?.message ?? ""}`.trim()
}
