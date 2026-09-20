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
 * Register a provider adapter. Duplicate (capability+operation) coverage is
 * resolved deterministically: the FIRST registered adapter wins. Later
 * policy layers (environment/entitlement-aware selection, Phase 9+) can wrap
 * this resolution without changing the router.
 */
export function registerProviderAdapter(adapter: RuntimeProviderAdapter): void {
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

/** Snapshot of registered providers (safe metadata — names only). */
export function listProviders(): readonly string[] {
  return adapters.map((a) => a.provider)
}

/** Test-only: clear all registrations (registry tests use this). */
export function clearProviderAdapters(): void {
  adapters.length = 0
}
