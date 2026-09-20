/**
 * Atai Runtime — authentication & security boundary (server-only).
 *
 * Exports the canonical runtime authentication path, credential extraction,
 * and scope authorization primitives. Consumer-facing management routes
 * (dashboard, session cookies) deliberately do NOT go through this module —
 * those use the existing web session system.
 *
 * @module lib/runtime/auth
 */

export { extractApiKey, hasUnknownEnvironmentSegment } from "./extract"
export {
  authenticateRuntimeRequest,
  normalizeRuntimeAuthError,
} from "./authenticate"
export { scopeCovers, hasRuntimeScope, requireRuntimeScope } from "./authorize"
