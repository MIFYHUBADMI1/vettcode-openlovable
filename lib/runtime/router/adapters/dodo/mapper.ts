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
    /** Optional metadata attached to the checkout (Dodo accepts scalar values). */
    metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
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
    metadata?: Record<string, string | number | boolean>
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

// ── createSubscription (payments/createSubscription) ──────────────────────

/** Dodo subscriptions bill an existing Dodo product — reuse it verbatim. */
export const SUBSCRIPTION_METADATA_LIMIT = 20

export const CreateSubscriptionInputSchema = z
  .object({
    /** The Dodo product id the recurring plan bill — created in Dodo by the app owner. */
    productId: z.string().min(1).max(100),
    quantity: z.number().int().min(1).max(1000).default(1),
    /** End-customer of the subscription. */
    customer: z.object({
      email: z.string().email().max(320),
      name: z.string().min(1).max(255),
    }),
    /** Billing address — Dodo requires at least the two-letter country code. */
    billing: z.object({
      country: z.string().length(2),
      city: z.string().max(100).optional(),
      state: z.string().max(100).optional(),
      street: z.string().max(255).optional(),
      zipcode: z.string().max(20).optional(),
    }),
    /** Optional redirect URL after checkout. */
    returnUrl: z.string().url().optional(),
    metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  })
  .strict()

export type CreateSubscriptionInput = z.infer<typeof CreateSubscriptionInputSchema>

export interface TranslatedSubscriptionRequest {
  body: {
    product_id: string
    quantity: number
    customer: { email: string; name: string }
    billing: {
      country: string
      city?: string
      state?: string
      street?: string
      zipcode?: string
    }
    return_url?: string
    metadata?: Record<string, string | number | boolean>
  }
}

export function toDodoSubscriptionRequest(input: unknown): TranslatedSubscriptionRequest {
  const parsed = CreateSubscriptionInputSchema.safeParse(input)
  if (!parsed.success) {
    throw invalid(`subscription input validation failed: ${firstIssue(parsed)}`)
  }
  const metadataEntries = Object.entries(parsed.data.metadata ?? {})
  if (metadataEntries.length > SUBSCRIPTION_METADATA_LIMIT) {
    throw invalid(`metadata accepts at most ${SUBSCRIPTION_METADATA_LIMIT} entries`)
  }
  return {
    body: {
      product_id: parsed.data.productId,
      quantity: parsed.data.quantity,
      customer: { email: parsed.data.customer.email, name: parsed.data.customer.name },
      billing: parsed.data.billing,
      ...(parsed.data.returnUrl !== undefined ? { return_url: parsed.data.returnUrl } : {}),
      ...(parsed.data.metadata !== undefined ? { metadata: parsed.data.metadata } : {}),
    },
  }
}

/** Documented Dodo subscription creation response (subset the contract consumes). */
export interface DodoSubscriptionCreateResponse {
  subscription_id?: string
  payment_id?: string
  payment_link?: string | null
  recurring_pre_tax_amount?: number | null
  client_secret?: string | null
  errors?: unknown
}

export interface CreateSubscriptionResultData {
  subscriptionId: string
  paymentId: string
  /** Hosted payment link for the customer's first payment (when provided). */
  paymentLink: string | null
  /** Recurring pre-tax amount in the plan currency's minor units. */
  recurringPreTaxAmount: number | null
}

export function toSubscriptionResult(
  response: DodoSubscriptionCreateResponse,
): ProviderExecutionResponse<CreateSubscriptionResultData> {
  assertDodoOk(response)

  if (!response.subscription_id || !response.payment_id) {
    throw new ProviderExecutionError(
      "provider_error",
      "The payment provider returned an invalid response.",
      "missing subscription_id or payment_id",
    )
  }

  return {
    provider: "dodo",
    data: {
      subscriptionId: response.subscription_id,
      paymentId: response.payment_id,
      paymentLink: typeof response.payment_link === "string" ? response.payment_link : null,
      recurringPreTaxAmount:
        typeof response.recurring_pre_tax_amount === "number" && Number.isFinite(response.recurring_pre_tax_amount)
          ? response.recurring_pre_tax_amount
          : null,
    },
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      metadata: { subscriptionCreated: 1 },
    },
  }
}

// ── listPayments (payments/listPayments) ────────────────────────────────────

export const MAX_PAYMENTS_PAGE_SIZE = 100

export const ListPaymentsInputSchema = z
  .object({
    /** 1–100 per page (server clamps) — used by dashboards to page through the feed. */
    limit: z.number().int().min(1).max(MAX_PAYMENTS_PAGE_SIZE).optional(),
    status: z
      .enum([
        "succeeded",
        "failed",
        "cancelled",
        "processing",
        "requires_customer_action",
        "requires_merchant_action",
        "requires_payment_method",
        "requires_confirmation",
        "requires_capture",
        "partially_captured",
        "partially_captured_and_capturable",
      ])
      .optional(),
    subscriptionId: z.string().min(1).max(100).optional(),
    customerId: z.string().min(1).max(100).optional(),
  })
  .strict()

export type ListPaymentsInput = z.infer<typeof ListPaymentsInputSchema>

export interface TranslatedListPaymentsRequest {
  query: {
    page_size?: number
    status?: string
    subscription_id?: string
    customer_id?: string
  }
}

export function toDodoListPaymentsQuery(input: unknown): TranslatedListPaymentsRequest {
  const parsed = ListPaymentsInputSchema.safeParse(input ?? {})
  if (!parsed.success) {
    throw invalid(`list payments input validation failed: ${firstIssue(parsed)}`)
  }
  return {
    query: {
      ...(parsed.data.limit !== undefined ? { page_size: parsed.data.limit } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.subscriptionId !== undefined ? { subscription_id: parsed.data.subscriptionId } : {}),
      ...(parsed.data.customerId !== undefined ? { customer_id: parsed.data.customerId } : {}),
    },
  }
}

/** One item of the Dodo payment-list response (subset the contract consumes). */
export interface DodoPaymentListItem {
  payment_id?: string
  total_amount?: number
  currency?: string
  status?: string | null
  created_at?: string
  subscription_id?: string | null
  customer?: { email?: string | null; name?: string | null }
  metadata?: Record<string, unknown>
}

export interface PaymentListItemData {
  paymentId: string
  /** Gross amount in minor units (as the provider reports it). */
  amount: number | null
  currency: string | null
  status: string
  /** Epoch-ms of the payment creation (null when the provider omits it). */
  createdAt: number | null
  subscriptionId: string | null
  customerEmail: string | null
  /** Caller-owned metadata scalars round-tripped (never request/response content). */
  metadata: Record<string, string | number | boolean>
}

/** Keep only scalar caller metadata — the same hygiene the meter applies. */
function safeMetadata(metadata: Record<string, unknown> | undefined): Record<string, string | number | boolean> {
  if (!metadata || typeof metadata !== "object") return {}
  const out: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = value
    }
  }
  return out
}

export interface PaymentsPageData {
  payments: PaymentListItemData[]
  /** True when the provider truncated the page (another page likely exists). */
  pageFull: boolean
}

export function toPaymentsPage(
  response: unknown,
): ProviderExecutionResponse<PaymentsPageData> {
  assertDodoOk(response as { errors?: unknown })
  const rawItems = Array.isArray(response) ? response : (response as { items?: unknown }).items
  if (!Array.isArray(rawItems)) {
    throw new ProviderExecutionError(
      "provider_error",
      "The payment provider returned an invalid response.",
      "missing items array in payments list",
    )
  }
  const payments: PaymentListItemData[] = []
  for (const item of rawItems.slice(0, MAX_PAYMENTS_PAGE_SIZE)) {
    if (typeof item !== "object" || item === null) continue
    const p = item as DodoPaymentListItem
    if (typeof p.payment_id !== "string" || !p.payment_id) continue
    payments.push({
      paymentId: p.payment_id,
      amount: typeof p.total_amount === "number" && Number.isFinite(p.total_amount) ? p.total_amount : null,
      currency: typeof p.currency === "string" ? p.currency : null,
      status: typeof p.status === "string" ? p.status : "unknown",
      createdAt: typeof p.created_at === "string" ? parseEpochMs(p.created_at) : null,
      subscriptionId: typeof p.subscription_id === "string" ? p.subscription_id : null,
      customerEmail: typeof p.customer?.email === "string" ? p.customer.email : null,
      metadata: safeMetadata(p.metadata),
    })
  }
  return {
    provider: "dodo",
    data: { payments, pageFull: rawItems.length >= MAX_PAYMENTS_PAGE_SIZE },
    usage: { inputTokens: 0, outputTokens: 0, metadata: { paymentsListed: payments.length } },
  }
}

/** Parse provider ISO timestamps into epoch-ms; null when unparseable. */
function parseEpochMs(iso: string): number | null {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

// ── listPayouts (payments/listPayouts) ──────────────────────────────────────

// ACCOUNT-LEVEL: payouts settle the Atai-owned Dodo business account, not a
// single project — the runtime returns them as a tested capability, and the
// finance dashboard labels them honestly (they are never added to a
// project's earnings).

export const ListPayoutsInputSchema = z
  .object({
    limit: z.number().int().min(1).max(MAX_PAYMENTS_PAGE_SIZE).optional(),
  })
  .strict()

export type ListPayoutsInput = z.infer<typeof ListPayoutsInputSchema>

export interface TranslatedListPayoutsRequest {
  query: { page_size?: number }
}

export function toDodoListPayoutsQuery(input: unknown): TranslatedListPayoutsRequest {
  const parsed = ListPayoutsInputSchema.safeParse(input ?? {})
  if (!parsed.success) {
    throw invalid(`list payouts input validation failed: ${firstIssue(parsed)}`)
  }
  return {
    query: {
      ...(parsed.data.limit !== undefined ? { page_size: parsed.data.limit } : {}),
    },
  }
}

export interface DodoPayoutListItem {
  payout_id?: string
  amount?: number
  currency?: string
  status?: string | null
  payment_method?: string | null
  name?: string | null
  created_at?: string
}

export interface PayoutListItemData {
  payoutId: string
  amount: number | null
  currency: string | null
  status: string
  paymentMethod: string | null
  name: string | null
  createdAt: number | null
}

export function toPayoutsPage(
  response: unknown,
): ProviderExecutionResponse<{ payouts: PayoutListItemData[] }> {
  assertDodoOk(response as { errors?: unknown })
  const rawItems = Array.isArray(response) ? response : (response as { items?: unknown }).items
  if (!Array.isArray(rawItems)) {
    throw new ProviderExecutionError(
      "provider_error",
      "The payment provider returned an invalid response.",
      "missing items array in payouts list",
    )
  }
  const payouts: PayoutListItemData[] = []
  for (const item of rawItems.slice(0, MAX_PAYMENTS_PAGE_SIZE)) {
    if (typeof item !== "object" || item === null) continue
    const p = item as DodoPayoutListItem
    if (typeof p.payout_id !== "string" || !p.payout_id) continue
    payouts.push({
      payoutId: p.payout_id,
      amount: typeof p.amount === "number" && Number.isFinite(p.amount) ? p.amount : null,
      currency: typeof p.currency === "string" ? p.currency : null,
      status: typeof p.status === "string" ? p.status : "unknown",
      paymentMethod: typeof p.payment_method === "string" ? p.payment_method : null,
      name: typeof p.name === "string" ? p.name : null,
      createdAt: typeof p.created_at === "string" ? parseEpochMs(p.created_at) : null,
    })
  }
  return {
    provider: "dodo",
    data: { payouts },
    usage: { inputTokens: 0, outputTokens: 0, metadata: { payoutsListed: payouts.length } },
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
