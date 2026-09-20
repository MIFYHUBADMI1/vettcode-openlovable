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

export async function executeCreateCheckout(params: {
  body: {
    items: Array<{ name: string; quantity: number; price: number }>
    success_url?: string
    cancel_url?: string
    customer_email?: string
    currency?: string
    metadata?: Record<string, string>
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
    const res = await providerFetch({
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

    // Parse checkout response
    let parsed: { checkout_id?: string; checkout_url?: string; status?: string; errors?: unknown }
    try {
      parsed = JSON.parse(res.text)
    } catch {
      throw new ProviderExecutionError(
        "provider_error",
        "The payment provider returned an invalid response.",
        "malformed JSON in 2xx response",
      )
    }

    if (!parsed.checkout_id || !parsed.checkout_url) {
      throw new ProviderExecutionError(
        "provider_error",
        "The payment provider returned an invalid response.",
        "missing checkout_id or checkout_url",
      )
    }

    return {
      checkoutId: parsed.checkout_id,
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
