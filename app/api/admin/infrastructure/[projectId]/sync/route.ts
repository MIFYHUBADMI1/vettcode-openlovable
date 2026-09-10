import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { requireAdmin } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { applyTotalumCap } from "@/lib/infrastructure/service"
import { getInfrastructurePlan } from "@/lib/infrastructure/plans"
import { logAuditAction } from "@/lib/infrastructure/audit"

/**
 * POST /api/admin/infrastructure/:projectId/sync
 * Admin-only: Force-synchronize a project's Totalum infrastructure cap.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const admin = await requireAdmin()
    const { projectId } = await params

    const project = await store.getProject(projectId)
    if (!project) return fail("NOT_FOUND", "Project not found.", 404)
    if (!project.totalumProjectId) return fail("NO_TOTALUM_PROJECT", "Project has no Totalum project.", 400)
    if (!project.infrastructure) return fail("NO_INFRASTRUCTURE", "Project has no infrastructure subscription.", 400)

    const plan = getInfrastructurePlan(project.infrastructure.planId)
    const cap = project.infrastructure.totalumInfrastructureCreditLimit ?? plan?.totalumInfrastructureCredits ?? 5

    try {
      await applyTotalumCap(project.totalumProjectId, cap)

      // Update sync status
      const col = await (await import("@/lib/db/collections")).projectsCol()
      await col.updateOne(
        { id: projectId },
        { $set: { "infrastructure.syncStatus": "synced", updatedAt: Date.now() } },
      )

      await logAuditAction({
        adminUserId: admin.id,
        adminUserEmail: admin.email,
        action: "sync_infrastructure_cap",
        projectId: project.id,
        projectName: project.name,
        userId: project.userId,
        newValue: `cap=${cap}`,
        result: "success",
      })

      return ok({ message: "Infrastructure cap synchronized.", cap })
    } catch (e) {
      const col = await (await import("@/lib/db/collections")).projectsCol()
      await col.updateOne(
        { id: projectId },
        { $set: { "infrastructure.syncStatus": "failed", updatedAt: Date.now() } },
      )

      await logAuditAction({
        adminUserId: admin.id,
        adminUserEmail: admin.email,
        action: "sync_infrastructure_cap",
        projectId: project.id,
        projectName: project.name,
        userId: project.userId,
        newValue: `cap=${cap}`,
        result: "failure",
        reason: (e as Error).message,
      })

      return fail("SYNC_FAILED", `Failed to sync: ${(e as Error).message}`, 500)
    }
  } catch (e) {
    return handleRouteError("api.admin.infrastructure.sync", e)
  }
}
