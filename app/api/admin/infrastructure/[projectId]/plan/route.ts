import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { requireAdmin } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { applyTotalumCap } from "@/lib/infrastructure/service"
import { getInfrastructurePlan, type InfrastructurePlanId } from "@/lib/infrastructure/plans"
import { logAuditAction } from "@/lib/infrastructure/audit"

const MONTH_MS = 30 * 24 * 60 * 60 * 1000

/**
 * POST /api/admin/infrastructure/:projectId/plan
 * Admin-only: Change a project's infrastructure plan (override).
 * Does NOT charge the user — this is an admin override.
 */
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const admin = await requireAdmin()
    const { projectId } = await params

    const body = (await req.json().catch(() => ({}))) as { planId?: string }
    const planId = body.planId?.trim().toLowerCase() as InfrastructurePlanId | undefined
    if (!planId) return fail("VALIDATION", "Plan ID is required.", 422)

    const newPlan = getInfrastructurePlan(planId)
    if (!newPlan) return fail("VALIDATION", "Invalid plan.", 422)
    if (planId === "enterprise") return fail("VALIDATION", "Enterprise plans require manual configuration.", 400)

    const project = await store.getProject(projectId)
    if (!project) return fail("NOT_FOUND", "Project not found.", 404)
    if (!project.totalumProjectId) return fail("NO_TOTALUM_PROJECT", "Project has no Totalum project.", 400)

    const previousPlan = project.infrastructure?.planId ?? "none"
    const now = Date.now()

    // Update project infrastructure
    const col = await (await import("@/lib/db/collections")).projectsCol()
    await col.updateOne(
      { id: projectId },
      {
        $set: {
          infrastructure: {
            planId: newPlan.id,
            planName: newPlan.name,
            storageLimitBytes: newPlan.storageBytes,
            totalumInfrastructureCreditLimit: newPlan.totalumInfrastructureCredits,
            status: "active",
            startedAt: now,
            expiresAt: now + MONTH_MS,
            autoRenew: false,
            totalumCreditsUsed: project.infrastructure?.totalumCreditsUsed ?? 0,
            storageUsedBytes: project.infrastructure?.storageUsedBytes ?? 0,
            overQuota: (project.infrastructure?.storageUsedBytes ?? 0) > newPlan.storageBytes,
            syncStatus: "pending",
          },
          updatedAt: now,
        },
      },
    )

    // Apply Totalum cap
    try {
      await applyTotalumCap(project.totalumProjectId, newPlan.totalumInfrastructureCredits)
      await col.updateOne(
        { id: projectId, "infrastructure.planId": newPlan.id },
        { $set: { "infrastructure.syncStatus": "synced", updatedAt: now } },
      )
    } catch (e) {
      await col.updateOne(
        { id: projectId, "infrastructure.planId": newPlan.id },
        { $set: { "infrastructure.syncStatus": "failed", updatedAt: now } },
      )

      await logAuditAction({
        adminUserId: admin.id,
        adminUserEmail: admin.email,
        action: "change_plan_cap_failed",
        projectId: project.id,
        projectName: project.name,
        userId: project.userId,
        previousValue: previousPlan,
        newValue: planId,
        result: "failure",
        reason: (e as Error).message,
      })

      return fail("CAP_UPDATE_FAILED", `Plan changed but Totalum cap update failed: ${(e as Error).message}`, 500)
    }

    await logAuditAction({
      adminUserId: admin.id,
      adminUserEmail: admin.email,
      action: "change_plan",
      projectId: project.id,
      projectName: project.name,
      userId: project.userId,
      previousValue: previousPlan,
      newValue: planId,
      result: "success",
    })

    return ok({ message: `Plan changed from ${previousPlan} to ${newPlan.name}.`, planId: newPlan.id })
  } catch (e) {
    return handleRouteError("api.admin.infrastructure.plan", e)
  }
}
