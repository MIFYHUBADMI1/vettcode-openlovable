import { requireUser } from "@/lib/auth/session"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { checkProjectOwnership } from "@/lib/runtime/ownership"
import { createApiKey, listApiKeys } from "@/lib/runtime/keys/service"
import { ApiKeyCreateBodySchema } from "@/runtime/contracts/validation"
import { ApiKeyCreateInputSchema } from "@/runtime/contracts/capabilities"

/**
 * Atai Runtime — API-key management endpoints (dashboard-facing).
 *
 * These are MANAGEMENT routes (session cookie authenticated), deliberately
 * separate from the future public runtime invocation API (Bearer-key
 * authenticated, later phase). Bearer runtime traffic is not accepted here.
 *
 * Ownership: userId always comes from the Atai session (`requireUser`) and
 * projectId from the URL path — body-supplied ownership fields are rejected
 * by ApiKeyCreateBodySchema (strict + z.never).
 */

/**
 * GET /api/runtime/keys?projectId=<id>
 * List the caller's keys for a project (metadata only — no secret, no hash).
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser()
    const projectId = new URL(req.url).searchParams.get("projectId")
    if (!projectId) return fail("VALIDATION", "projectId query parameter is required.", 422)

    const ownership = await checkProjectOwnership(user.id, projectId)
    if (!ownership.ok) {
      // Same response for "not found" and "not owned" — no existence leak.
      return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    }

    const keys = await listApiKeys(user.id, projectId)
    return ok({ keys })
  } catch (e) {
    return handleRouteError("api.runtime.keys.list", e)
  }
}

/**
 * POST /api/runtime/keys?projectId=<id>
 * Create a key. Body: { name?, environment, scopes?, expiresAt? }.
 * Returns the plaintext secret EXACTLY ONCE — never retrievable again.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser()

    // Management-operation throttle reusing the existing limiter (Phase 3 §29).
    await checkRateLimit({
      action: "runtime_key_create",
      identifier: user.id,
      limit: 20,
      windowMs: 24 * 60 * 60 * 1000,
    })

    const projectId = new URL(req.url).searchParams.get("projectId")
    if (!projectId) return fail("VALIDATION", "projectId query parameter is required.", 422)

    const body = await req.json().catch(() => ({}))
    const parsedBody = ApiKeyCreateBodySchema.safeParse(body)
    if (!parsedBody.success) {
      return fail("VALIDATION", "Invalid key creation request.", 422)
    }

    // Server-side ownership: session user must own the project.
    const ownership = await checkProjectOwnership(user.id, projectId)
    if (!ownership.ok) {
      return fail("UNAUTHORIZED_PROJECT_ACCESS", "We couldn't find this project.", 404)
    }

    // Service-level validation (scopes/environment/expiry) via the Phase 2 contract.
    const input = ApiKeyCreateInputSchema.safeParse({
      projectId,
      environment: parsedBody.data.environment,
      scopes: parsedBody.data.scopes ?? [],
      name: parsedBody.data.name,
      expiresAt: parsedBody.data.expiresAt,
    })
    if (!input.success) {
      return fail("VALIDATION", "Invalid key parameters (scopes or expiry).", 422)
    }

    const created = await createApiKey(user.id, input.data)

    // `secret` appears here and ONLY here — the one-time response.
    return ok(created, { status: 201 })
  } catch (e) {
    return handleRouteError("api.runtime.keys.create", e)
  }
}
