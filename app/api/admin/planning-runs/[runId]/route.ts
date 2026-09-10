/**
 * Admin API: Single Planning Run Details
 * 
 * GET /api/admin/planning-runs/:runId
 * 
 * Requirements: 18.7
 */

import { NextRequest } from "next/server"
import { getCurrentUser } from "@/lib/auth/session"
import { ok, fail } from "@/lib/api/respond"
import { PlanningRunTracker } from "@/lib/planning/tracking/planning-run"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    // Check admin authentication
    const user = await getCurrentUser()
    if (!user || !user.isAdmin) {
      return fail("UNAUTHORIZED", "Admin access required", 403)
    }

    const { runId } = await params

    const tracker = new PlanningRunTracker()
    const run = await tracker.getRun(runId)

    if (!run) {
      return fail("NOT_FOUND", `Planning run ${runId} not found`, 404)
    }

    return ok({ run })
  } catch (error) {
    return fail(
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Failed to fetch planning run",
      500
    )
  }
}
