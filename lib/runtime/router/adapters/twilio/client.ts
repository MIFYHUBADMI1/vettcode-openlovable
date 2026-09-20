import "server-only"
import { logger } from "@/lib/logging/logger"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import { getTwilioAccountSid, getTwilioBaseUrl, getTwilioTimeoutMs, twilioHeaders } from "./config"
import { categoryForStatus } from "../shared/errors"
import { providerFetch, parseJsonBody, providerStatusFailure } from "../shared/http"
import type { TwilioMessageResponse } from "./mapper"

/**
 * Atai Runtime — Twilio HTTP client (server-only).
 *
 * Side-effect operation (§45): NO automatic retries — a duplicate SMS or
 * WhatsApp message is a real-world side effect with no provider idempotency
 * mechanism to lean on. Single bounded attempt.
 *
 * @module lib/runtime/router/adapters/twilio/client
 */

export async function executeSendMessage(params: {
  form: URLSearchParams
  requestId?: string
}): Promise<TwilioMessageResponse> {
  const startedAt = Date.now()
  // AccountSid comes from trusted server config; encodeURIComponent guards
  // the URL construction regardless.
  const url = `${getTwilioBaseUrl()}/2010-04-01/Accounts/${encodeURIComponent(getTwilioAccountSid())}/Messages.json`

  const res = await providerFetch({
    url,
    method: "POST",
    headers: twilioHeaders(),
    body: params.form.toString(),
    timeoutMs: getTwilioTimeoutMs(),
    requestId: params.requestId,
  })

  const latencyMs = Date.now() - startedAt
  if (!res.ok) {
    logger.error("runtime.twilio", "provider returned an error status", {
      ...(params.requestId ? { requestId: params.requestId } : {}),
      status: res.status,
      latencyMs,
      detail: res.text.slice(0, 300),
    })
    throw providerStatusFailure(categoryForStatus(res.status), "The messaging provider returned an error.", res.text)
  }

  logger.info("runtime.twilio", "message submitted", {
    ...(params.requestId ? { requestId: params.requestId } : {}),
    status: res.status,
    latencyMs,
  })
  return parseJsonBody<TwilioMessageResponse>(res)
}
