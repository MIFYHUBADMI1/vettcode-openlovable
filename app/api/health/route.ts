import { NextResponse } from "next/server"
import { getMongoClient } from "@/lib/db/mongodb"
import { isFirecrawlConfigured } from "@/lib/integrations/firecrawl/service"
import { isTotalumConfigured } from "@/lib/integrations/totalum/client"
import { isMongoConfigured } from "@/lib/env"

export async function GET() {
  const startedAt = Date.now()
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {}

  // MongoDB
  if (!isMongoConfigured()) {
    checks.mongo = { status: "not_configured" }
  } else {
    try {
      const client = await getMongoClient()
      await client.db().command({ ping: 1 })
      checks.mongo = { status: "ok", latencyMs: Date.now() - startedAt }
    } catch (e) {
      checks.mongo = { status: "error", error: (e as Error).message, latencyMs: Date.now() - startedAt }
    }
  }

  // Integrations (config check only — no network call)
  checks.firecrawl = { status: isFirecrawlConfigured() ? "configured" : "not_configured" }
  checks.totalum = { status: isTotalumConfigured() ? "configured" : "not_configured" }

  const healthy = checks.mongo?.status === "ok" || checks.mongo?.status === "not_configured"
  const totalLatency = Date.now() - startedAt

  return NextResponse.json(
    {
      ok: healthy,
      status: healthy ? "healthy" : "degraded",
      latencyMs: totalLatency,
      checks,
    },
    { status: healthy ? 200 : 503 },
  )
}
