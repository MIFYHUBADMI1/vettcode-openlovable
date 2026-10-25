import "server-only"
import { z } from "zod"
import type { ProviderExecutionResponse } from "@/runtime/contracts/router"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"

/**
 * Atai Runtime — Mapbox request/response mapper (server-only).
 *
 * Maps provider-neutral `maps` operations onto the Mapbox API surface for
 * playground/runtime testing: search (forward geocoding), reverseGeocode,
 * placeDetails, isochrone, directions, matrix, tilesMetadata, styleSchema,
 * staticImage and tokens. Every operation keeps the §16 invariants: strict
 * input schemas (unknown fields rejected, never forwarded), a fixed set of
 * reachable endpoint paths (constructed here — caller strings are
 * length/charset bounded and URL-encoded), and the access token appended
 * server-side only.
 *
 * @module lib/runtime/router/adapters/mapbox/mapper
 */

const MAX_QUERY_CHARS = 256
const MAX_LIMIT = 10

function invalid(operation: string, error: z.ZodError): never {
  throw new ProviderExecutionError(
    "unsupported_operation",
    "The request body is invalid for this capability.",
    `${operation} input validation failed: ${error.issues[0]?.path.join(".") ?? "unknown"} ${error.issues[0]?.message ?? ""}`.trim(),
  )
}

/** [longitude, latitude] pair as Mapbox path parameters expect. */
const LonLatSchema = z
  .array(z.number().finite())
  .length(2)
  .refine(([lng, lat]) => lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90, {
    message: "coordinates must be [longitude (-180..180), latitude (-90..90)]",
  })

/**
 * Path-segment sanitizer for caller strings that reach the URL PATH. The
 * charset is a strict subset of unreserved URL characters, so no escaping
 * is ever needed — anything else (slashes, dots-as-traversal excluded by
 * rule, percents, spaces) is rejected outright.
 */
function encodedSegment(value: string, max: number, extraChars = ""): string {
  const pattern = new RegExp(`^[A-Za-z0-9._@${extraChars}\\-]+$`)
  if (!pattern.test(value)) {
    throw new ProviderExecutionError(
      "unsupported_operation",
      "The request body is invalid for this capability.",
      `path segment contains unsupported characters (allowed: A-Z a-z 0-9 . _ @ - ${extraChars.replace(/\\/g, "")})`,
    )
  }
  return value.slice(0, max)
}

function formatCoordinates(coords: readonly (readonly number[])[]): string {
  return coords.map(([lng, lat]) => `${lng},${lat}`).join(";")
}

// ─── search / geocode / reverseGeocode / placeDetails ──────────────────────

export const GeocodeInputSchema = z
  .object({
    query: z.string().min(1).max(MAX_QUERY_CHARS),
    limit: z.number().int().min(1).max(5).optional(),
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
    limit: z.number().int().min(1).max(5).optional(),
  })
  .strict()

export const SearchInputSchema = z
  .object({
    query: z.string().min(1).max(MAX_QUERY_CHARS),
    limit: z.number().int().min(1).max(MAX_LIMIT).optional(),
    /** Bias results toward a location. */
    longitude: z.number().min(-180).max(180).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    /** Mapbox Search Box types, e.g. ["place","poi","address"]. */
    types: z.array(z.string().regex(/^[a-z_]{2,20}$/)).max(10).optional(),
    bbox: z.array(z.number().finite()).length(4).optional(),
    country: z.string().regex(/^[a-z]{2}(-[a-z]{2})?$/, "country must be an ISO 3166 code").optional(),
    language: z.string().regex(/^[a-z]{2}(-[A-Za-z]{2,4})?$/, "language must be a BCP 47 tag").optional(),
  })
  .strict()

export const PlaceDetailsInputSchema = z
  .object({
    /** Mapbox feature/POI id returned by search. */
    poiId: z.string().regex(/^[A-Za-z0-9._@-]{1,64}$/, "poiId must be a Mapbox feature id"),
    longitude: z.number().min(-180).max(180).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    language: z.string().regex(/^[a-z]{2}(-[A-Za-z]{2,4})?$/, "language must be a BCP 47 tag").optional(),
  })
  .strict()

export type GeocodeInput = z.infer<typeof GeocodeInputSchema>
export type ReverseGeocodeInput = z.infer<typeof ReverseGeocodeInputSchema>
export type SearchInput = z.infer<typeof SearchInputSchema>
export type PlaceDetailsInput = z.infer<typeof PlaceDetailsInputSchema>

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

/**
 * A non-geocoding operation result: the operation name plus Mapbox's JSON
 * body passed through as diagnostics (playground/debug surface). Normalized
 * `results` stay the stable contract; `payload` is provider-reported detail.
 */
export interface MapsDiagnosticResult {
  operation: string
  payload: unknown
}

export interface TranslatedGeocodeRequest {
  path: string
  query: URLSearchParams
  /** Set when the call must be a POST (Matrix API form-encoded query). */
  postForm?: boolean
  /** Set when the response body is binary (static maps PNG). */
  binary?: boolean
}

export function toMapboxGeocodeRequest(input: unknown): TranslatedGeocodeRequest {
  const parsed = GeocodeInputSchema.safeParse(input)
  if (!parsed.success) invalid("geocode", parsed.error)
  const query = new URLSearchParams()
  query.set("q", parsed.data.query)
  query.set("limit", String(parsed.data.limit ?? 5))
  if (parsed.data.country) query.set("country", parsed.data.country)
  if (parsed.data.language) query.set("language", parsed.data.language)
  return { path: "/search/geocoding/v6/forward", query }
}

export function toMapboxReverseGeocodeRequest(input: unknown): TranslatedGeocodeRequest {
  const parsed = ReverseGeocodeInputSchema.safeParse(input)
  if (!parsed.success) invalid("reverseGeocode", parsed.error)
  const query = new URLSearchParams()
  query.set("longitude", String(parsed.data.longitude))
  query.set("latitude", String(parsed.data.latitude))
  query.set("limit", String(parsed.data.limit ?? 1))
  return { path: "/search/geocoding/v6/reverse", query }
}

export function toMapboxSearchRequest(input: unknown): TranslatedGeocodeRequest {
  const parsed = SearchInputSchema.safeParse(input)
  if (!parsed.success) invalid("search", parsed.error)
  const query = new URLSearchParams()
  query.set("q", parsed.data.query)
  query.set("limit", String(parsed.data.limit ?? 5))
  if (parsed.data.longitude !== undefined && parsed.data.latitude !== undefined) {
    query.set("ars", `${parsed.data.longitude},${parsed.data.latitude}`)
  }
  if (parsed.data.types?.length) query.set("types", parsed.data.types.join(","))
  if (parsed.data.bbox) query.set("bbox", parsed.data.bbox.join(","))
  if (parsed.data.country) query.set("country", parsed.data.country)
  if (parsed.data.language) query.set("language", parsed.data.language)
  return { path: "/search/v6/mapbox", query }
}

export function toMapboxPlaceDetailsRequest(input: unknown): TranslatedGeocodeRequest {
  const parsed = PlaceDetailsInputSchema.safeParse(input)
  if (!parsed.success) invalid("placeDetails", parsed.error)
  const query = new URLSearchParams()
  query.set("poi.id", encodedSegment(parsed.data.poiId, 64))
  query.set("limit", "1")
  if (parsed.data.longitude !== undefined && parsed.data.latitude !== undefined) {
    query.set("ars", `${parsed.data.longitude},${parsed.data.latitude}`)
  }
  if (parsed.data.language) query.set("language", parsed.data.language)
  return { path: "/search/v6/mapbox", query }
}

// ─── routing family: isochrone / directions / matrix ───────────────────────

const MAPBOX_PROFILES = ["driving", "driving-traffic", "walking", "cycling"] as const
const IsochroneProfileSchema = z.enum(["driving", "walking", "cycling"])
const DirectionsProfileSchema = z.enum(MAPBOX_PROFILES)
const MatrixProfileSchema = z.enum(["driving", "walking"])

export const IsochroneInputSchema = z
  .object({
    coordinates: LonLatSchema,
    profile: IsochroneProfileSchema.default("driving"),
    /** Minutes reachable — 1..240 each, max 6 breakpoints. */
    minutes: z.array(z.number().int().min(1).max(240)).min(1).max(6).optional(),
  })
  .strict()

export const DirectionsInputSchema = z
  .object({
    /** Ordered [longitude, latitude] waypoints — 2..6. */
    coordinates: z.array(LonLatSchema).min(2).max(6),
    profile: DirectionsProfileSchema.default("driving"),
    alternatives: z.boolean().optional(),
  })
  .strict()

export const MatrixInputSchema = z
  .object({
    /** Ordered [longitude, latitude] points — 2..5 (playground-sized cap). */
    coordinates: z.array(LonLatSchema).min(2).max(5),
    profile: MatrixProfileSchema.default("driving"),
    distribution: z.enum(["measured", "distributed"]).default("measured"),
  })
  .strict()

export type IsochroneInput = z.infer<typeof IsochroneInputSchema>
export type DirectionsInput = z.infer<typeof DirectionsInputSchema>
export type MatrixInput = z.infer<typeof MatrixInputSchema>

export function toMapboxIsochroneRequest(input: unknown): TranslatedGeocodeRequest {
  const parsed = IsochroneInputSchema.safeParse(input)
  if (!parsed.success) invalid("isochrone", parsed.error)
  const query = new URLSearchParams()
  query.set("contours_minutes", String(parsed.data.minutes?.join(",") ?? "10,20,30"))
  return {
    path: `/isochrone/v1/${parsed.data.profile}/${parsed.data.coordinates[0]},${parsed.data.coordinates[1]}`,
    query,
  }
}

export function toMapboxDirectionsRequest(input: unknown): TranslatedGeocodeRequest {
  const parsed = DirectionsInputSchema.safeParse(input)
  if (!parsed.success) invalid("directions", parsed.error)
  const query = new URLSearchParams()
  if (parsed.data.alternatives) query.set("alternatives", String(parsed.data.coordinates.length))
  return {
    path: `/directions/v5/mapbox/${parsed.data.profile}/${encodedSegment(formatCoordinates(parsed.data.coordinates), 256, ".,;")}`,
    query,
  }
}

export function toMapboxMatrixRequest(input: unknown): TranslatedGeocodeRequest {
  const parsed = MatrixInputSchema.safeParse(input)
  if (!parsed.success) invalid("matrix", parsed.error)
  const query = new URLSearchParams()
  query.set("profile", `mapbox/${parsed.data.profile}`)
  query.set("coordinates", formatCoordinates(parsed.data.coordinates))
  query.set("distribution", parsed.data.distribution)
  return { path: "/matrix/v1", query, postForm: true }
}

// ─── tilesMetadata / styleSchema ────────────────────────────────────────────

export const TilesInputSchema = z
  .object({
    kind: z.enum(["vector", "raster-dem", "raster-array"]).default("vector"),
    styleId: z.string().regex(/^[A-Za-z0-9._@-]{1,128}$/, "styleId must be a Mapbox style id"),
    z: z.number().int().min(0).max(22),
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    /** Ask Mapbox for @2x instead of @1x (vector/raster-array). */
    retina: z.boolean().optional(),
  })
  .strict()
  .refine((d) => d.x >= 0 && d.x < 2 ** d.z && d.y >= 0 && d.y < 2 ** d.z, {
    message: "x/y must be valid tile indices for zoom z (0 ≤ x,y < 2^z)",
  })

export const StyleSchemaInputSchema = z
  .object({
    /** Mapbox owner — "mapbox" for official styles, or your username. */
    username: z.string().regex(/^[A-Za-z0-9._@-]{1,64}$/, "username must be a Mapbox account name"),
    styleId: z.string().regex(/^[A-Za-z0-9._@-]{1,128}$/, "styleId must be a Mapbox style id"),
  })
  .strict()

export type TilesInput = z.infer<typeof TilesInputSchema>
export type StyleSchemaInput = z.infer<typeof StyleSchemaInputSchema>

export function toMapboxTilesRequest(input: unknown): TranslatedGeocodeRequest {
  const parsed = TilesInputSchema.safeParse(input)
  if (!parsed.success) invalid("tilesMetadata", parsed.error)
  const { kind, styleId, z, x, y } = parsed.data
  const scale = parsed.data.retina ? "@2x" : ""
  const ext = kind === "vector" ? "mvt" : kind === "raster-dem" ? "png" : "webp"
  const path =
    kind === "raster-dem"
      ? `/v4/${encodedSegment(styleId, 128)}/${z}/${x}/${y}.${ext}`
      : `/v4/${encodedSegment(styleId, 128)}/${z}/${x}/${y}${scale}.${ext}`
  // Tile bodies are binary (mvt/png/webp) — return reachability metadata,
  // never parse the tile content.
  return { path, query: new URLSearchParams(), binary: true }
}

export function toMapboxStyleSchemaRequest(input: unknown): TranslatedGeocodeRequest {
  const parsed = StyleSchemaInputSchema.safeParse(input)
  if (!parsed.success) invalid("styleSchema", parsed.error)
  return {
    path: `/styles/v1/${encodedSegment(parsed.data.username, 64)}/${encodedSegment(parsed.data.styleId, 128)}`,
    query: new URLSearchParams(),
  }
}

// ─── staticImage ────────────────────────────────────────────────────────────

export const StaticImageInputSchema = z
  .object({
    longitude: z.number().min(-180).max(180),
    latitude: z.number().min(-90).max(90),
    zoom: z.number().min(0).max(22).default(12),
    width: z.number().int().min(2).max(1280).default(600),
    height: z.number().int().min(2).max(1280).default(400),
    styleId: z.string().regex(/^[A-Za-z0-9._@-]{1,128}$/, "styleId must be a Mapbox style id").optional(),
    /** Single marker pin at the center. */
    marker: z.boolean().optional(),
  })
  .strict()

export type StaticImageInput = z.infer<typeof StaticImageInputSchema>

export function toMapboxStaticImageRequest(input: unknown): TranslatedGeocodeRequest {
  const parsed = StaticImageInputSchema.safeParse(input)
  if (!parsed.success) invalid("staticImage", parsed.error)
  const d = parsed.data
  // "owner/style-id" style references validate as two path segments.
  const styleRef = d.styleId ?? "mapbox/streets-v12"
  const [owner, ...rest] = styleRef.split("/")
  const style = `${encodedSegment(owner ?? "mapbox", 64)}/${encodedSegment(rest.join("/"), 128)}`
  const pos = `${d.longitude},${d.latitude},${d.zoom}`
  const overlay = d.marker
    ? `/pin-l-circle-stroked-blue(${d.longitude},${d.latitude})`
    : ""
  return {
    path: `/styles/v1/${style}/static/${pos}/${d.width}x${d.height}${overlay}/`,
    query: new URLSearchParams(),
    binary: true,
  }
}

// ─── tokens ─────────────────────────────────────────────────────────────────

export const TokensInputSchema = z
  .object({
    searchable: z.boolean().optional(),
  })
  .strict()

export function toMapboxTokensRequest(input: unknown): TranslatedGeocodeRequest {
  const parsed = TokensInputSchema.safeParse(input ?? {})
  if (!parsed.success) invalid("tokens", parsed.error)
  const query = new URLSearchParams()
  if (parsed.data.searchable !== undefined) query.set("searchable", String(parsed.data.searchable))
  return { path: "/tokens", query }
}

// ─── response normalizers ───────────────────────────────────────────────────

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

export function toMapsDiagnosticResult(
  operation: string,
  payload: unknown,
): ProviderExecutionResponse<MapsDiagnosticResult> {
  return { provider: "mapbox", data: { operation, payload } }
}

/**
 * Binary endpoint result (static map PNG, tile mvt/webp): metadata always;
 * for images small enough, an inline data URL so the playground can render
 * the map without a second endpoint. Size-capped by the shared fetch layer
 * (8MB) and further capped here before base64.
 */
export function toBinaryMetadataResult(
  operation: "staticImage" | "tilesMetadata",
  bytes: ArrayBuffer,
  contentType: string,
): ProviderExecutionResponse<MapsDiagnosticResult> {
  const MAX_INLINE_BYTES = 2 * 1024 * 1024
  const inlineable = operation === "staticImage" && bytes.byteLength <= MAX_INLINE_BYTES
  const payload: Record<string, unknown> = {
    contentType,
    byteLength: bytes.byteLength,
    reachable: true,
    ...(inlineable
      ? { dataUrl: `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}` }
      : operation === "staticImage"
        ? { note: "Image too large to inline; metadata only." }
        : {}),
  }
  return { provider: "mapbox", data: { operation, payload } }
}
