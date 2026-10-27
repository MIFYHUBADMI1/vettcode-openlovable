import { requireAdmin } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import {
  bulkUpsertAdminRuntimePricingRules,
  parseBulkRuleInput,
  MAX_BULK_PRICING_RULES,
} from "@/lib/runtime/admin/pricing-service"
// The bulk path validates specs against the LIVE registries, so the
// production adapters must be registered in this process too (idempotent).
import { registerAllRuntimeAdapters } from "@/lib/runtime/router/adapters/register-all"

registerAllRuntimeAdapters()

/**
 * POST /api/admin/runtime/pricing/bulk
 * Apply many pricing rules in one admin action (create-or-update per row).
 *
 * Server-side validation stays AUTHORITATIVE: each row is checked against the
 * live capability/provider registries and its mode/rates, and rejected
 * individually so one bad row never half-applies the batch. Rule identity
 * (provider+capability+operation) and mode remain immutable, exactly as on
 * the single-rule PATCH path.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()

    const body = (await req.json().catch(() => null)) as unknown
    const parsed = parseBulkRuleInput(body)
    if (!parsed.ok) return fail("VALIDATION", parsed.error, 422)

    const result = await bulkUpsertAdminRuntimePricingRules({ adminId: admin.id, specs: parsed.data.rules })
    return ok({ ...result, maxBulkRules: MAX_BULK_PRICING_RULES })
  } catch (e) {
    return handleRouteError("api.admin.runtime.pricing.bulk", e)
  }
}
