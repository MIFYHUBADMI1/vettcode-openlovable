import "server-only"
import { logger } from "@/lib/logging/logger"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import { getMapboxAccessToken, getMapboxBaseUrl, getMapboxTimeoutMs } from "./config"
import { categoryForStatus } from "../shared/errors"
import { providerFetch, parseJsonBody, providerStatusFailure } from "../shared/http"
import type { MapboxGeocodeResponse } from "./mapper"

/**
 * Atai Runtime — Mapbox HTTP client (server-only).
 *
 * Read-only geocoding calls with the access token appended server-side.
 * Only the two contract-approved endpoints are reachable — never arbitrary
 * Mapbox API forwarding (§16/§53).
 *
 * @module lib/runtime/router/adapters/mapbox/client
 */

export async function executeGeocodeRequest(params: {
  path: string
  query: URLSearchParams
  requestId?: string
}): Promise<MapboxGeocodeResponse> {
  const startedAt = Date.now()
  params.query.set("access_token", getMapboxAccessToken())

  const res = await providerFetch({
    url: `${getMapboxBaseUrl()}${params.path}?${params.query.toString()}`,
    method: "GET",
    headers: { accept: "application/json" },
    timeoutMs: getMapboxTimeoutMs(),
    requestId: params.requestId,
  })

  const latencyMs = Date.now() - startedAt
  if (!res.ok) {
    logger.error("runtime.mapbox", "provider returned an error status", {
      ...(params.requestId ? { requestId: params.requestId } : {}),
      status: res.status,
      latencyMs,
      detail: res.text.slice(0, 300),
    })
    throw providerStatusFailure(categoryForStatus(res.status), "The maps provider returned an error.", res.text)
  }

  logger.info("runtime.mapbox", "geocode complete", {
    ...(params.requestId ? { requestId: params.requestId } : {}),
    status: res.status,
    latencyMs,
  })
  return parseJsonBody<MapboxGeocodeResponse>(res)
}
