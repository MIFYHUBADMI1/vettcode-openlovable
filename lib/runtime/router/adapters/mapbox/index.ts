import "server-only"
import { mapboxAdapter } from "./adapter"
import { registerProviderAdapter } from "@/lib/runtime/router/provider-registry"

/**
 * Atai Runtime — Mapbox adapter barrel (server-only).
 *
 * @module lib/runtime/router/adapters/mapbox
 */

export { mapboxAdapter, MAPBOX_PROVIDER_ID } from "./adapter"
export { isMapboxConfigured } from "./config"
export {
  GeocodeInputSchema,
  ReverseGeocodeInputSchema,
  SearchInputSchema,
  PlaceDetailsInputSchema,
  IsochroneInputSchema,
  DirectionsInputSchema,
  MatrixInputSchema,
  TilesInputSchema,
  StyleSchemaInputSchema,
  StaticImageInputSchema,
  TokensInputSchema,
} from "./mapper"
export type { MapsResultData, MapsDiagnosticResult, PlaceResultItem } from "./mapper"

/** Register Mapbox as the provider for its capability+operation pairs. */
export function registerMapboxAdapter(): void {
  registerProviderAdapter(mapboxAdapter)
}
