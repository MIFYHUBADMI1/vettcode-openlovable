import "server-only"
import { logger } from "@/lib/logging/logger"
import { getMapboxAccessToken, getMapboxBaseUrl, getMapboxTimeoutMs } from "./config"
import { categoryForStatus } from "../shared/errors"
import { providerFetch, parseJsonBody, providerStatusFailure } from "../shared/http"
import type { TranslatedGeocodeRequest } from "./mapper"

/**
 * Atai Runtime — Mapbox HTTP client (server-only).
 *
 * Bounded, read-oriented calls against the FIXED endpoint set built by the
 * mapper — never arbitrary Mapbox API forwarding (§16/§53): every path here
 * originates in mapper code, the access token is appended server-side, and
 * redirects are never followed (shared fetch). Supports JSON GETs, the
 * Matrix POST-form variant, and binary tile/static-map GETs. When `debug`
 * is requested the raw (capped) provider body is returned to the adapter —
 * a deliberate diagnostic surface for the playground, gated per request.
 *
 * @module lib/runtime/router/adapters/mapbox/client
 */

export interface MapboxRequestOutcome {
  status: number
  /** Parsed JSON body for text responses. */
  json?: unknown
  /** Raw bytes for binary responses. */
  bytes?: ArrayBuffer
  contentType: string
  /** Raw body text — only populated when debug was requested. */
  rawText?: string
}

export async function executeMapboxRequest(
  request: TranslatedGeocodeRequest,
  params: { requestId?: string; debug?: boolean } = {},
): Promise<MapboxRequestOutcome> {
  const startedAt = Date.now()
  request.query.set("access_token", getMapboxAccessToken())

  const url = `${getMapboxBaseUrl()}${request.path}?${request.query.toString()}`
  const isPost = request.postForm === true
  const res = await providerFetch({
    url,
    method: isPost ? "POST" : "GET",
    headers: {
      accept: request.binary ? "*/*" : "application/json",
      ...(isPost ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
    ...(isPost ? { body: "" } : {}),
    ...(request.binary ? { binary: true } : {}),
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

  logger.info("runtime.mapbox", "request complete", {
    ...(params.requestId ? { requestId: params.requestId } : {}),
    path: request.path,
    status: res.status,
    latencyMs,
  })

  if (request.binary) {
    return {
      status: res.status,
      bytes: res.bytes ?? new ArrayBuffer(0),
      contentType: res.contentType || "application/octet-stream",
    }
  }
  const outcome: MapboxRequestOutcome = {
    status: res.status,
    json: parseJsonBody(res),
    contentType: "application/json",
    ...(params.debug ? { rawText: res.text.slice(0, 16_384) } : {}),
  }
  return outcome
}
