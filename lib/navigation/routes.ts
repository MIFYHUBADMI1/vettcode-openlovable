/**
 * Centralized route registry — the ONLY way Co-founder navigation targets
 * are resolved into real application URLs. The AI never produces an href;
 * it produces a structured target and this module maps it to a known route.
 *
 * If a target is unknown, resolvers throw — the navigation layer converts
 * that into a safe "I can't navigate there" response rather than following
 * a model-authored URL (spec sections 25–26).
 */

export type WorkspaceTarget =
  | "dashboard"
  | "projects"
  | "newProject"
  | "explore"
  | "featureRequests"
  | "billing"
  | "settings"

export type ProjectTarget =
  | "project"
  | "plan"
  | "collaborate"
  | "database"
  | "edit"
  | "source"
  | "tree"
  | "repoCode"
  | "readme"
  | "runtime"

/** Every navigation target the Co-founder may produce. */
export type NavigationTarget = WorkspaceTarget | ProjectTarget

export interface NavigationTargetInput {
  target: NavigationTarget
  /** Required for every project-scoped target. */
  projectId?: string
}

export function isProjectTarget(target: NavigationTarget): target is ProjectTarget {
  return target !== "dashboard" &&
    target !== "projects" &&
    target !== "newProject" &&
    target !== "explore" &&
    target !== "featureRequests" &&
    target !== "billing" &&
    target !== "settings"
}

/** Workspace-level targets that need no project context. */
export const WORKSPACE_TARGETS: readonly WorkspaceTarget[] = [
  "dashboard",
  "projects",
  "newProject",
  "explore",
  "featureRequests",
  "billing",
  "settings",
]

/** Project-scoped targets. */
export const PROJECT_TARGETS: readonly ProjectTarget[] = [
  "project",
  "plan",
  "collaborate",
  "database",
  "edit",
  "source",
  "tree",
  "repoCode",
  "readme",
  "runtime",
]

export function isKnownTarget(target: string): target is NavigationTarget {
  return (WORKSPACE_TARGETS as readonly string[]).includes(target) ||
    (PROJECT_TARGETS as readonly string[]).includes(target)
}

/** Resolve a workspace-level target to its application path. */
export function resolveWorkspaceTarget(target: WorkspaceTarget): string {
  switch (target) {
    case "dashboard": return "/dashboard"
    case "projects": return "/projects"
    case "newProject": return "/new"
    case "explore": return "/explore"
    case "featureRequests": return "/feature-requests"
    case "billing": return "/settings/billing"
    case "settings": return "/settings/profile"
  }
}

/** Resolve a project-scoped target to its application path. Throws on an
 * unknown/invalid combination — callers own the user-facing error. */
export function resolveProjectTarget(target: ProjectTarget, projectId: string): string {
  if (!projectId) throw new Error("A project is required for this destination.")
  const id = encodeURIComponent(projectId)
  switch (target) {
    case "project": return `/project/${id}`
    case "plan": return `/project/${id}/plan`
    case "collaborate": return `/project/${id}/collaborate`
    case "database": return `/project/${id}/database`
    case "edit": return `/project/${id}/edit`
    case "source": return `/project/${id}/source`
    case "tree": return `/project/${id}/tree`
    case "repoCode": return `/project/${id}/repo-code`
    case "readme": return `/project/${id}/readme`
    case "runtime": return `/project/${id}/runtime`
  }
}

/** Resolve any Co-founder navigation target through the registry. Throws for
 * unknown targets or missing project context — never guesses a URL. */
export function resolveNavigationTarget(input: NavigationTargetInput): string {
  if (!isKnownTarget(input.target)) throw new Error("Unknown destination.")
  if (isProjectTarget(input.target)) {
    if (!input.projectId || typeof input.projectId !== "string") {
      throw new Error("A project is required for this destination.")
    }
    return resolveProjectTarget(input.target, input.projectId)
  }
  return resolveWorkspaceTarget(input.target)
}
