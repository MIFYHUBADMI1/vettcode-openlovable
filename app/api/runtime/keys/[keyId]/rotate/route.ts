import { requireUser } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { rotateApiKey } from "@/lib/runtime/keys/rotate"

/**
 * POST /api/runtime/keys/:keyId/rotate
 *
 * Atomically replaces an owned, active key with a new one (fresh secret,
 * linked lineage). The NEW plaintext secret is returned EXACTLY ONCE, here.
 * The old secret becomes permanently unusable.
 *
 * Failure modes are stable and machine-readable:
 *   404 RUNTIME_KEY_NOT_FOUND / RUNTIME_KEY_NOT_ACTIVE — missing, not owned,
 *     already revoked/expired, or lost a concurrent-rotation race (all one
 *     response; no key-state or existence leak).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ keyId: string }> }) {
  try {
    const user = await requireUser()

    await checkRateLimit({
      action: "runtime_key_rotate",
      identifier: user.id,
      limit: 20,
      windowMs: 24 * 60 * 60 * 1000,
    })

    const { keyId } = await params

    const rotated = await rotateApiKey({
      userId: user.id,
      keyId,
      reason: "manual_rotation",
    })

    return ok(rotated, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : ""
    if (
      message === "RUNTIME_KEY_NOT_ACCESSIBLE" ||
      message === "RUNTIME_KEY_NOT_ACTIVE" ||
      message === "RUNTIME_KEY_CONCURRENT_MODIFICATION"
    ) {
      return fail("RUNTIME_KEY_NOT_FOUND", "Key not found, inactive, or already rotated.", 404)
    }
    return handleRouteError("api.runtime.keys.rotate", e)
  }
}
