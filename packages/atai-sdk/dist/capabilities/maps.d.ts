/**
 * Atai SDK — Maps capability.
 *
 * Provider-neutral geolocation (`maps`/`geocode`, `maps`/`reverseGeocode`). The application
 * never learns which maps provider Atai operates behind the runtime.
 *
 * @module capabilities/maps
 */
import type { ResolvedConfig } from "../config.js";
import type { AtaiRequestOptions, MapsGeocodeInput, MapsReverseGeocodeInput, MapsResult } from "../types.js";
/** The Atai maps capability. Exposed as `atai.maps` on the client. */
export declare class MapsCapability {
    private readonly config;
    constructor(config: ResolvedConfig);
    /** Geocode an address/place name (`maps`/`geocode`). */
    geocode(input: MapsGeocodeInput, options?: AtaiRequestOptions): Promise<MapsResult>;
    /** Reverse geocode coordinates (`maps`/`reverseGeocode`). */
    reverseGeocode(input: MapsReverseGeocodeInput, options?: AtaiRequestOptions): Promise<MapsResult>;
}
//# sourceMappingURL=maps.d.ts.map