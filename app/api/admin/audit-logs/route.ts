import { ok, handleRouteError } from "@/lib/api/respond"
import { requireAdmin } from "@/lib/auth/session"
import { getAuditLogs } from "@/lib/infrastructure/audit"

/**
 * GET /api/admin/audit-logs
 * Admin-only: List infrastructure audit logs with pagination and filtering.
 */
export async function GET(req: Request) {
  try {
    await requireAdmin()

    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200)
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10)
    const projectId = url.searchParams.get("projectId") ?? undefined
    const action = url.searchParams.get("action") ?? undefined

    const { logs, total } = await getAuditLogs({ limit, offset, projectId, action })

    return ok({
      logs: logs.map((l) => ({
        id: l.id,
        adminUserEmail: l.adminUserEmail,
        action: l.action,
        projectId: l.projectId,
        projectName: l.projectName,
        previousValue: l.previousValue,
        newValue: l.newValue,
        reason: l.reason,
        result: l.result,
        createdAt: l.createdAt,
      })),
      total,
    })
  } catch (e) {
    return handleRouteError("api.admin.audit-logs", e)
  }
}
