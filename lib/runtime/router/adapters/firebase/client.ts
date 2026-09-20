import "server-only"
import { logger } from "@/lib/logging/logger"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import { getFirebaseBaseUrl, getFirebaseProjectId, getFirebaseTimeoutMs } from "./config"
import { getFcmAccessToken } from "./auth"
import { categoryForStatus } from "../shared/errors"
import { providerFetch, parseJsonBody, providerStatusFailure } from "../shared/http"
import type { FcmSendResponse } from "./mapper"

/**
 * Atai Runtime — FCM v1 HTTP client (server-only).
 *
 * Side-effect operation (§45): NO automatic retries — a duplicate push
 * notification is a real-world side effect. Single bounded attempt with the
 * cached OAuth2 access token.
 *
 * @module lib/runtime/router/adapters/firebase/client
 */

export async function executeSendNotification(params: {
  body: Record<string, unknown>
  requestId?: string
}): Promise<FcmSendResponse> {
  const startedAt = Date.now()
  const accessToken = await getFcmAccessToken()
  // ProjectId comes from trusted server config; encodeURIComponent guards the
  // URL construction regardless.
  const url = `${getFirebaseBaseUrl()}/v1/projects/${encodeURIComponent(getFirebaseProjectId())}/messages:send`

  const res = await providerFetch({
    url,
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(params.body),
    timeoutMs: getFirebaseTimeoutMs(),
    requestId: params.requestId,
  })

  const latencyMs = Date.now() - startedAt
  if (!res.ok) {
    logger.error("runtime.firebase", "provider returned an error status", {
      ...(params.requestId ? { requestId: params.requestId } : {}),
      status: res.status,
      latencyMs,
      detail: res.text.slice(0, 300),
    })
    throw providerStatusFailure(categoryForStatus(res.status), "The notification provider returned an error.", res.text)
  }

  logger.info("runtime.firebase", "notification sent", {
    ...(params.requestId ? { requestId: params.requestId } : {}),
    status: res.status,
    latencyMs,
  })
  return parseJsonBody<FcmSendResponse>(res)
}
