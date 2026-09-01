import { ok, handleRouteError } from "@/lib/api/respond"
import { requireAdmin } from "@/lib/auth/session"
import { projectsCol, usersCol } from "@/lib/db/collections"
import type { MirrorProject } from "@/lib/types/project"

/**
 * GET /api/admin/infrastructure
 * Admin-only endpoint to list all project infrastructure subscriptions.
 */
export async function GET(req: Request) {
  try {
    await requireAdmin()

    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200)
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10)

    const col = await projectsCol()
    const total = await col.countDocuments({ "infrastructure.planId": { $exists: true } })
    const projects = await col
      .find({ "infrastructure.planId": { $exists: true } })
      .sort({ updatedAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray()

    // Enrich with user names
    const userIds = [...new Set(projects.map((p) => p.userId))]
    const usersCol_ = await usersCol()
    const users = await usersCol_
      .find({ id: { $in: userIds } })
      .project({ id: 1, name: 1, email: 1 })
      .toArray()
    const userMap = new Map(users.map((u) => [u.id, { name: u.name, email: u.email }]))

    const enriched = projects.map((p) => {
      const proj = p as MirrorProject
      const infra = proj.infrastructure
      return {
        projectId: proj.id,
        projectName: proj.name,
        userId: proj.userId,
        userName: userMap.get(proj.userId)?.name ?? "Unknown",
        userEmail: userMap.get(proj.userId)?.email ?? "",
        totalumProjectId: proj.totalumProjectId ?? null,
        planId: infra?.planId ?? "none",
        planName: infra?.planName ?? "None",
        storageLimitBytes: infra?.storageLimitBytes ?? 0,
        storageUsedBytes: infra?.storageUsedBytes ?? 0,
        totalumCap: infra?.totalumInfrastructureCreditLimit ?? 0,
        totalumUsed: infra?.totalumCreditsUsed ?? 0,
        status: infra?.status ?? "none",
        overQuota: infra?.overQuota ?? false,
        syncStatus: infra?.syncStatus ?? "unknown",
        startedAt: infra?.startedAt ?? null,
        expiresAt: infra?.expiresAt ?? null,
        state: proj.state,
        developmentUrl: proj.developmentUrl,
        deploymentUrl: proj.deployment?.productionUrl,
      }
    })

    return ok({ projects: enriched, total })
  } catch (e) {
    return handleRouteError("api.admin.infrastructure", e)
  }
}
