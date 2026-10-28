import type { MirrorProject } from "@/lib/types/project"

/**
 * Build session recovery.
 *
 * A build keeps running at the provider after the founder closes the tab,
 * refreshes, navigates away or loses the browser, but nothing polls it any
 * more. These helpers describe that state so the workspace (on mount), the
 * projects list (on mount) and the status endpoint (on every poll) can agree
 * on what "nobody has been watching this build" means.
 *
 * Shared between client components and the API route, so it stays dependency
 * free and never imports server-only modules.
 */

/** A build that has not been polled for this long has lost its session:
 * comfortably longer than the 10s active poll interval, short enough that a
 * founder returning within minutes is recognised. */
export const STALE_BUILD_MS = 5 * 60 * 1000

export type RecoverableProject = Pick<MirrorProject, "state" | "lastPolledAt">

/** True while a project claims to be mid-build and has a provider project to
 * ask about. Without `totalumProjectId` the status endpoint has a different
 * recovery path (reset to `specification_ready`), so it is not recoverable
 * here. */
export function hasRecoverableBuild(
  project: Pick<MirrorProject, "state" | "totalumProjectId">,
): boolean {
  if (!project.totalumProjectId) return false
  return project.state === "building" || project.state === "deploying"
}

/** True when the last poll is old enough that the session was interrupted.
 * A project that has never been polled is not stale — it is simply new. */
export function isStaleBuild(project: RecoverableProject, now = Date.now()): boolean {
  if (!project.lastPolledAt) return false
  return now - project.lastPolledAt > STALE_BUILD_MS
}

/**
 * True when a build looks abandoned: it claims to be running at the provider,
 * and nobody has polled it for a while. Builds recorded before poll tracking
 * existed have no `lastPolledAt` at all, so their own update timestamp is used
 * as the floor — a build that started this second is never treated as abandoned.
 */
export function isOrphanedBuild(
  project: Pick<MirrorProject, "state" | "totalumProjectId" | "lastPolledAt" | "updatedAt">,
  now = Date.now(),
): boolean {
  if (!hasRecoverableBuild(project)) return false
  if (project.lastPolledAt) return now - project.lastPolledAt > STALE_BUILD_MS
  return now - project.updatedAt > STALE_BUILD_MS
}

/** Reconnecting a build costs a provider status call, so the projects list works
 * abandoned builds off in bounded batches instead of polling the whole portfolio. */
export const RECOVERY_BATCH = 5

/** Orphaned builds worth reconnecting, newest first. */
export function selectOrphanedBuilds<T extends Pick<MirrorProject, "state" | "totalumProjectId" | "lastPolledAt" | "updatedAt">>(
  projects: T[],
  now = Date.now(),
): T[] {
  return projects
    .filter((project) => isOrphanedBuild(project, now))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, RECOVERY_BATCH)
}
