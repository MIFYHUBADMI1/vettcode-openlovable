import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { linkDatabaseRecords, unlinkDatabaseRecords, isTotalumConfigured } from "@/lib/integrations/totalum/service"

/**
 * POST /api/projects/:id/database/records/:recordId/link
 * Link two records across a many-to-many relation.
 */
export async function POST(
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
      propertyId?: string
      referenceId?: string
    }
    if (!body.tableName) return fail("VALIDATION", "tableName is required.", 422)
    if (!body.propertyId) return fail("VALIDATION", "propertyId is required.", 422)
    if (!body.referenceId) return fail("VALIDATION", "referenceId is required.", 422)

    const result = await linkDatabaseRecords(
      project.totalumProjectId,
      body.tableName,
      recordId,
      body.propertyId,
      body.referenceId,
    )
    return ok(result)
  } catch (e) {
    return handleRouteError("api.projects.database.link", e)
  }
}

/**
 * DELETE /api/projects/:id/database/records/:recordId/link
 * Unlink two records (many-to-many).
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

    const body = (await req.json().catch(() => ({}))) as {
      tableName?: string
      propertyId?: string
      referenceId?: string
    }
    if (!body.tableName) return fail("VALIDATION", "tableName is required.", 422)
    if (!body.propertyId) return fail("VALIDATION", "propertyId is required.", 422)
    if (!body.referenceId) return fail("VALIDATION", "referenceId is required.", 422)

    const result = await unlinkDatabaseRecords(
      project.totalumProjectId,
      body.tableName,
      recordId,
      body.propertyId,
      body.referenceId,
    )
    return ok(result)
  } catch (e) {
    return handleRouteError("api.projects.database.unlink", e)
  }
}
