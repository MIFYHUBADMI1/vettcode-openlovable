import { ok, handleRouteError } from "@/lib/api/respond"
import { requireOwnedProject } from "@/lib/runtime/control/owner"
import { getProjectRuntimeConfig } from "@/lib/runtime/control/config-store"
import { summarizeProjectUsage, projectHealthSnapshot } from "@/lib/runtime/control/analytics"
import { visibleModelCatalog } from "@/lib/runtime/control/models"
import { listApiKeys } from "@/lib/runtime/keys/service"
import { getProvisioningStatus } from "@/lib/runtime/provisioning"
import { getBalance } from "@/lib/billing/credit-service"
import { listCapabilities } from "@/lib/runtime/router/capability-registry"
import { getRuntimeMaxInFlight } from "@/lib/runtime/concurrency"
import {
  PLATFORM_RUNTIME_REQUESTS_PER_MINUTE,
} from "@/lib/runtime/platform-limits"

/**
 * GET /api/projects/:id/runtime/control
 * Founder overview: keys, usage, credits, health, config — no secrets.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const gate = await requireOwnedProject(id)
    if (!gate.ok) return gate.response

    const now = Date.now()
    const dayAgo = now - 24 * 60 * 60 * 1000

    const [keys, usage24h, health, config, development, production, balance] = await Promise.all([
      listApiKeys(gate.user.id, id),
      summarizeProjectUsage(id, { from: dayAgo, to: now }),
      projectHealthSnapshot(id),
      getProjectRuntimeConfig(id),
      getProvisioningStatus(id, "development"),
      getProvisioningStatus(id, "production"),
      getBalance(gate.user.id),
    ])

    const activeKeys = keys.filter((k) => k.status === "active")

    return ok({
      keys: {
        total: keys.length,
        active: activeKeys.length,
        byEnvironment: {
          development: activeKeys.filter((k) => k.environment === "development").length,
          production: activeKeys.filter((k) => k.environment === "production").length,
        },
      },
      usage24h,
      credits: {
        total: balance.total,
        subscription: balance.subscription,
        permanent: balance.permanent,
      },
      health,
      config,
      provisioning: {
        development: development ?? { status: "NOT_PROVISIONED" },
        production: production ?? { status: "NOT_PROVISIONED" },
      },
      platform: {
        requestsPerMinute: PLATFORM_RUNTIME_REQUESTS_PER_MINUTE,
        maxInFlightPerProcess: getRuntimeMaxInFlight(),
        defaultModel: process.env.OPENROUTER_DEFAULT_MODEL || null,
        sdkVersion: "1.0.0",
        catalog: visibleModelCatalog(process.env.OPENROUTER_DEFAULT_MODEL),
        capabilities: listCapabilities(),
      },
    })
  } catch (e) {
    return handleRouteError("api.projects.runtime.control", e)
  }
}
