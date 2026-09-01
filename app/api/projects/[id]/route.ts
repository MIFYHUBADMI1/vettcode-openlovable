import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { ProjectUnderstandingSchema } from "@/lib/types/understanding"
import { ApplicationSpecificationSchema } from "@/lib/types/specification"

/** Returns a project the caller owns. Ownership is enforced server-side — a
 * user can never read another user's project (spec section 26). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const project = await store.getProject(id)
    if (!project || project.userId !== user.id)
      return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    return ok({ project })
  } catch (e) {
    return handleRouteError("api.projects.get", e)
  }
}

/** Saves user-reviewed project context or specification with ownership checks. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    const body = (await req.json().catch(() => ({}))) as { understanding?: unknown; specification?: unknown }
    const patch: Record<string, unknown> = {}
    if (body.understanding !== undefined) {
      const parsed = ProjectUnderstandingSchema.safeParse(body.understanding)
      if (!parsed.success) return fail("VALIDATION", "The project context is invalid.", 422)
      patch.understanding = parsed.data
    }
    if (body.specification !== undefined) {
      const parsed = ApplicationSpecificationSchema.safeParse(body.specification)
      if (!parsed.success) return fail("VALIDATION", "The application plan is invalid.", 422)
      patch.specification = parsed.data
    }
    if (!Object.keys(patch).length) return fail("VALIDATION", "No editable project data was provided.", 422)
    // Clear the sanitized flag when the user manually edits the spec
    if (patch.specification) {
      patch.specSanitized = false
    }
    const updated = await store.updateProject(id, patch)
    return ok({ project: updated })
  } catch (e) {
    return handleRouteError("api.projects.update", e)
  }
}

/** Permanently deletes a project the caller owns, cascading to its build
 * runs. Ownership is enforced server-side (spec section 26). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    console.log("[v0] api.projects.delete: request received", { id, userId: user.id })
    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) {
      console.log("[v0] api.projects.delete: ownership check failed", { id, userId: user.id })
      return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    }
    const deleted = await store.deleteProject(id, user.id)
    console.log("[v0] api.projects.delete: result", { id, deleted })
    if (!deleted) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    return ok({ deleted: true })
  } catch (e) {
    return handleRouteError("api.projects.delete", e)
  }
}
