import "server-only"
import { calComAdapter } from "./adapter"
import { registerProviderAdapter } from "@/lib/runtime/router/provider-registry"

/**
 * Atai Runtime — Cal.com adapter barrel (server-only).
 *
 * Registration into the Phase 5 provider registry is OPT-IN: importing this
 * module does NOT mutate global registry state. The runtime route module
 * calls registerCalComAdapter() once at startup (mirrors the other Phase 10
 * adapters).
 *
 * @module lib/runtime/router/adapters/calcom
 */

export { calComAdapter, CALCOM_PROVIDER_ID } from "./adapter"
export { isCalComConfigured } from "./config"
export { CreateBookingInputSchema, ListBookingsInputSchema } from "./mapper"
export type { CreateBookingResultData, ListBookingsResultData } from "./mapper"

/** Register Cal.com as the provider for its capability+operations. */
export function registerCalComAdapter(): void {
  registerProviderAdapter(calComAdapter)
}
