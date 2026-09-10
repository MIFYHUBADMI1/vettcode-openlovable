/**
 * Health Check: Planning Pipeline
 * GET /api/health/planning
 * Requirements: 13.1-13.8
 */

import { NextRequest } from "next/server"
import { ok, fail } from "@/lib/api/respond"
import { ModelRegistry } from "@/lib/planning/models/registry"
import { planningRunsCol } from "@/lib/db/collections"

export async function GET(req: NextRequest) {
  try {
    const health: any = {
      status: "healthy",
      timestamp: Date.now(),
      checks: {},
    }

    try {
      const col = await planningRunsCol()
      await col.countDocuments({}, { limit: 1 })
      health.checks.database = { status: "ok" }
    } catch (error) {
      health.checks.database = { status: "error", error: error instanceof Error ? error.message : String(error) }
      health.status = "degraded"
    }

    try {
      const registry = new ModelRegistry()
      const plannerModel = registry.getModelForStage("planning")
      health.checks.modelConfig = { status: "ok", plannerModel: plannerModel.primary }
    } catch (error) {
      health.checks.modelConfig = { status: "error", error: error instanceof Error ? error.message : String(error) }
      health.status = "degraded"
    }

    health.checks.environment = {
      status: "ok",
      openrouterConfigured: !!process.env.OPENROUTER_API_KEY,
      enhancedPipelineEnabled: process.env.USE_ENHANCED_PIPELINE === "true",
      rolloutPercent: process.env.ENHANCED_PIPELINE_ROLLOUT_PERCENT || "0",
    }

    return ok(health)
  } catch (error) {
    return fail("INTERNAL_ERROR", error instanceof Error ? error.message : "Health check failed", 500)
  }
}
