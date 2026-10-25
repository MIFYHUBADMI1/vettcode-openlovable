import { requireAdmin } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { reconcileFinances, MAX_WINDOW_SIZE } from "@/lib/finances/reconciliation"
import type { ReconciliationSeverity } from "@/lib/finances/reconciliation"

/**
 * Billing reconciliation endpoint (Phase 3 — Workstream E/G).
 *
 * The route is a thin, admin-only boundary over `lib/finances/reconciliation`:
 * it validates operator-supplied pagination/filter parameters and returns the
 * computed page. The service is READ-ONLY — this endpoint never repairs a
 * record, and there is intentionally no POST/PUT/DELETE here. Corrections go
 * through `/api/admin/billing/webhooks` (bounded recovery batches) or the
 * existing admin credit-adjustment path, both of which are idempotent and
 * state-validated.
 *
 * Findings carry identifiers, amounts and bookkeeping only; raw webhook
 * payloads are never surfaced (see the service's no-secret-leakage rule).
 */

const SEVERITIES: readonly ReconciliationSeverity[] = ["critical", "warning", "info"]

function clampInt(raw: string | null, fallback: number, max: number): number {
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(n, max)
}

export async function GET(req: Request) {
  try {
    await requireAdmin()

    const url = new URL(req.url)
    const windowSize = clampInt(url.searchParams.get("limit"), 250, MAX_WINDOW_SIZE)
    const cursor = url.searchParams.get("cursor")
    const userId = url.searchParams.get("userId")
    const severityParam = url.searchParams.get("severity")
    const severity = SEVERITIES.includes((severityParam ?? "") as ReconciliationSeverity)
      ? (severityParam as ReconciliationSeverity)
      : undefined
    const types = (url.searchParams.get("types") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20)

    const page = await reconcileFinances({
      windowSize,
      cursor: cursor && cursor.length <= 128 ? cursor : null,
      userId: userId && userId.length <= 128 ? userId : undefined,
      types,
      severity,
    })

    if (!page.readOnly) return fail("INTERNAL", "reconciliation reported a non read-only run")
    return ok(page)
  } catch (e) {
    return handleRouteError("api.admin.billing.reconciliation", e)
  }
}
