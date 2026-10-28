/**
 * Admin API: Planning Run Queries
 * 
 * GET /api/admin/planning-runs?userId=X
 * GET /api/admin/planning-runs?projectId=X
 * 
 * Requirements: 18.7
 */

import { NextRequest } from "next/server"
import { getCurrentUser } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { PlanningRunTracker } from "@/lib/planning/tracking/planning-run"

export async function GET(req: NextRequest) {
  try {
    // Check admin authentication
    const user = await getCurrentUser()
    if (!user || !user.isAdmin) {
      return fail("UNAUTHORIZED", "Admin access required", 403)
    }

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("userId")
    const projectId = searchParams.get("projectId")
    // Clamp once, for EVERY branch. `listRecent` clamps internally, but
    // `getByUserId` / `getByProjectId` pass the limit straight to Mongo —
    // a negative limit means "no limit" server-side and a huge one means an
    // unbounded scan.
    const rawLimit = parseInt(searchParams.get("limit") || "10", 10)
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 10

    const tracker = new PlanningRunTracker()

    let runs
    if (userId) {
      runs = await tracker.getByUserId(userId, limit)
    } else if (projectId) {
      runs = await tracker.getByProjectId(projectId, limit)
    } else {
      runs = await tracker.listRecent(limit)
    }

    return ok({ runs })
  } catch (error) {
    return handleRouteError("admin.planning-runs", error)
  }
}
