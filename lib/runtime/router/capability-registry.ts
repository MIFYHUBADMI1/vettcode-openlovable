import "server-only"
import {
  CAPABILITY_OPERATIONS,
  ROUTE_CAPABILITY_IDS,
} from "@/runtime/contracts/router"

/**
 * Atai Runtime — capability registry (server-only).
 *
 * Describes WHAT the Runtime API can route: which capabilities exist and
 * which provider-neutral operations each exposes. The router orchestrates;
 * this registry describes (Phase 5 §33) — no giant switch statements.
 *
 * A capability existing here does NOT mean a provider implements it — that
 * question is answered by the provider registry. New capabilities join by
 * extending CAPABILITY_OPERATIONS, without touching router logic.
 *
 * @module lib/runtime/router/capability-registry
 */

export interface CapabilityDefinition {
  readonly id: string
  /**
   * Provider-neutral operations this capability exposes. Typed as strings so
   * the test capability ("echo") can coexist with the RuntimeOperation
   * vocabulary — real adapters still consume the typed union.
   */
  readonly operations: readonly string[]
}

/** All registered capability definitions (snapshot, read-only). */
export function listCapabilities(): readonly CapabilityDefinition[] {
  return ROUTE_CAPABILITY_IDS.map((id) => ({
    id,
    operations: CAPABILITY_OPERATIONS[id] as readonly string[],
  }))
}

/** Does the registry know this capability at all? */
export function hasCapability(capability: string): boolean {
  return capability in CAPABILITY_OPERATIONS
}

/** Get one capability's definition (null when unknown). */
export function getCapability(capability: string): CapabilityDefinition | null {
  if (!hasCapability(capability)) return null
  return { id: capability, operations: CAPABILITY_OPERATIONS[capability] as readonly string[] }
}

/** Does this capability expose this provider-neutral operation? */
export function hasOperation(capability: string, operation: string): boolean {
  return getCapability(capability)?.operations.includes(operation) ?? false
}

/**
 * The scope a runtime request requires. Today: capability ID == scope ID
 * (Phase 2 contract: a scope equals a capability). Kept as a function so a
 * future capability→scope mapping can evolve without touching the router.
 */
export function requiredScopeFor(capability: string): string {
  return capability
}
