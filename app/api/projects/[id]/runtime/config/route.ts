import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { requireOwnedProject } from "@/lib/runtime/control/owner"
import {
  getProjectRuntimeConfig,
  patchProjectRuntimeConfig,
  ConfigValidationError,
} from "@/lib/runtime/control/config-store"
import { visibleModelCatalog } from "@/lib/runtime/control/models"
import {
  PLATFORM_RUNTIME_REQUESTS_PER_MINUTE,
  PLATFORM_RUNTIME_REQUESTS_PER_DAY_MAX,
} from "@/lib/runtime/platform-limits"
import { getRuntimeMaxInFlight } from "@/lib/runtime/concurrency"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const gate = await requireOwnedProject(id)
    if (!gate.ok) return gate.response

    const config = await getProjectRuntimeConfig(id)
    return ok({
      config,
      platform: {
        requestsPerMinute: PLATFORM_RUNTIME_REQUESTS_PER_MINUTE,
        requestsPerDayMax: PLATFORM_RUNTIME_REQUESTS_PER_DAY_MAX,
        maxInFlightPerProcess: getRuntimeMaxInFlight(),
        defaultModel: process.env.OPENROUTER_DEFAULT_MODEL || null,
        catalog: visibleModelCatalog(process.env.OPENROUTER_DEFAULT_MODEL),
      },
    })
  } catch (e) {
    return handleRouteError("api.projects.runtime.config.get", e)
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const gate = await requireOwnedProject(id)
    if (!gate.ok) return gate.response

    await checkRateLimit({
      action: "runtime_config_patch",
      identifier: gate.user.id,
      limit: 60,
      windowMs: 24 * 60 * 60 * 1000,
    })

    const body = await req.json().catch(() => ({}))
    const config = await patchProjectRuntimeConfig(gate.user.id, id, body)
    return ok({ config })
  } catch (e) {
    if (e instanceof ConfigValidationError) {
      return fail("VALIDATION", e.message, 422)
    }
    return handleRouteError("api.projects.runtime.config.patch", e)
  }
}
