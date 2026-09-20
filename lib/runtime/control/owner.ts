import "server-only"
import { requireUser } from "@/lib/auth/session"
import { fail } from "@/lib/api/respond"
import { checkProjectOwnership } from "@/lib/runtime/ownership"
import type { UserDoc } from "@/lib/auth/users"

/**
 * Session-authenticated project ownership for Control Center routes.
 * Same 404 for missing and not-owned — no existence leak.
 */
export async function requireOwnedProject(projectId: string): Promise<
  | { ok: true; user: UserDoc }
  | { ok: false; response: ReturnType<typeof fail> }
> {
  const user = await requireUser()
  const ownership = await checkProjectOwnership(user.id, projectId)
  if (!ownership.ok) {
    return {
      ok: false,
      response: fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404),
    }
  }
  return { ok: true, user }
}
