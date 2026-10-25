import "server-only"

import { requireUser } from "@/lib/auth/session"
import { fail } from "@/lib/api/respond"
import { checkProjectOwnership } from "@/lib/runtime/ownership"
import { isStudioWorkspaceEnabled } from "@/lib/marketing/feature-flags"

/**
 * Shared guard for every Studio endpoint: authenticated user, verified project
 * ownership (uniform 404 — no existence leak), and the workspace flag.
 * Returns a ready-to-send failure response instead of throwing.
 */
export async function requireStudioProject(projectId: string) {
  const user = await requireUser()
  const ownership = await checkProjectOwnership(user.id, projectId)
  if (!ownership.ok) {
    return {
      ok: false as const,
      response: fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404),
    }
  }
  if (!isStudioWorkspaceEnabled(user.id)) {
    return {
      ok: false as const,
      response: fail("FEATURE_DISABLED", "The Marketing Studio isn't available for this account yet.", 403),
    }
  }
  return { ok: true as const, user }
}
