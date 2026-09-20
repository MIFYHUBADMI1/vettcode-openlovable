import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { requireOwnedProject } from "@/lib/runtime/control/owner"
import { listProjectUsage } from "@/lib/runtime/control/analytics"
import {
  breakdownByApiKey,
  breakdownByCapability,
  breakdownByError,
  breakdownByModel,
  breakdownByProvider,
  estimatePeriodUsage,
} from "@/lib/runtime/control/breakdown"
import type { RuntimeEnvironment } from "@/runtime/contracts/capabilities"

function envParam(v: string | null): RuntimeEnvironment | undefined {
  return v === "development" || v === "production" ? v : undefined
}

function statusParam(v: string | null): "succeeded" | "failed" | undefined {
  return v === "succeeded" || v === "failed" ? v : undefined
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const gate = await requireOwnedProject(id)
    if (!gate.ok) return gate.response

    const url = new URL(req.url)
    const from = url.searchParams.get("from")
    const to = url.searchParams.get("to")
    const limitRaw = url.searchParams.get("limit")
    const fromN = from ? Number(from) : undefined
    const toN = to ? Number(to) : undefined
    if (from && !Number.isFinite(fromN)) return fail("VALIDATION", "Invalid from timestamp.", 422)
    if (to && !Number.isFinite(toN)) return fail("VALIDATION", "Invalid to timestamp.", 422)

    const window = {
      from: fromN,
      to: toN,
      environment: envParam(url.searchParams.get("environment")),
    }

    const result = await listProjectUsage(id, {
      ...window,
      capability: url.searchParams.get("capability") ?? undefined,
      model: url.searchParams.get("model") ?? undefined,
      status: statusParam(url.searchParams.get("status")),
      apiKeyId: url.searchParams.get("apiKeyId") ?? undefined,
      requestId: url.searchParams.get("requestId") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: limitRaw ? Number(limitRaw) : undefined,
    })

    // Server-authoritative breakdowns + estimate for the same window. The
    // browser only renders these numbers — it never computes a total.
    const [byApiKey, byCapability, byModel, byProvider, byError, estimate] = await Promise.all([
      breakdownByApiKey(id, window),
      breakdownByCapability(id, window),
      breakdownByModel(id, window),
      breakdownByProvider(id, window),
      breakdownByError(id, window),
      estimatePeriodUsage(id, window),
    ])

    return ok({ ...result, byApiKey, byCapability, byModel, byProvider, byError, estimate })
  } catch (e) {
    return handleRouteError("api.projects.runtime.usage", e)
  }
}
