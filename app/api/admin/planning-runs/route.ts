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
import { ok, fail } from "@/lib/api/respond"
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
    const limit = parseInt(searchParams.get("limit") || "10", 10)

    const tracker = new PlanningRunTracker()

    let runs
    if (userId) {
      runs = await tracker.getByUserId(userId, limit)
    } else if (projectId) {
      runs = await tracker.getByProjectId(projectId, limit)
    } else {
      runs = await tracker.listRecent(Math.min(Math.max(limit, 1), 100))
    }

    return ok({ runs })
  } catch (error) {
    return fail(
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Failed to fetch planning runs",
      500
    )
  }
}
