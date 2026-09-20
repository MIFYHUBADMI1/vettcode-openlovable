import "server-only"
import { totalumAdapter } from "./adapter"
import { registerProviderAdapter } from "@/lib/runtime/router/provider-registry"

/**
 * Atai Runtime — Totalum adapter barrel (server-only).
 *
 * Registration into the Phase 5 provider registry is OPT-IN (mirrors the
 * other Phase 10 adapters).
 *
 * @module lib/runtime/router/adapters/totalum
 */

export { totalumAdapter, TOTALUM_PROVIDER_ID } from "./adapter"
export { isTotalumRuntimeConfigured } from "./config"
export { DbQueryInputSchema, DbCreateInputSchema, DbEditInputSchema, DbDeleteInputSchema } from "./mapper"
export type { DbQueryResultData, DbRecordResultData, DbDeleteResultData } from "./mapper"

/** Register Totalum as the provider for its capability+operations. */
export function registerTotalumAdapter(): void {
  registerProviderAdapter(totalumAdapter)
}
