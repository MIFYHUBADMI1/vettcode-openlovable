import "server-only"
import { logger } from "@/lib/logging/logger"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import { getResendBaseUrl, getResendTimeoutMs, resendHeaders } from "./config"
import { categoryForStatus } from "../shared/errors"
import { providerFetch, parseJsonBody, providerStatusFailure } from "../shared/http"
import type { ResendSendResponse } from "./mapper"

/**
 * Atai Runtime — Resend HTTP client (server-only).
 *
 * Side-effect operation (§45): NO automatic retries — a duplicate send is a
 * real-world side effect. The Idempotency-Key header (requestId) protects
 * against transport-level replays of the same logical request.
 *
 * @module lib/runtime/router/adapters/resend/client
 */

export async function executeSendEmail(params: {
  body: Record<string, unknown>
  requestId?: string
}): Promise<ResendSendResponse> {
  const startedAt = Date.now()
  const res = await providerFetch({
    url: `${getResendBaseUrl()}/emails`,
    method: "POST",
    headers: resendHeaders(params.requestId),
    body: JSON.stringify(params.body),
    timeoutMs: getResendTimeoutMs(),
    requestId: params.requestId,
  })

  const latencyMs = Date.now() - startedAt
  if (!res.ok) {
    logger.error("runtime.resend", "provider returned an error status", {
      ...(params.requestId ? { requestId: params.requestId } : {}),
      status: res.status,
      latencyMs,
      detail: res.text.slice(0, 300),
    })
    throw providerStatusFailure(categoryForStatus(res.status), "The email provider returned an error.", res.text)
  }

  logger.info("runtime.resend", "email sent", {
    ...(params.requestId ? { requestId: params.requestId } : {}),
    status: res.status,
    latencyMs,
  })
  return parseJsonBody<ResendSendResponse>(res)
}
