import "server-only"
import { logger } from "@/lib/logging/logger"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import { dodoHeaders, getDodoBaseUrl, getDodoTimeoutMs } from "./config"
import { categoryForStatus, isAlreadyNormalized } from "../shared/errors"
import { providerFetch } from "../shared/http"


/**
 * Atai Runtime — Dodo Payments HTTP client (server-only).
 *
 * The ONLY place the adapter touches the network. Endpoint comes exclusively
 * from trusted server configuration; timeouts are bounded; redirects are
 * never followed; network faults normalize to provider_timeout/unavailable.
 *
 * @module lib/runtime/router/adapters/dodo/client
 */

/**
 * One bounded retry for Dodo connection setup failures. A TCP/TLS connect
 * timeout means the POST never reached Dodo, so no checkout was created and
 * no double side effect is possible (§45 stays intact for every fault after
 * the socket is established). Observed on flaky links: ~1-in-4 connects to
 * test.dodopayments.com time out at undici's 10s default while the next
 * attempt succeeds in ~1.5s.
 */
function isConnectSetupFailure(e: unknown): boolean {
  return e instanceof ProviderExecutionError && e.networkCauseCode === "UND_ERR_CONNECT_TIMEOUT"
}

async function providerFetchWithConnectRetry(opts: Parameters<typeof providerFetch>[0]) {
  try {
    return await providerFetch(opts)
  } catch (e) {
    if (!isConnectSetupFailure(e)) throw e
    return providerFetch(opts)
  }
}

export async function executeCreateCheckout(params: {
  body: {
    product_cart: Array<{ product_id: string; quantity: number }>
    return_url?: string
    customer_email?: string
    billing_currency?: string
    metadata?: Record<string, string | number | boolean>
  }
  idempotencyKey?: string
  requestId?: string
}): Promise<{ checkoutId: string; checkoutUrl: string; status: string; latencyMs: number }> {
  const startedAt = Date.now()

  const url = `${getDodoBaseUrl()}/checkouts`

  // Idempotency: Dodo supports idempotency keys via the Idempotency-Key header
  // (§46). The caller may supply one; otherwise generate a per-request key.
  const headers: Record<string, string> = {
    ...dodoHeaders(),
    ...(params.idempotencyKey ? { "idempotency-key": params.idempotencyKey } :      { "idempotency-key": crypto.randomUUID() }),
  }

  try {
    const res = await providerFetchWithConnectRetry({
      url,
      method: "POST",
      headers,
      body: JSON.stringify(params.body),
      timeoutMs: getDodoTimeoutMs(),
      requestId: params.requestId,
    })

    if (!res.ok) {
      logger.error("runtime.dodo", "provider returned an error status", {
        ...(params.requestId ? { requestId: params.requestId } : {}),
        status: res.status,
        latencyMs: Date.now() - startedAt,
        detail: res.text.slice(0, 300),
      })
      throw failureForStatus(res.status, res.text)
    }

    // Parse checkout response (live Dodo returns `session_id`, no status).
    let parsed: { session_id?: string; checkout_id?: string; checkout_url?: string; status?: string; errors?: unknown }
    try {
      parsed = JSON.parse(res.text)
    } catch {
      throw new ProviderExecutionError(
        "provider_error",
        "The payment provider returned an invalid response.",
        "malformed JSON in 2xx response",
      )
    }

    const checkoutId = parsed.session_id ?? parsed.checkout_id
    if (!checkoutId || !parsed.checkout_url) {
      throw new ProviderExecutionError(
        "provider_error",
        "The payment provider returned an invalid response.",
        "missing session_id or checkout_url",
      )
    }

    return {
      checkoutId,
      checkoutUrl: parsed.checkout_url,
      status: parsed.status ?? "pending",
      latencyMs: Date.now() - startedAt,
    }
  } catch (e) {
    if (isAlreadyNormalized(e)) throw e
    logger.error("runtime.dodo", "provider request failed", {
      ...(params.requestId ? { requestId: params.requestId } : {}),
      latencyMs: Date.now() - startedAt,
      errorName: e instanceof Error ? e.name : "unknown",
    })
    throw new ProviderExecutionError(
      "provider_unavailable",
      "The payment provider is temporarily unavailable.",
    )
  }
}


/**
 * Create a subscription (POST /subscriptions) — a real recurring charge
 * against an existing Dodo product. Side effect: never retried (§45).
 */
export async function executeCreateSubscription(params: {
  body: {
    product_id: string
    quantity: number
    customer: { email: string; name: string }
    billing: { country: string; city?: string; state?: string; street?: string; zipcode?: string }
    return_url?: string
    metadata?: Record<string, string | number | boolean>
  }
  idempotencyKey?: string
  requestId?: string
}): Promise<{ payload: { subscription_id?: string; payment_id?: string; payment_link?: string | null; recurring_pre_tax_amount?: number | null; errors?: unknown }; latencyMs: number }> {
  const startedAt = Date.now()
  const url = `${getDodoBaseUrl()}/subscriptions`
  const headers: Record<string, string> = {
    ...dodoHeaders(),
    "idempotency-key": params.idempotencyKey ?? crypto.randomUUID(),
  }
  try {
    const res = await providerFetchWithConnectRetry({
      url,
      method: "POST",
      headers,
      body: JSON.stringify(params.body),
      timeoutMs: getDodoTimeoutMs(),
      requestId: params.requestId,
    })
    if (!res.ok) {
      logger.error("runtime.dodo", "provider returned an error status", {
        ...(params.requestId ? { requestId: params.requestId } : {}),
        status: res.status,
        latencyMs: Date.now() - startedAt,
        detail: res.text.slice(0, 300),
      })
      throw failureForStatus(res.status, res.text)
    }
    return {
      payload: parseStrictJson<{
        subscription_id?: string
        payment_id?: string
        payment_link?: string | null
        recurring_pre_tax_amount?: number | null
        errors?: unknown
      }>(res.text),
      latencyMs: Date.now() - startedAt,
    }
  } catch (e) {
    if (isAlreadyNormalized(e)) throw e
    logger.error("runtime.dodo", "provider request failed", {
      ...(params.requestId ? { requestId: params.requestId } : {}),
      latencyMs: Date.now() - startedAt,
      errorName: e instanceof Error ? e.name : "unknown",
    })
    throw new ProviderExecutionError(
      "provider_unavailable",
      "The payment provider is temporarily unavailable.",
    )
  }
}

/** Read-only payment feed (GET /payments). Retries harmless, but keep single-attempt for symmetry. */
export async function executeListPayments(params: {
  query: { page_size?: number; status?: string; subscription_id?: string; customer_id?: string }
  requestId?: string
}): Promise<{ payload: { items?: unknown; errors?: unknown } | unknown[]; latencyMs: number }> {
  return executeGet("/payments", params.query, params.requestId)
}

/** Read-only payout feed (GET /payouts) — account-level settlement records. */
export async function executeListPayouts(params: {
  query: { page_size?: number }
  requestId?: string
}): Promise<{ payload: { items?: unknown; errors?: unknown } | unknown[]; latencyMs: number }> {
  return executeGet("/payouts", params.query, params.requestId)
}

async function executeGet(
  path: "/payments" | "/payouts",
  query: Record<string, string | number | undefined>,
  requestId?: string,
): Promise<{ payload: { items?: unknown; errors?: unknown } | unknown[]; latencyMs: number }> {
  const startedAt = Date.now()
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") search.set(key, String(value))
  }
  const qs = search.toString()
  const url = `${getDodoBaseUrl()}${path}${qs ? `?${qs}` : ""}`
  try {
    const res = await providerFetchWithConnectRetry({
      url,
      method: "GET",
      headers: dodoHeaders(),
      timeoutMs: getDodoTimeoutMs(),
      requestId,
    })
    if (!res.ok) {
      logger.error("runtime.dodo", "provider returned an error status", {
        ...(requestId ? { requestId } : {}),
        path,
        status: res.status,
        latencyMs: Date.now() - startedAt,
        detail: res.text.slice(0, 300),
      })
      throw failureForStatus(res.status, res.text)
    }
    return {
      payload: parseStrictJson<{ items?: unknown; errors?: unknown } | unknown[]>(res.text),
      latencyMs: Date.now() - startedAt,
    }
  } catch (e) {
    if (isAlreadyNormalized(e)) throw e
    logger.error("runtime.dodo", "provider request failed", {
      ...(requestId ? { requestId } : {}),
      path,
      latencyMs: Date.now() - startedAt,
      errorName: e instanceof Error ? e.name : "unknown",
    })
    throw new ProviderExecutionError(
      "provider_unavailable",
      "The payment provider is temporarily unavailable.",
    )
  }
}

function parseStrictJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T
  } catch {
    throw new ProviderExecutionError(
      "provider_error",
      "The payment provider returned an invalid response.",
      "malformed JSON in 2xx response",
    )
  }
}

/** Map Dodo HTTP status to normalized failure category. */
function failureForStatus(status: number, bodyText: string): ProviderExecutionError {
  const category = categoryForStatus(status)
  const message = categoryToMessage(category)
  return new ProviderExecutionError(category, message, bodyText.slice(0, 300))
}

function categoryToMessage(category: ProviderExecutionError["category"]): string {
  switch (category) {
    case "provider_timeout":
      return "The payment provider timed out."
    case "provider_rate_limited":
      return "The payment provider is rate limiting requests. Please retry later."
    case "provider_unavailable":
      return "The payment provider is temporarily unavailable."
    default:
      return "The payment provider returned an error."
  }
}
