import "server-only"
import { projectsCol } from "@/lib/db/collections"
import { ProviderExecutionError } from "@/lib/runtime/router/adapter"

/**
 * Atai Runtime — Totalum project binding (server-only).
 *
 * PROJECT ISOLATION (Phase 10 §19/§34/§35): the generated application's
 * runtime database is ITS OWN Totalum project. The binding comes
 * exclusively from the authenticated Atai project record
 * (projects.totalumProjectId) — the caller can never address another
 * project's database, another Totalum account, or an arbitrary Totalum
 * project id. No request content participates in the lookup.
 *
 * @module lib/runtime/router/adapters/totalum/project-binding
 */

/** In-memory cache keyed by Atai project id — the binding is immutable once
 * a project is built; caching avoids a collection read per runtime call
 * (§81: no unnecessary database calls). Failures are not cached. */
const bindingCache = new Map<string, string | null>()
const MAX_CACHE_ENTRIES = 1_000

export async function resolveTotalumProjectId(ataiProjectId: string): Promise<string> {
  if (bindingCache.has(ataiProjectId)) {
    const cached = bindingCache.get(ataiProjectId)
    if (cached) return cached
    throw notProvisioned(ataiProjectId)
  }

  try {
    const col = await projectsCol()
    const project = await col.findOne({ id: ataiProjectId }, { projection: { totalumProjectId: 1 } })
    const totalumProjectId = typeof project?.totalumProjectId === "string" ? project.totalumProjectId : null

    if (bindingCache.size >= MAX_CACHE_ENTRIES) bindingCache.clear()
    bindingCache.set(ataiProjectId, totalumProjectId)

    if (!totalumProjectId) throw notProvisioned(ataiProjectId)
    return totalumProjectId
  } catch (e) {
    if (e instanceof ProviderExecutionError) throw e
    // Binding lookup failed (database unavailable) — fail closed with a
    // normalized error; never fall back to an unscoped operation.
    throw new ProviderExecutionError(
      "provider_unavailable",
      "The runtime database is temporarily unavailable.",
      "project binding lookup failed",
    )
  }
}

/** Test-only: clear the in-process binding cache. */
export function clearTotalumProjectBindingCache(): void {
  bindingCache.clear()
}

function notProvisioned(ataiProjectId: string): ProviderExecutionError {
  return new ProviderExecutionError(
    "provider_unavailable",
    "This capability is not available for this project yet.",
    `project ${ataiProjectId} has no generated application (no Totalum project binding)`,
  )
}
