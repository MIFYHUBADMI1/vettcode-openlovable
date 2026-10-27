import "server-only"
import { ProviderNotConfiguredError } from "../shared/errors"
import { boundedTimeoutMs } from "../shared/http"

/**
 * Atai Runtime — Supabase adapter configuration (server-only).
 *
 * ONE controlled access point for the Supabase project URL and server key.
 * The key NEVER appears in RuntimeAuthContext, RuntimeRequest,
 * RuntimeResponse, logs, or database documents — callers provide only the
 * runtime operation payload allowed by the contract.
 *
 * @module lib/runtime/router/adapters/supabase/config
 */

export const DEFAULT_SUPABASE_TIMEOUT_MS = 20_000

export function getSupabaseUrl(): string {
  const raw = process.env.SUPABASE_URL
  if (!raw) throw new ProviderNotConfiguredError("supabase")
  const trimmed = raw.trim().replace(/\/+$/, "")
  if (!/^https?:\/\//i.test(trimmed)) throw new ProviderNotConfiguredError("supabase")
  return trimmed
}

/** Server-only key. Supabase accepts it in the documented `apikey` header. */
export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new ProviderNotConfiguredError("supabase")
  return key
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export function getSupabaseTimeoutMs(): number {
  return boundedTimeoutMs(process.env.SUPABASE_TIMEOUT_MS, DEFAULT_SUPABASE_TIMEOUT_MS)
}
