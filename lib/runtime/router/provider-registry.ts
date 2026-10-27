import "server-only"
import type { RuntimeProviderAdapter } from "./adapter"

/**
 * Atai Runtime — provider adapter registry (server-only).
 *
 * Answers exactly one question (Phase 5 §13): "which adapter supports this
 * capability + operation?" The router contains no provider logic and no
 * if(provider === ...) branches — resolution is data-driven from whatever
 * adapters are registered here.
 *
 * PHASE 5 STATE: NO production adapters are registered. Phase 6 registers
 * the first (OpenRouter) with one line — no router changes.
 *
 * @module lib/runtime/router/provider-registry
 */

/** Registered adapters in insertion order (registration order = deterministic). */
const adapters: RuntimeProviderAdapter[] = []

/**
 * Adapter INSTANCE identity already registered. Registration is invoked from
 * several module graphs (runtime route, admin routes, availability), and a
 * bundle that instantiates those modules twice re-runs their idempotence
 * guards independently — instance identity is the one stable key, so a
 * repeated registration becomes a no-op instead of a duplicate entry.
 */
const seen = new Set<RuntimeProviderAdapter>()

/**
 * Register a provider adapter. Duplicate (capability+operation) coverage is
 * resolved deterministically: the FIRST registered adapter wins. Registering
 * the SAME adapter instance again is a no-op. Later policy layers
 * (environment/entitlement-aware selection, Phase 9+) can wrap this
 * resolution without changing the router.
 */
export function registerProviderAdapter(adapter: RuntimeProviderAdapter): void {
  if (seen.has(adapter)) return
  seen.add(adapter)
  adapters.push(adapter)
}

/**
 * Resolve the adapter for a capability+operation. Deterministic: first
 * registered adapter whose supports() matches. Null when none — the router
 * maps that to runtime_capability_unavailable.
 */
export function resolveProviderAdapter(
  capability: string,
  operation: string,
): RuntimeProviderAdapter | null {
  for (const adapter of adapters) {
    if (adapter.supports(capability, operation)) return adapter
  }
  return null
}

/**
 * ALL registered adapters serving a capability+operation, in registration
 * order (primary first, fallbacks after). The router tries them in order so
 * a provider-side fault falls through to the next candidate — still fully
 * data-driven (no provider names in the router).
 */
export function resolveProviderAdapters(
  capability: string,
  operation: string,
): RuntimeProviderAdapter[] {
  return adapters.filter((adapter) => adapter.supports(capability, operation))
}

/** Snapshot of registered providers (safe metadata — unique names only). */
export function listProviders(): readonly string[] {
  return [...new Set(adapters.map((a) => a.provider))]
}

/** Test-only: clear all registrations (registry tests use this). */
export function clearProviderAdapters(): void {
  adapters.length = 0
  seen.clear()
}
