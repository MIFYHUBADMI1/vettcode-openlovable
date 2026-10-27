import "server-only"
import { supabaseAdapter } from "./adapter"
import { registerProviderAdapter } from "@/lib/runtime/router/provider-registry"

/**
 * Atai Runtime — Supabase adapter barrel (server-only).
 *
 * @module lib/runtime/router/adapters/supabase
 */

export { supabaseAdapter, SUPABASE_PROVIDER_ID } from "./adapter"
export { isSupabaseConfigured } from "./config"
export { NotificationSendInputSchema, scopedChannel } from "./mapper"
export type { NotificationSendResultData } from "./mapper"

/** Register Supabase as the provider for its capability+operation. */
export function registerSupabaseAdapter(): void {
  registerProviderAdapter(supabaseAdapter)
}
