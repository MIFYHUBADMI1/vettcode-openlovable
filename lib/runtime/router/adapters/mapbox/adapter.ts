import "server-only"
import { logger } from "@/lib/logging/logger"
import type {
  ProviderExecutionRequest,
  ProviderExecutionResponse,
} from "@/runtime/contracts/router"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"
import type { RuntimeProviderAdapter } from "@/lib/runtime/router/adapter"
import { executeGeocodeRequest } from "./client"
import {
  toMapboxGeocodeRequest,
  toMapboxReverseGeocodeRequest,
  toMapsResult,
  type MapsResultData,
} from "./mapper"

/**
 * Atai Runtime — Mapbox provider adapter (server-only).
 *
 * Serves the provider-neutral `maps`/`geocode` and `maps`/`reverseGeocode`
 * capability+operation pairs (Phase 10 §16) through the EXISTING
 * RuntimeProviderAdapter interface. Read-only operations; no arbitrary
 * endpoint forwarding.
 *
 * @module lib/runtime/router/adapters/mapbox/adapter
 */

export const MAPBOX_PROVIDER_ID = "mapbox"

class MapboxAdapter implements RuntimeProviderAdapter {
  readonly provider = MAPBOX_PROVIDER_ID

  supports(capability: string, operation: string): boolean {
    return capability === "maps" && (operation === "geocode" || operation === "reverseGeocode")
  }

  async execute(request: ProviderExecutionRequest): Promise<ProviderExecutionResponse<MapsResultData>> {
    const { operation } = request.request

    // 1. Translate (validates; token appended server-side).
    const translated =
      operation === "reverseGeocode"
        ? toMapboxReverseGeocodeRequest(request.request.input)
        : toMapboxGeocodeRequest(request.request.input)

    // 2. Call Mapbox (read-only, bounded).
    const response = await executeGeocodeRequest({
      path: translated.path,
      query: translated.query,
      requestId: request.requestId,
    })

    // 3. Normalize.
    const result = toMapsResult(response)
    logger.info("runtime.mapbox", "provider execution complete", {
      requestId: request.requestId,
      provider: this.provider,
      capability: request.request.capability,
      operation: request.request.operation,
      resultCount: result.data.results.length,
      latencyMs: Date.now(),
    })
    return result
  }
}

/** The singleton adapter instance registered with the Phase 5 registry. */
export const mapboxAdapter = new MapboxAdapter()
