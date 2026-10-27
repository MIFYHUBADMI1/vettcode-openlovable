import "server-only"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import type { ProviderExecutionResponse } from "@/runtime/contracts/router"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"

/**
 * Atai Runtime — Mapbox request/response mapper (server-only).
 *
 * Maps provider-neutral `maps` operations onto the Mapbox API surface for
 * playground/runtime testing: Search Box text search / place retrieval, the v6
 * geocoding pair (forward + reverse), routing (isochrone/directions/matrix),
 * vector-tile and style metadata, and static images. Every operation keeps the
 * §16 invariants: strict input schemas (unknown fields rejected, never
 * forwarded), a fixed set of reachable endpoint paths (constructed here —
 * caller strings are length/charset bounded and URL-encoded), and the access
 * token appended server-side only.
 *
 * Path/parameter forms below were verified against the live API, including
 * where Mapbox 404s: geocoding is `/search/geocode/v6/*`, Search Box is
 * `/search/searchbox/v1/*`, routing profiles are path-prefixed `mapbox/`,
 * Matrix is `/directions-matrix/v1/*`, and static-image overlays precede the
 * position segment.
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

/** Mapbox static overlay colours: bare 6-digit hex, no '#'. */
const HexColorSchema = z.string().regex(/^[0-9a-fA-F]{6}$/, "colour must be 6-digit hex without #")

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
    /** Mapbox feature id (`mapbox_id`) returned by search / geocode. */
    poiId: z.string().regex(/^[A-Za-z0-9._:@-]{1,512}$/, "poiId must be a Mapbox feature id"),
    /**
     * Search Box session token. `retrieve` requires one; the contract has no
     * autocomplete flow to supply it, so one is minted server-side when the
     * caller does not provide it.
     */
    sessionToken: z.string().min(8).max(128).optional(),
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
  /** Set when the response body is binary (static maps PNG, vector tiles). */
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
  return { path: "/search/geocode/v6/forward", query }
}

export function toMapboxReverseGeocodeRequest(input: unknown): TranslatedGeocodeRequest {
  const parsed = ReverseGeocodeInputSchema.safeParse(input)
  if (!parsed.success) invalid("reverseGeocode", parsed.error)
  const query = new URLSearchParams()
  query.set("longitude", String(parsed.data.longitude))
  query.set("latitude", String(parsed.data.latitude))
  query.set("limit", String(parsed.data.limit ?? 1))
  return { path: "/search/geocode/v6/reverse", query }
}

export function toMapboxSearchRequest(input: unknown): TranslatedGeocodeRequest {
  const parsed = SearchInputSchema.safeParse(input)
  if (!parsed.success) invalid("search", parsed.error)
  const query = new URLSearchParams()
  query.set("q", parsed.data.query)
  query.set("limit", String(parsed.data.limit ?? 5))
  // Search Box biases with `proximity` (lng,lat) — it ignores `ars`, which is
  // a Geocoding v6 parameter.
  if (parsed.data.longitude !== undefined && parsed.data.latitude !== undefined) {
    query.set("proximity", `${parsed.data.longitude},${parsed.data.latitude}`)
  }
  if (parsed.data.types?.length) query.set("types", parsed.data.types.join(","))
  if (parsed.data.bbox) query.set("bbox", parsed.data.bbox.join(","))
  if (parsed.data.country) query.set("country", parsed.data.country)
  if (parsed.data.language) query.set("language", parsed.data.language)
  return { path: "/search/searchbox/v1/forward", query }
}

export function toMapboxPlaceDetailsRequest(input: unknown): TranslatedGeocodeRequest {
  const parsed = PlaceDetailsInputSchema.safeParse(input)
  if (!parsed.success) invalid("placeDetails", parsed.error)
  const query = new URLSearchParams()
  // Search Box `retrieve` refuses the call without a session token; the
  // contract has no autocomplete session, so one is minted per request.
  query.set("session_token", parsed.data.sessionToken ?? randomUUID())
  if (parsed.data.language) query.set("language", parsed.data.language)
  return {
    path: `/search/searchbox/v1/retrieve/${encodedSegment(parsed.data.poiId, 512, ":")}`,
    query,
  }
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
    /** Which value matrices Mapbox returns alongside durations. */
    annotations: z.array(z.enum(["duration", "distance"])).max(2).optional(),
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
    // Mapbox paths the profile as `mapbox/{profile}` — a bare profile 404s.
    path: `/isochrone/v1/mapbox/${parsed.data.profile}/${parsed.data.coordinates[0]},${parsed.data.coordinates[1]}`,
    query,
  }
}

export function toMapboxDirectionsRequest(input: unknown): TranslatedGeocodeRequest {
  const parsed = DirectionsInputSchema.safeParse(input)
  if (!parsed.success) invalid("directions", parsed.error)
  const query = new URLSearchParams()
  if (parsed.data.alternatives) query.set("alternatives", String(parsed.data.coordinates.length))
  // Default geometry is an encoded polyline; GeoJSON coordinates are what a
  // caller (or the playground map) can actually draw.
  query.set("geometries", "geojson")
  return {
    path: `/directions/v5/mapbox/${parsed.data.profile}/${encodedSegment(formatCoordinates(parsed.data.coordinates), 256, ".,;")}`,
    query,
  }
}

export function toMapboxMatrixRequest(input: unknown): TranslatedGeocodeRequest {
  const parsed = MatrixInputSchema.safeParse(input)
  if (!parsed.success) invalid("matrix", parsed.error)
  const query = new URLSearchParams()
  if (parsed.data.annotations?.length) query.set("annotations", parsed.data.annotations.join(","))
  // The legacy POST /matrix/v1 is retired (403) — Matrix is path-addressed now.
  return {
    path: `/directions-matrix/v1/mapbox/${parsed.data.profile}/${encodedSegment(formatCoordinates(parsed.data.coordinates), 256, ".,;")}`,
    query,
  }
}

// ─── tilesMetadata / styleSchema ────────────────────────────────────────────

export const TilesInputSchema = z
  .object({
    /**
     * Mapbox TILESET id (`/v4/{tilesetId}/{z}/{x}/{y}.mvt`) — not a style id:
     * a style id here is a 404/422 from the tiles API.
     */
    tilesetId: z.string().regex(/^[A-Za-z0-9._@-]{1,128}$/, "tilesetId must be a Mapbox tileset id"),
    z: z.number().int().min(0).max(22),
    x: z.number().int().min(0),
    y: z.number().int().min(0),
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
  const { tilesetId, z, x, y } = parsed.data
  // Tile bodies are binary (mvt) — return reachability metadata,
  // never parse the tile content.
  return {
    path: `/v4/${encodedSegment(tilesetId, 128)}/${z}/${x}/${y}.mvt`,
    query: new URLSearchParams(),
    binary: true,
  }
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
    /** Image centre. Required unless `fit` frames the overlay instead. */
    longitude: z.number().min(-180).max(180).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    zoom: z.number().min(0).max(22).default(12),
    width: z.number().int().min(2).max(1280).default(600),
    height: z.number().int().min(2).max(1280).default(400),
    styleId: z.string().regex(/^[A-Za-z0-9._@-]{1,128}$/, "styleId must be a Mapbox style id").optional(),
    /** Single pin at the centre. */
    marker: z.boolean().optional(),
    markerSize: z.enum(["s", "m", "l"]).default("m"),
    markerColor: HexColorSchema.default("0f6bd3"),
    /**
     * One polyline — a route geometry, an isochrone contour ring, or any path
     * the caller holds. Mapbox draws exactly ONE overlay per static image, so
     * `path` and `marker` are mutually exclusive.
     */
    path: z.array(LonLatSchema).min(2).max(600).optional(),
    pathColor: HexColorSchema.default("00b0ff"),
    pathWidth: z.number().int().min(1).max(20).default(6),
    /** Frame the overlay automatically instead of centre + zoom. */
    fit: z.boolean().optional(),
    /** Retina (2x) render — doubles pixel size and payload. */
    retina: z.boolean().optional(),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (d.marker && d.path) {
      ctx.addIssue({
        code: "custom",
        message: "Mapbox renders one overlay per static image — send either marker or path, not both",
        path: ["marker"],
      })
    }
    if (d.marker && (d.longitude === undefined || d.latitude === undefined)) {
      ctx.addIssue({
        code: "custom",
        message: "longitude/latitude are required when marker is set — the pin is placed there",
        path: ["longitude"],
      })
    }
    if (!d.fit && !d.marker && (d.longitude === undefined || d.latitude === undefined)) {
      ctx.addIssue({
        code: "custom",
        message: "set longitude/latitude, or fit:true to frame the overlay",
        path: ["longitude"],
      })
    }
  })

export type StaticImageInput = z.infer<typeof StaticImageInputSchema>

/** Mapbox 414s past ~6.5k chars; 200 five-decimal points stays well inside. */
const MAX_STATIC_PATH_POINTS = 200

/** Even-stride thinning that always keeps the first and last point. */
function downsamplePath(coords: readonly (readonly number[])[]): string {
  // Reserve one slot for the exact endpoint so the cap is never exceeded.
  const step = Math.max(1, Math.ceil(coords.length / (MAX_STATIC_PATH_POINTS - 1)))
  const kept: string[] = []
  for (let i = 0; i < coords.length; i += step) {
    const [lng, lat] = coords[i]
    kept.push(`${fmtStaticCoord(lng)},${fmtStaticCoord(lat)}`)
  }
  const last = coords[coords.length - 1]
  const lastKey = `${fmtStaticCoord(last[0])},${fmtStaticCoord(last[1])}`
  if (kept[kept.length - 1] !== lastKey) kept.push(lastKey)
  return kept.join(",")
}

function fmtStaticCoord(value: number): string {
  return value.toFixed(5)
}

export function toMapboxStaticImageRequest(input: unknown): TranslatedGeocodeRequest {
  const parsed = StaticImageInputSchema.safeParse(input)
  if (!parsed.success) invalid("staticImage", parsed.error)
  const d = parsed.data
  // "owner/style-id" style references validate as two path segments.
  const styleRef = d.styleId ?? "mapbox/streets-v12"
  const [owner, ...rest] = styleRef.split("/")
  const style = `${encodedSegment(owner ?? "mapbox", 64)}/${encodedSegment(rest.join("/"), 128)}`
  // Overlays come BEFORE the position in the v1 static path. Live-verified
  // forms: `pin-{s|m|l}+{rrggbb}(lng,lat)` and `path-{w}+{rrggbb}(lng,lat,…)`.
  // Labelled pins (`pin-m-A+…`) and stroke variants (`…-ffffff+4`) are rejected.
  const overlay = d.path
    ? `/path-${d.pathWidth}+${d.pathColor}(${downsamplePath(d.path)})`
    : d.marker
      ? `/pin-${d.markerSize}+${d.markerColor}(${fmtStaticCoord(d.longitude ?? 0)},${fmtStaticCoord(d.latitude ?? 0)})`
      : ""
  const position =
    d.fit || d.longitude === undefined || d.latitude === undefined
      ? "auto"
      : `${d.longitude},${d.latitude},${d.zoom}`
  return {
    path: `/styles/v1/${style}/static${overlay}/${position}/${d.width}x${d.height}${d.retina ? "@2x" : ""}`,
    query: new URLSearchParams(),
    binary: true,
  }
}

// ─── response normalizers ───────────────────────────────────────────────────

/**
 * Documented Mapbox GeoJSON response (v6 geocoding + Search Box, defensive
 * subset). Both APIs carry the descriptive fields inside `feature.properties`
 * — top-level `name`/`coordinates` do not exist on the real payloads, and
 * Search Box features have no top-level `id` at all (the id is
 * `properties.mapbox_id`).
 */
interface MapboxFeature {
  id?: unknown
  geometry?: { coordinates?: unknown }
  properties?: {
    mapbox_id?: unknown
    name?: unknown
    name_preferred?: unknown
    full_address?: unknown
    place_formatted?: unknown
    coordinates?: { longitude?: unknown; latitude?: unknown }
  }
}

export interface MapboxGeocodeResponse {
  features?: MapboxFeature[]
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function coordinatePair(raw: unknown): [number, number] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null
  const lng = raw[0]
  const lat = raw[1]
  if (typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat)) return null
  return [lng, lat]
}

/** longitude/latitude pair from either carrier shape Mapbox uses. */
function featureCoordinates(feature: MapboxFeature | undefined): [number, number] | null {
  const props = feature?.properties?.coordinates
  if (typeof props?.longitude === "number" && typeof props?.latitude === "number") {
    if (Number.isFinite(props.longitude) && Number.isFinite(props.latitude)) {
      return [props.longitude, props.latitude]
    }
  }
  return coordinatePair(feature?.geometry?.coordinates)
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
    const coords = featureCoordinates(f)
    if (!coords) continue
    const id = stringValue(f?.properties?.mapbox_id) ?? stringValue(f?.id)
    const name =
      stringValue(f?.properties?.name) ??
      stringValue(f?.properties?.name_preferred) ??
      stringValue(f?.properties?.place_formatted)
    if (!id || !name) continue
    const address = stringValue(f?.properties?.full_address) ?? stringValue(f?.properties?.place_formatted)
    results.push({
      id,
      name,
      ...(address ? { formattedAddress: address } : {}),
      longitude: coords[0],
      latitude: coords[1],
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
