import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { requireOwnedProject } from "@/lib/runtime/control/owner"
import { computeProjectEconomics } from "@/lib/finances/project-economics"

/**
 * GET /api/projects/:id/economics
 *
 * Phase 2 project economics: authoritative server-side accounting for one
 * project over a bounded window (max 90 days, clamped server-side).
 *
 * - Auth + ownership: requireOwnedProject — non-owners get 404 (existence is
 *   never leaked), same gate and error code as the runtime usage endpoint.
 * - The response is DATA ONLY: no dashboard/UI is built here (Phase 2 §3 F),
 *   and every figure follows the documented aggregate definitions in
 *   lib/finances/project-economics (ledger → credits, runtime_usage →
 *   provider cost per currency, recognized revenue explicitly not_supported).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const gate = await requireOwnedProject(id)
    if (!gate.ok) return gate.response

    const url = new URL(req.url)
    const from = url.searchParams.get("from")
    const to = url.searchParams.get("to")
    const fromN = from ? Number(from) : undefined
    const toN = to ? Number(to) : undefined
    if (from && !Number.isFinite(fromN)) return fail("VALIDATION", "Invalid from timestamp.", 422)
    if (to && !Number.isFinite(toN)) return fail("VALIDATION", "Invalid to timestamp.", 422)

    const economics = await computeProjectEconomics({
      projectId: id,
      // Owner-checked user: ledger queries additionally filter by userId
      // (defense-in-depth against cross-user attribution).
      userId: gate.user.id,
      ...(fromN !== undefined ? { from: fromN } : {}),
      ...(toN !== undefined ? { to: toN } : {}),
    })
    return ok(economics)
  } catch (e) {
    return handleRouteError("api.projects.economics.get", e)
  }
}
