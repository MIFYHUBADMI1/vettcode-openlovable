/**
 * Atai SDK — Maps capability.
 *
 * Provider-neutral geolocation (`maps`/`geocode`, `maps`/`reverseGeocode`). The application
 * never learns which maps provider Atai operates behind the runtime.
 *
 * @module capabilities/maps
 */

import { AtaiError } from "../errors.js"
import { execute } from "../transport.js"
import type { ResolvedConfig } from "../config.js"
import type {
  AtaiRequestOptions,
  MapsGeocodeInput,
  MapsReverseGeocodeInput,
  MapsResult,
} from "../types.js"

/** Client-side validation (developer experience only; the server is authoritative). */
function validateGeocodeInput(input: MapsGeocodeInput): void {
  if (input === null || typeof input !== "object") {
    throw new AtaiError("atai_invalid_request", "Geocode input must be an object with a `query` string.")
  }
  if (typeof input.query !== "string" || input.query.length === 0 || input.query.length > 200) {
    throw new AtaiError("atai_invalid_request", "Geocode requires a `query` between 1 and 200 characters.")
  }
}

function validateReverseGeocodeInput(input: MapsReverseGeocodeInput): void {
  if (input === null || typeof input !== "object") {
    throw new AtaiError("atai_invalid_request", "Reverse geocode input must be an object with `longitude` and `latitude`.")
  }
  if (typeof input.longitude !== "number" || typeof input.latitude !== "number") {
    throw new AtaiError("atai_invalid_request", "Reverse geocode requires numeric `longitude` and `latitude`.")
  }
}

/** The Atai maps capability. Exposed as `atai.maps` on the client. */
export class MapsCapability {
  constructor(private readonly config: ResolvedConfig) {}

  /** Geocode an address/place name (`maps`/`geocode`). */
  async geocode(input: MapsGeocodeInput, options?: AtaiRequestOptions): Promise<MapsResult> {
    validateGeocodeInput(input)

    const body = {
      capability: "maps",
      operation: "geocode",
      input: {
        query: input.query,
        ...(input.limit !== undefined ? { limit: input.limit } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.language !== undefined ? { language: input.language } : {}),
      },
    }

    const { envelope } = await execute<typeof body, MapsResult>(this.config, {
      path: "",
      method: "POST",
      body,
      options,
    })

    return assertMapsResult(envelope.data.data)
  }

  /** Reverse geocode coordinates (`maps`/`reverseGeocode`). */
  async reverseGeocode(input: MapsReverseGeocodeInput, options?: AtaiRequestOptions): Promise<MapsResult> {
    validateReverseGeocodeInput(input)

    const body = {
      capability: "maps",
      operation: "reverseGeocode",
      input: {
        longitude: input.longitude,
        latitude: input.latitude,
        ...(input.limit !== undefined ? { limit: input.limit } : {}),
      },
    }

    const { envelope } = await execute<typeof body, MapsResult>(this.config, {
      path: "",
      method: "POST",
      body,
      options,
    })

    return assertMapsResult(envelope.data.data)
  }
}

/** Narrow runtime check on the returned payload (server responses are never trusted blindly). */
function assertMapsResult(payload: unknown): MapsResult {
  if (typeof payload !== "object" || payload === null || !Array.isArray((payload as Record<string, unknown>).results)) {
    throw new AtaiError("atai_invalid_response", "The Atai Runtime API returned an unexpected response shape.")
  }
  return payload as unknown as MapsResult
}
