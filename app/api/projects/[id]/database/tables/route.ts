import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { getDatabaseTables, isTotalumConfigured } from "@/lib/integrations/totalum/service"

/**
 * GET /api/projects/:id/database/tables
 * Retrieve all database table definitions for a project.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    if (!project.totalumProjectId) return fail("NO_TOTALUM_PROJECT", "This project hasn't been built yet.", 400)
    if (!isTotalumConfigured()) return fail("PROVIDER_NOT_CONFIGURED", "The application builder isn't connected yet.", 503)

    const tables = await getDatabaseTables(project.totalumProjectId)
    return ok(tables)
  } catch (e) {
    return handleRouteError("api.projects.database.tables", e)
  }
}
