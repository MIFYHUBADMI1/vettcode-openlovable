import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { editDatabaseRecord, deleteDatabaseRecord, isTotalumConfigured } from "@/lib/integrations/totalum/service"

/**
 * PATCH /api/projects/:id/database/records/:recordId
 * Edit an existing record by ID.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; recordId: string }> },
) {
  try {
    const user = await requireUser()
    const { id, recordId } = await params
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

    const record = await editDatabaseRecord(project.totalumProjectId, body.tableName, recordId, body.data)
    return ok(record)
  } catch (e) {
    return handleRouteError("api.projects.database.records.edit", e)
  }
}

/**
 * DELETE /api/projects/:id/database/records/:recordId
 * Delete a record by ID.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; recordId: string }> },
) {
  try {
    const user = await requireUser()
    const { id, recordId } = await params
    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    if (!project.totalumProjectId) return fail("NO_TOTALUM_PROJECT", "This project hasn't been built yet.", 400)
    if (!isTotalumConfigured()) return fail("PROVIDER_NOT_CONFIGURED", "The application builder isn't connected yet.", 503)

    // tableName comes from query parameter for DELETE
    const url = new URL(req.url)
    const tableName = url.searchParams.get("tableName")
    if (!tableName) return fail("VALIDATION", "tableName is required as a query parameter.", 422)

    const result = await deleteDatabaseRecord(project.totalumProjectId, tableName, recordId)
    return ok(result)
  } catch (e) {
    return handleRouteError("api.projects.database.records.delete", e)
  }
}
