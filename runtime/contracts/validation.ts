/**
 * Atai Runtime — validation schemas (shared, SDK-safe).
 *
 * Zod schemas used by the future dashboard routes and the future runtime API
 * edge validation. The security invariant encoded here: client-supplied
 * userId/projectId/environment CANNOT be injected via request bodies —
 * creation input takes only what the user may choose, and ownership comes
 * from the session (dashboard) or the key record (runtime).
 *
 * @module runtime/contracts/validation
 */

import { z } from "zod"

/**
 * Dashboard key-creation request body. NOTE: projectId is NOT accepted here —
 * it comes from the URL path (/api/projects/:id/keys), and ownership is
 * verified server-side against the session user. A body containing
 * userId/projectId is rejected as unsafe injection.
 */
export const ApiKeyCreateBodySchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    environment: z.enum(["development", "production"]),
    scopes: z.array(z.string()).max(50),
    expiresAt: z.number().int().positive().optional(),
    /** Explicitly forbidden — catch injection attempts with a precise error. */
    userId: z.never().optional(),
    projectId: z.never().optional(),
  })
  .strict()

/**
 * Future runtime request envelope (Phase 5+). Identity fields are rejected —
 * they are derived from the authenticated API key, never from the body.
 */
export const RuntimeRequestEnvelopeSchema = z
  .object({
    userId: z.never().optional(),
    projectId: z.never().optional(),
    environment: z.never().optional(),
  })
  .passthrough()

/**
 * Test helper — verifies a payload attempting to set ownership fields is
 * rejected by the create schema (security invariant from Phase 2 prompt §35).
 */
export function rejectsOwnershipInjection(payload: Record<string, unknown>): boolean {
  const result = ApiKeyCreateBodySchema.safeParse(payload)
  return !result.success
}
