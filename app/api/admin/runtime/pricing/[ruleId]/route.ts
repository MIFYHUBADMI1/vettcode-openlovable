import { requireAdmin } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import {
  updateAdminRuntimePricingRule,
  deactivateAdminRuntimePricingRule,
  parseUpdateRuleInput,
} from "@/lib/runtime/admin/pricing-service"
import { logger } from "@/lib/logging/logger"

/**
 * PATCH /api/admin/runtime/pricing/[ruleId]
 * Update a pricing rule's rates or active flag (mode/identity immutable).
 *
 * DELETE — soft-delete only: DEACTIVATES the rule (Phase 9.5 §11). Physical
 * deletion of financially relevant configuration is not offered; historical
 * charges carry their own pricing snapshots and never depend on this row.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ ruleId: string }> }) {
  try {
    const admin = await requireAdmin()
    const { ruleId } = await params

    const body = (await req.json().catch(() => null)) as unknown
    const parsed = parseUpdateRuleInput(body)
    if (!parsed.ok) return fail("VALIDATION", parsed.error, 422)
    if (Object.keys(parsed.data).length === 0) {
      return fail("VALIDATION", "No changes provided.", 422)
    }

    const result = await updateAdminRuntimePricingRule({ adminId: admin.id, ruleId, input: parsed.data })
    if (!result.ok) return fail("VALIDATION", result.error, result.status)

    return ok({ rule: result.rule })
  } catch (e) {
    return handleRouteError("api.admin.runtime.pricing", e)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ ruleId: string }> }) {
  try {
    const admin = await requireAdmin()
    const { ruleId } = await params

    const result = await deactivateAdminRuntimePricingRule({ adminId: admin.id, ruleId })
    if (!result.ok) return fail("VALIDATION", result.error, result.status)

    logger.info("api.admin.runtime.pricing", "runtime pricing rule deactivated", {
      adminId: admin.id,
      ruleId,
    })
    return ok({ rule: result.rule })
  } catch (e) {
    return handleRouteError("api.admin.runtime.pricing", e)
  }
}
