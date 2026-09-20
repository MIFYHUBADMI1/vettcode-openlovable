import "server-only"
import { store } from "@/lib/store/store"
import { logger } from "@/lib/logging/logger"

/**
 * Atai Runtime — Ownership validation (server-only).
 *
 * Reusable service-level checks for key management and future runtime
 * authentication. Deliberately REUSES the application's existing project
 * store (lib/store/store.ts → MongoStore) rather than duplicating ownership
 * queries — there is one source of truth for "does this project exist and
 * who owns it".
 *
 * @module lib/runtime/ownership
 */

export interface ProjectOwnershipResult {
  ok: boolean
  /** "not_found" | "not_owned" | "ok" — precise, but never leaks existence to unauthorized callers at the route layer. */
  reason: "ok" | "not_found" | "not_owned"
}

/**
 * Verify the project exists AND belongs to the user. This is the check the
 * dashboard key-management endpoints must perform BEFORE createApiKey.
 * (Client-supplied ownership is never trusted — Phase 2 contract §23.)
 */
export async function checkProjectOwnership(
  userId: string,
  projectId: string,
): Promise<ProjectOwnershipResult> {
  try {
    const project = await store.getProject(projectId)
    if (!project) return { ok: false, reason: "not_found" }
    if (project.userId !== userId) return { ok: false, reason: "not_owned" }
    return { ok: true, reason: "ok" }
  } catch (e) {
    logger.error("runtime.ownership", "project ownership check failed", {
      userId,
      projectId,
      message: e instanceof Error ? e.message : String(e),
    })
    // Fail closed — treat DB errors as not-owned so nothing is granted on error.
    return { ok: false, reason: "not_owned" }
  }
}

/** Key-to-project binding check (service level). */
export function keyBelongsToProject(
  key: { projectId: string },
  projectId: string,
): boolean {
  return key.projectId === projectId
}

/** Key-to-user binding check (service level). */
export function keyBelongsToUser(key: { userId: string }, userId: string): boolean {
  return key.userId === userId
}
