import { requireAdmin } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import {
  listAdminRuntimePricingRules,
  createAdminRuntimePricingRule,
  parseCreateRuleInput,
} from "@/lib/runtime/admin/pricing-service"
import { listCapabilities } from "@/lib/runtime/router/capability-registry"
import { listProviders } from "@/lib/runtime/router/provider-registry"
// Phase 10 §54: the admin pricing API validates rules against the LIVE
// provider registry, so the production adapters must be registered in this
// process too (idempotent — same guard as the runtime route).
import { registerAllRuntimeAdapters } from "@/lib/runtime/router/adapters/register-all"
import { RUNTIME_PRICING_VERSION } from "@/lib/billing/runtime-config"

registerAllRuntimeAdapters()

export async function GET() {
  try {
    await requireAdmin()

    const [rules] = await Promise.all([listAdminRuntimePricingRules()])

    return ok({
      rules,
      // Vocabularies for the admin form (server-authoritative).
      capabilities: listCapabilities().map((c) => ({ id: c.id, operations: [...c.operations] })),
      providers: listProviders(),
      pricingVersion: RUNTIME_PRICING_VERSION,
      // Resolution documentation for the admin UI (Phase 9.5 §8/§35).
      resolution: "active rule (provider+capability+operation) → legacy flat pricing → deny (unconfigured)",
    })
  } catch (e) {
    return handleRouteError("api.admin.runtime.pricing", e)
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()

    const body = (await req.json().catch(() => null)) as unknown
    const parsed = parseCreateRuleInput(body)
    if (!parsed.ok) return fail("VALIDATION", parsed.error, 422)

    const result = await createAdminRuntimePricingRule({ adminId: admin.id, input: parsed.data })
    if (!result.ok) return fail("VALIDATION", result.error, result.status)

    return ok({ rule: result.rule })
  } catch (e) {
    return handleRouteError("api.admin.runtime.pricing", e)
  }
}
