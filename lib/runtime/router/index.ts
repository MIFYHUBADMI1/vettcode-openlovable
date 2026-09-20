/**
 * Atai Runtime — router module barrel (server-only).
 *
 * @module lib/runtime/router
 */

export { RoutingError, routingFailureToAppError, parseRuntimeRequest } from "./router"
export type { RoutingFailureReason } from "./router"
export { routeRuntimeRequest } from "./router"
export {
  listCapabilities,
  getCapability,
  hasCapability,
  hasOperation,
  requiredScopeFor,
} from "./capability-registry"
export {
  registerProviderAdapter,
  resolveProviderAdapter,
  listProviders,
  clearProviderAdapters,
} from "./provider-registry"
export {
  ProviderExecutionError,
  providerFailureToRuntimeError,
} from "./adapter"
export type { RuntimeProviderAdapter } from "./adapter"
export type { NormalizedProviderUsage } from "@/runtime/contracts/router"
