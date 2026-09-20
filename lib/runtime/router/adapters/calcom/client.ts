import "server-only"
import { logger } from "@/lib/logging/logger"
import { calComHeaders, getCalComBaseUrl, getCalComTimeoutMs } from "./config"
import { categoryForStatus } from "../shared/errors"
import { providerFetch, parseJsonBody, providerStatusFailure } from "../shared/http"
import type {
  CalComCreateBookingResponse,
  CalComListBookingsResponse,
} from "./mapper"

/**
 * Atai Runtime — Cal.com HTTP client (server-only).
 *
 * Only the two contract-approved v2 endpoints are reachable — never
 * arbitrary Cal.com API forwarding (§17/§53). createBooking is a side-effect
 * operation (§45/§46): NO automatic retries.
 *
 * @module lib/runtime/router/adapters/calcom/client
 */

export async function executeListBookings(params: {
  query: URLSearchParams
  requestId?: string
}): Promise<CalComListBookingsResponse> {
  const startedAt = Date.now()
  const res = await providerFetch({
    url: `${getCalComBaseUrl()}/v2/bookings?${params.query.toString()}`,
    method: "GET",
    headers: calComHeaders(),
    timeoutMs: getCalComTimeoutMs(),
    requestId: params.requestId,
  })
  const latencyMs = Date.now() - startedAt
  if (!res.ok) {
    logger.error("runtime.calcom", "provider returned an error status", {
      ...(params.requestId ? { requestId: params.requestId } : {}),
      status: res.status,
      latencyMs,
      detail: res.text.slice(0, 300),
    })
    throw providerStatusFailure(categoryForStatus(res.status), "The scheduling provider returned an error.", res.text)
  }
  logger.info("runtime.calcom", "bookings listed", {
    ...(params.requestId ? { requestId: params.requestId } : {}),
    status: res.status,
    latencyMs,
  })
  return parseJsonBody<CalComListBookingsResponse>(res)
}

export async function executeCreateBooking(params: {
  body: unknown
  requestId?: string
}): Promise<CalComCreateBookingResponse> {
  const startedAt = Date.now()
  const res = await providerFetch({
    url: `${getCalComBaseUrl()}/v2/bookings`,
    method: "POST",
    headers: calComHeaders(),
    body: JSON.stringify(params.body),
    timeoutMs: getCalComTimeoutMs(),
    requestId: params.requestId,
  })
  const latencyMs = Date.now() - startedAt
  if (!res.ok) {
    logger.error("runtime.calcom", "provider returned an error status", {
      ...(params.requestId ? { requestId: params.requestId } : {}),
      status: res.status,
      latencyMs,
      detail: res.text.slice(0, 300),
    })
    throw providerStatusFailure(categoryForStatus(res.status), "The scheduling provider returned an error.", res.text)
  }
  logger.info("runtime.calcom", "booking created", {
    ...(params.requestId ? { requestId: params.requestId } : {}),
    status: res.status,
    latencyMs,
  })
  return parseJsonBody<CalComCreateBookingResponse>(res)
}
