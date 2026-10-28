import { NextResponse } from "next/server"
import { getMongoClient } from "@/lib/db/mongodb"
import { assertTransactionSupport } from "@/lib/db/transaction-readiness"
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
      await assertTransactionSupport(client)
      checks.mongo = { status: "ok", latencyMs: Date.now() - startedAt }
    } catch {
      // Driver messages can contain host/auth fragments — status only here.
      checks.mongo = { status: "error", latencyMs: Date.now() - startedAt }
    }
  }

  // Integrations (config check only — no network call)
  checks.firecrawl = { status: isFirecrawlConfigured() ? "configured" : "not_configured" }
  checks.totalum = { status: isTotalumConfigured() ? "configured" : "not_configured" }

  const healthy = checks.mongo?.status === "ok" || (process.env.NODE_ENV !== "production" && checks.mongo?.status === "not_configured")
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
