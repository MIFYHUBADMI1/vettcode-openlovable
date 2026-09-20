import "server-only"
import { runtimeError } from "@/runtime/contracts/errors"
import type { CapabilityScope } from "@/runtime/contracts/capabilities"

/**
 * Atai Runtime — scope authorization primitives (server-only).
 *
 * AUTHENTICATION ≠ AUTHORIZATION (Phase 4 §17): authenticateRuntimeRequest
 * establishes WHO the key is (userId/projectId/environment/scopes); these
 * helpers determine WHAT the key may do. Runtime handlers call
 * requireRuntimeScope with the capability the operation needs — no provider
 * routing logic lives here.
 *
 * Scope semantics follow the Phase 2/3 contract:
 *   - `scopes: []` means ALL capabilities are granted (established convention).
 *   - Otherwise the scope must be an exact capability ID or a sub-operation
 *     of a granted capability (e.g. key holds "ai.image"; request for
 *     "ai.image.generate" is covered — dotted sub-namespace, Phase 2 contract).
 *
 * @module lib/runtime/auth/authorize
 */

/**
 * Does a key's scope list cover the required capability?
 * Pure function — safe for the future router to reuse.
 */
export function scopeCovers(scopes: CapabilityScope[], required: CapabilityScope): boolean {
  // Empty scope list = all capabilities (Phase 2 convention, kept for
  // backward compatibility with keys issued before scoping was enforced).
  if (scopes.length === 0) return true
  return scopes.some(
    (s) => s === required || required.startsWith(`${s}.`),
  )
}

/** Non-throwing check: does this authenticated context have the scope? */
export function hasRuntimeScope(
  context: { scopes: CapabilityScope[] },
  required: CapabilityScope,
): boolean {
  return scopeCovers(context.scopes, required)
}

/**
 * Authorization primitive for runtime handlers (Phase 4 §16). Throws
 * runtime_capability_not_allowed (403) when the authenticated key's scopes
 * do not cover the requested capability.
 */
export function requireRuntimeScope(
  context: { scopes: CapabilityScope[] },
  required: CapabilityScope,
): void {
  if (!scopeCovers(context.scopes, required)) {
    throw runtimeError("runtime_capability_not_allowed")
  }
}
