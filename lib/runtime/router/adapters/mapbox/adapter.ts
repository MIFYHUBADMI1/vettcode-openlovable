import "server-only"
import { logger } from "@/lib/logging/logger"
import type {
  ProviderExecutionRequest,
  ProviderExecutionResponse,
} from "@/runtime/contracts/router"
import type { RuntimeOperation } from "@/runtime/contracts/router"
import type { RuntimeProviderAdapter } from "@/lib/runtime/router/adapter"
import { executeMapboxRequest } from "./client"
import {
  toMapboxGeocodeRequest,
  toMapboxReverseGeocodeRequest,
  toMapboxSearchRequest,
  toMapboxPlaceDetailsRequest,
  toMapboxIsochroneRequest,
  toMapboxDirectionsRequest,
  toMapboxMatrixRequest,
  toMapboxTilesRequest,
  toMapboxStyleSchemaRequest,
  toMapboxStaticImageRequest,
  toMapsResult,
  toMapsDiagnosticResult,
  toBinaryMetadataResult,
  type MapsResultData,
  type MapsDiagnosticResult,
  type TranslatedGeocodeRequest,
} from "./mapper"

/**
 * Atai Runtime — Mapbox provider adapter (server-only).
 *
 * Serves the provider-neutral `maps` capability through the EXISTING
 * RuntimeProviderAdapter interface: the original geocode/reverseGeocode pair
 * plus the Search Box text/place operations, routing (isochrone/directions/
 * matrix), vector-tile and style metadata, and static images — the endpoint set
 * needed to exercise a Mapbox key end-to-end from the playground. Fixed
 * endpoint set, read-only semantics; no arbitrary Mapbox endpoint forwarding
 * (Phase 10 §16).
 *
 * The Mapbox Tokens API is deliberately NOT exposed: it only answers for an
 * account secret-scope token, and the platform's public token gets a 404 there,
 * so it could never be a reliable playground check.
 *
 * Diagnostics: geocoding operations keep the normalized `results` contract;
 * the newer operations return provider JSON under `payload` (documented
 * diagnostic surface). `metadata.debug = true` additionally attaches the raw
 * provider body — intended for playground debugging, not application use.
 *
 * @module lib/runtime/router/adapters/mapbox/adapter
 */

export const MAPBOX_PROVIDER_ID = "mapbox"

const SERVED_OPERATIONS: readonly RuntimeOperation[] = [
  "geocode",
  "reverseGeocode",
  "search",
  "placeDetails",
  "isochrone",
  "directions",
  "matrix",
  "tilesMetadata",
  "styleSchema",
  "staticImage",
]

/** Geocoding operations keep the strict normalized-shape contract. */
const NORMALIZED_GEOCODING = new Set<string>(["geocode", "reverseGeocode", "search", "placeDetails"])

function translate(operation: string, input: unknown): TranslatedGeocodeRequest {
  switch (operation) {
    case "geocode":
      return toMapboxGeocodeRequest(input)
    case "reverseGeocode":
      return toMapboxReverseGeocodeRequest(input)
    case "search":
      return toMapboxSearchRequest(input)
    case "placeDetails":
      return toMapboxPlaceDetailsRequest(input)
    case "isochrone":
      return toMapboxIsochroneRequest(input)
    case "directions":
      return toMapboxDirectionsRequest(input)
    case "matrix":
      return toMapboxMatrixRequest(input)
    case "tilesMetadata":
      return toMapboxTilesRequest(input)
    case "styleSchema":
      return toMapboxStyleSchemaRequest(input)
    case "staticImage":
      return toMapboxStaticImageRequest(input)
    default:
      return { path: "", query: new URLSearchParams() }
  }
}

class MapboxAdapter implements RuntimeProviderAdapter {
  readonly provider = MAPBOX_PROVIDER_ID

  supports(capability: string, operation: string): boolean {
    return capability === "maps" && (SERVED_OPERATIONS as readonly string[]).includes(operation)
  }

  async execute(
    request: ProviderExecutionRequest,
  ): Promise<ProviderExecutionResponse<MapsResultData | MapsDiagnosticResult>> {
    const { operation } = request.request
    const startedAt = Date.now()
    const debug =
      request.request.metadata?.debug === true || request.request.metadata?.debug === "true"

    // 1. Translate (validates; paths are mapper-owned constants).
    const translated = translate(operation, request.request.input)

    // 2. Call Mapbox (bounded, fixed endpoints).
    const response = await executeMapboxRequest(translated, {
      requestId: request.requestId,
      ...(debug ? { debug: true } : {}),
    })

    // 3. Normalize (binary ops report metadata; geocoding keeps `results`).
    let result: ProviderExecutionResponse<MapsResultData | MapsDiagnosticResult>
    if (translated.binary) {
      result = toBinaryMetadataResult(
        operation as "staticImage" | "tilesMetadata",
        response.bytes ?? new ArrayBuffer(0),
        response.contentType,
      )
    } else if (NORMALIZED_GEOCODING.has(operation)) {
      result = toMapsResult((response.json ?? {}) as Parameters<typeof toMapsResult>[0])
    } else {
      result = toMapsDiagnosticResult(operation, response.json ?? null)
    }

    if (debug && response.rawText) {
      // Debug is a playground diagnostic: the raw provider body is attached
      // alongside the normalized data, never replacing it.
      result = {
        ...result,
        data: {
          ...(result.data as object),
          raw: response.rawText,
        } as unknown as MapsResultData | MapsDiagnosticResult,
      }
    }

    logger.info("runtime.mapbox", "provider execution complete", {
      requestId: request.requestId,
      provider: this.provider,
      capability: request.request.capability,
      operation: request.request.operation,
      latencyMs: Date.now() - startedAt,
      ...("results" in result.data
        ? { resultCount: (result.data as MapsResultData).results.length }
        : {}),
    })
    return result
  }
}

/** The singleton adapter instance registered with the Phase 5 registry. */
export const mapboxAdapter = new MapboxAdapter()
