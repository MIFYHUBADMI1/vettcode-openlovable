import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { createDatabaseRecord, isTotalumConfigured } from "@/lib/integrations/totalum/service"

/**
 * POST /api/projects/:id/database/records
 * Create a new record in any table.
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
      data?: Record<string, unknown>
    }
    if (!body.tableName) return fail("VALIDATION", "tableName is required.", 422)
    if (!body.data || typeof body.data !== "object") return fail("VALIDATION", "data is required and must be an object.", 422)

    const record = await createDatabaseRecord(project.totalumProjectId, body.tableName, body.data)
    return ok(record, { status: 201 })
  } catch (e) {
    return handleRouteError("api.projects.database.records.create", e)
  }
}
