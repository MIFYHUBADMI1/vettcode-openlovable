import { fail, handleRouteError } from "@/lib/api/respond"
import { requireOwnedProject } from "@/lib/runtime/control/owner"
import { buildUsageCsv, MAX_EXPORT_ROWS } from "@/lib/runtime/control/export"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { AppError } from "@/lib/errors"
import type { RuntimeEnvironment } from "@/runtime/contracts/capabilities"

/**
 * Bounded CSV export of runtime usage events for the Usage page.
 *
 * GET /api/projects/[id]/runtime/usage/export?environment=&status=&capability=&model=&apiKeyId=&requestId=&from=&to=
 *
 * - Session-authenticated + project-ownership-gated (same gate as the usage
 *   list route; no existence leak — 404 for missing/not-owned).
 * - Reuses the EXACT filter semantics of the usage list API.
 * - Hard-capped at MAX_EXPORT_ROWS newest rows; the response carries an
 *   explicit truncation marker row in-file and an X-Export-Truncated header
 *   so the UI can label the export honestly.
 * - Rate-limited per user: exports are heavier than JSON lists.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const gate = await requireOwnedProject(id)
    if (!gate.ok) return gate.response

    await checkRateLimit({
      action: "runtime-usage-export",
      identifier: gate.user.id,
      limit: 10,
      windowMs: 60_000,
      errorCode: "RATE_LIMITED",
    })

    const url = new URL(req.url)
    const from = url.searchParams.get("from")
    const to = url.searchParams.get("to")
    const fromN = from ? Number(from) : undefined
    const toN = to ? Number(to) : undefined
    if (from && !Number.isFinite(fromN)) return fail("VALIDATION", "Invalid from timestamp.", 422)
    if (to && !Number.isFinite(toN)) return fail("VALIDATION", "Invalid to timestamp.", 422)

    const envRaw = url.searchParams.get("environment")
    const statusRaw = url.searchParams.get("status")
    const environment =
      envRaw === "development" || envRaw === "production" ? (envRaw as RuntimeEnvironment) : undefined
    const status =
      statusRaw === "succeeded" || statusRaw === "failed" ? (statusRaw as "succeeded" | "failed") : undefined

    const { csv, filename, rowCount, totalMatching, truncated } = await buildUsageCsv(id, {
      from: fromN,
      to: toN,
      environment,
      capability: url.searchParams.get("capability") ?? undefined,
      model: url.searchParams.get("model") ?? undefined,
      apiKeyId: url.searchParams.get("apiKeyId") ?? undefined,
      requestId: url.searchParams.get("requestId") ?? undefined,
      status,
    })

    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename=${filename}`,
        "cache-control": "no-store",
        "x-export-rows": String(rowCount),
        "x-export-total-matching": String(totalMatching),
        "x-export-truncated": truncated ? "true" : "false",
        "x-export-max-rows": String(MAX_EXPORT_ROWS),
      },
    })
  } catch (e) {
    if (e instanceof AppError && e.code === "RATE_LIMITED") {
      return fail("RATE_LIMITED", "Too many exports. Please wait a minute and try again.", 429)
    }
    return handleRouteError("api.projects.runtime.usage.export", e)
  }
}
