import { requireUser } from "@/lib/auth/session"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { store } from "@/lib/store/store"
import { checkProjectOwnership } from "@/lib/runtime/ownership"
import {
  ensureRuntimeProvisioned,
  getProvisioningStatus,
  RuntimeProvisioningError,
} from "@/lib/runtime/provisioning"
import { isTotalumConfigured } from "@/lib/integrations/totalum/service"
import type { RuntimeEnvironment } from "@/runtime/contracts/capabilities"

/**
 * Atai Runtime — project provisioning status & retry (dashboard-facing,
 * session authenticated). Phase 8 audit remediation: provisioning failures
 * recorded by the build/deploy lifecycle hooks need a programmatic repair
 * path ("retry from settings") that does not wait for the next build.
 *
 * SECURITY: ownership is derived from the session + existing project record
 * (checkProjectOwnership — fail closed). Responses carry SAFE METADATA ONLY
 * (statuses, non-secret key ids/prefixes, stable failure reasons) — never
 * plaintext keys, hashes, or provider credentials.
 */

const RUNTIME_ENVIRONMENTS: RuntimeEnvironment[] = ["development", "production"]

function isRuntimeEnvironment(value: unknown): value is RuntimeEnvironment {
  return value === "development" || value === "production"
}

/**
 * GET /api/projects/:id/runtime
 * Safe provisioning status for both environments (metadata only).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params

    const ownership = await checkProjectOwnership(user.id, id)
    if (!ownership.ok) {
      // Same response for "not found" and "not owned" — no existence leak.
      return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    }

    const [development, production] = await Promise.all([
      getProvisioningStatus(id, "development"),
      getProvisioningStatus(id, "production"),
    ])

    return ok({ development, production })
  } catch (e) {
    return handleRouteError("api.projects.runtime.status", e)
  }
}

/**
 * POST /api/projects/:id/runtime
 * Retry automatic runtime provisioning. Body (optional): { environment } —
 * omitted retries both environments. Idempotent: an existing valid credential
 * is reused, an undeliverable one is revoked and replaced (Phase 8 service
 * guarantees); this endpoint only decides WHEN the service runs.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()

    // Management-operation throttle, matching the runtime key-create route.
    await checkRateLimit({
      action: "runtime_provision_retry",
      identifier: user.id,
      limit: 20,
      windowMs: 24 * 60 * 60 * 1000,
    })

    const { id } = await params

    const ownership = await checkProjectOwnership(user.id, id)
    if (!ownership.ok) {
      return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    }

    const project = await store.getProject(id)
    if (!project) return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)

    if (!project.totalumProjectId) {
      return fail("NOT_BUILT", "This project hasn't been built yet.", 400)
    }
    if (!isTotalumConfigured()) {
      return fail("PROVIDER_NOT_CONFIGURED", "The secret store for generated applications is not connected.", 503)
    }

    const body = await req.json().catch(() => ({})) as { environment?: unknown }
    const environments: RuntimeEnvironment[] = isRuntimeEnvironment(body.environment)
      ? [body.environment]
      : RUNTIME_ENVIRONMENTS

    const results: Array<{
      environment: RuntimeEnvironment
      status: string
      reused: boolean
      apiKeyId?: string
      keyPrefix?: string
      error?: string
    }> = []

    for (const environment of environments) {
      try {
        // Non-secret result: { status, apiKeyId?, keyPrefix?, reused }.
        const result = await ensureRuntimeProvisioned(project, environment)
        results.push({ environment, ...result })
      } catch (e) {
        if (e instanceof RuntimeProvisioningError) {
          // Stable failure reason only — the error message carries no secrets
          // by construction ("Runtime credential provisioning failed...").
          results.push({ environment, status: "FAILED", reused: false, error: e.reason })
        } else {
          throw e
        }
      }
    }

    return ok({ results })
  } catch (e) {
    return handleRouteError("api.projects.runtime.retry", e)
  }
}
