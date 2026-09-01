import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { queryDatabase, isTotalumConfigured } from "@/lib/integrations/totalum/service"
import type { DatabaseQueryOptions } from "@/lib/integrations/totalum/types"

/**
 * POST /api/projects/:id/database/query
 * Query records from any table with filtering, sorting, pagination.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    if (!project.totalumProjectId) return fail("NO_TOTALUM_PROJECT", "This project hasn't been built yet.", 400)
    if (!isTotalumConfigured()) return fail("PROVIDER_NOT_CONFIGURED", "The application builder isn't connected yet.", 503)

    const body = (await req.json().catch(() => ({}))) as {
      tableName?: string
      queryOptions?: DatabaseQueryOptions
    }
    if (!body.tableName) return fail("VALIDATION", "tableName is required.", 422)

    const result = await queryDatabase(project.totalumProjectId, body.tableName, body.queryOptions)
    return ok(result)
  } catch (e) {
    return handleRouteError("api.projects.database.query", e)
  }
}
