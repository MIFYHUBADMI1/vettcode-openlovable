import "server-only"
import { z } from "zod"
import type { ProviderExecutionResponse } from "@/runtime/contracts/router"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"

/**
 * Atai Runtime — Mapbox request/response mapper (server-only).
 *
 * Serves `maps`/`geocode` and `maps`/`reverseGeocode` (Phase 10 §16): the
 * read-only, bounded subset of geocoding that belongs in the runtime
 * contract. Strict schemas; unknown fields rejected, never forwarded; the
 * access token is appended server-side and never accepted from callers.
 *
 * @module lib/runtime/router/adapters/mapbox/mapper
 */

const MAX_QUERY_CHARS = 256
const MAX_LIMIT = 5

export const GeocodeInputSchema = z
  .object({
    query: z.string().min(1).max(MAX_QUERY_CHARS),
    limit: z.number().int().min(1).max(MAX_LIMIT).optional(),
    /** ISO 3166 country filter (e.g. "us" or "gb"). */
    country: z.string().regex(/^[a-z]{2}(-[a-z]{2})?$/, "country must be an ISO 3166 code").optional(),
    /** BCP 47 language tag (e.g. "en"). */
    language: z.string().regex(/^[a-z]{2}(-[A-Za-z]{2,4})?$/, "language must be a BCP 47 tag").optional(),
  })
  .strict()

export const ReverseGeocodeInputSchema = z
  .object({
    longitude: z.number().min(-180).max(180),
    latitude: z.number().min(-90).max(90),
    limit: z.number().int().min(1).max(MAX_LIMIT).optional(),
  })
  .strict()

export type GeocodeInput = z.infer<typeof GeocodeInputSchema>
export type ReverseGeocodeInput = z.infer<typeof ReverseGeocodeInputSchema>

/** Provider-neutral geocoding result item. */
export interface PlaceResultItem {
  id: string
  name: string
  formattedAddress?: string
  latitude: number
  longitude: number
}

export interface MapsResultData {
  results: PlaceResultItem[]
}

export interface TranslatedGeocodeRequest {
  path: string
  query: URLSearchParams
}

export function toMapboxGeocodeRequest(input: unknown): TranslatedGeocodeRequest {
  const parsed = GeocodeInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ProviderExecutionError(
      "unsupported_operation",
      "The request body is invalid for this capability.",
      `geocode input validation failed: ${parsed.error.issues[0]?.path.join(".") ?? "unknown"} ${
        parsed.error.issues[0]?.message ?? ""
      }`.trim(),
    )
  }
  const query = new URLSearchParams()
  query.set("q", parsed.data.query)
  query.set("limit", String(parsed.data.limit ?? 5))
  if (parsed.data.country) query.set("country", parsed.data.country)
  if (parsed.data.language) query.set("language", parsed.data.language)
  return { path: "/search/geocoding/v6/forward", query }
}

export function toMapboxReverseGeocodeRequest(input: unknown): TranslatedGeocodeRequest {
  const parsed = ReverseGeocodeInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new ProviderExecutionError(
      "unsupported_operation",
      "The request body is invalid for this capability.",
      `reverseGeocode input validation failed: ${parsed.error.issues[0]?.path.join(".") ?? "unknown"} ${
        parsed.error.issues[0]?.message ?? ""
      }`.trim(),
    )
  }
  const query = new URLSearchParams()
  query.set("longitude", String(parsed.data.longitude))
  query.set("latitude", String(parsed.data.latitude))
  query.set("limit", String(parsed.data.limit ?? 1))
  return { path: "/search/geocoding/v6/reverse", query }
}

/** Documented Mapbox v6 geocoding response (defensive subset). */
export interface MapboxGeocodeResponse {
  features?: Array<{
    id?: unknown
    name?: unknown
    full_address?: unknown
    coordinates?: { longitude?: unknown; latitude?: unknown }
    geometry?: { coordinates?: unknown }
  }>
}

function coordinatePair(raw: unknown): [number, number] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null
  const lng = raw[0]
  const lat = raw[1]
  if (typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat)) return null
  return [lng, lat]
}

export function toMapsResult(
  response: MapboxGeocodeResponse,
): ProviderExecutionResponse<MapsResultData> {
  const features = response?.features
  if (!Array.isArray(features)) {
    throw new ProviderExecutionError(
      "provider_error",
      "The maps provider returned an invalid response.",
      "missing features array",
    )
  }

  const results: PlaceResultItem[] = []
  for (const f of features) {
    // v6 carries coordinates.longitude/latitude; geometry.coordinates is the
    // defensive fallback ([lng, lat]). Both are provider-reported numbers.
    const fromCoords =
      typeof f?.coordinates?.longitude === "number" && typeof f?.coordinates?.latitude === "number"
        ? ([f.coordinates.longitude, f.coordinates.latitude] as [number, number])
        : coordinatePair(f?.geometry?.coordinates)
    if (!fromCoords) continue
    if (typeof f?.id !== "string" || typeof f?.name !== "string") continue
    results.push({
      id: f.id,
      name: f.name,
      ...(typeof f.full_address === "string" && f.full_address ? { formattedAddress: f.full_address } : {}),
      longitude: fromCoords[0],
      latitude: fromCoords[1],
    })
  }

  return { provider: "mapbox", data: { results } }
}
