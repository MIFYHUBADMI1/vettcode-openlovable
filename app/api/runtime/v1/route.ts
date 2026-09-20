import { authenticateRuntimeRequest } from "@/lib/runtime/auth/authenticate"
import {
  routeRuntimeRequest,
  routingFailureToAppError,
  RoutingError,
} from "@/lib/runtime/router/router"
import { listCapabilities } from "@/lib/runtime/router/capability-registry"
import { registerAllRuntimeAdapters } from "@/lib/runtime/router/adapters/register-all"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { tryAcquireRuntimeSlot, releaseRuntimeSlot } from "@/lib/runtime/concurrency"
import { enforceProjectRuntimeLimits } from "@/lib/runtime/control/enforce-limits"

/**
 * Atai Runtime API — versioned route boundary (Phase 5).
 *
 * POST /api/runtime/v1
 *   Body: { capability, operation, input?, metadata? }
 *
 * The route is deliberately thin: authentication (Phase 4) → router
 * (Phase 5). No provider logic lives here; capability endpoints and real
 * adapters arrive in Phase 6+. This route exists under the /api/runtime/v1/
 * namespace that proxy.ts excludes from session-cookie gating (Bearer-key
 * authentication domain, documented in Phase 4).
 *
 * GET /api/runtime/v1
 *   Public capability discovery: which capabilities/operations the runtime
 *   knows about. This is registry metadata only — it does NOT promise any
 *   provider can serve them (adapters decide that per request).
 */

// Phase 6/10: register ALL production adapters (OpenRouter, ElevenLabs,
// Firecrawl, Resend, Twilio, Firebase, Mapbox) with the Phase 5 provider
// registry — one idempotent call, no router changes. Module top-level runs
// once per server process, before any request is routed.
registerAllRuntimeAdapters()

/** Hard cap on untrusted runtime JSON (Phase 11 resource exhaustion). */
const MAX_RUNTIME_BODY_BYTES = 256 * 1024

export async function POST(req: Request) {
  let slot = false
  try {
    const contentLength = req.headers.get("content-length")
    if (contentLength && Number(contentLength) > MAX_RUNTIME_BODY_BYTES) {
      return fail("runtime_invalid_request", "The request body is too large.", 413)
    }

    // 1–2. Phase 4 authentication → trusted context (reused, not duplicated).
    const auth = await authenticateRuntimeRequest(req)

    await enforceProjectRuntimeLimits(auth)

    // Process-wide cap: hold the slot only after auth so invalid keys cannot
    // occupy provider-capacity. Fail-fast 429 — do not queue.
    slot = tryAcquireRuntimeSlot()
    if (!slot) {
      return fail("runtime_rate_limited", "The runtime is at capacity. Please retry shortly.", 429)
    }

    // 3. Parse the untrusted body (kept separate from trusted identity).
    const raw = await req.text().catch(() => "")
    if (raw.length > MAX_RUNTIME_BODY_BYTES) {
      return fail("runtime_invalid_request", "The request body is too large.", 413)
    }
    let body: unknown = null
    try {
      body = raw ? JSON.parse(raw) : null
    } catch {
      body = null
    }
    if (body === null) {
      return fail("runtime_invalid_request", "A JSON request body is required.", 422)
    }

    // 4–7. Router lifecycle: validate → capability/operation → scope →
    //      resolve → execute → normalize.
    const response = await routeRuntimeRequest(auth, body, auth.requestId)

    return ok(response)
  } catch (e) {
    // Router-level failures map onto the Phase 2 runtime taxonomy, then flow
    // through the existing error envelope — no second response system.
    if (e instanceof RoutingError) {
      const mapped = routingFailureToAppError(e)
      return fail(mapped.code, mapped.message, mapped.status)
    }
    return handleRouteError("api.runtime.v1", e)
  } finally {
    if (slot) releaseRuntimeSlot()
  }
}

export async function GET() {
  // Registry metadata only — not a promise of provider availability.
  return ok({ capabilities: listCapabilities() })
}
