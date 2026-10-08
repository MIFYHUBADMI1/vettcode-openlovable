import { requireUser } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { deleteApiKey, revokeApiKey } from "@/lib/runtime/keys/service"
import { getApiKeyMetadata } from "@/lib/runtime/keys/metadata"

/**
 * Atai Runtime — single-key management endpoints (dashboard-facing, session
 * authenticated). Metadata only; no operation on this path can ever return
 * a plaintext secret or keyHash.
 */

/**
 * GET /api/runtime/keys/:keyId
 * Retrieve one key's metadata. Ownership enforced in the service filter —
 * another user's key resolves to the same 404 as a missing one.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ keyId: string }> }) {
  try {
    const user = await requireUser()
    const { keyId } = await params

    const key = await getApiKeyMetadata(user.id, keyId)
    if (!key) return fail("RUNTIME_KEY_NOT_FOUND", "Key not found.", 404)

    return ok({ key })
  } catch (e) {
    return handleRouteError("api.runtime.keys.get", e)
  }
}

/**
 * DELETE /api/runtime/keys/:keyId            → revoke (default, historical record kept)
 * DELETE /api/runtime/keys/:keyId?permanent=1 → permanently delete the record
 *
 * Revoked keys can never authenticate runtime requests; deleted keys are
 * removed entirely. Ownership enforced in the service filter — another
 * user's keyId resolves to the same 404 as a missing one.
 * Body (optional, revoke only): { reason?: string } — sanitized server-side.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ keyId: string }> }) {
  try {
    const user = await requireUser()
    const { keyId } = await params
    const permanent = new URL(req.url).searchParams.get("permanent") === "1"

    if (permanent) {
      const deleted = await deleteApiKey(user.id, keyId)
      if (!deleted) {
        // Missing or not-owned — one stable response.
        return fail("RUNTIME_KEY_NOT_FOUND", "Key not found.", 404)
      }
      return ok({ id: keyId, status: "deleted" })
    }

    // Sanitize the reason: strip anything that could smuggle secrets or raw
    // error text into the audit metadata (Phase 3 §19/§27).
    let reason = "revoked"
    const body = await req.json().catch(() => ({})) as { reason?: unknown }
    if (typeof body.reason === "string" && body.reason.trim()) {
      reason = body.reason.trim().slice(0, 100).replace(/[\r\n]+/g, " ")
    }

    const revoked = await revokeApiKey(user.id, keyId, reason)
    if (!revoked) {
      // Missing, not-owned, or already revoked — one stable response.
      return fail("RUNTIME_KEY_NOT_FOUND", "Key not found or already revoked.", 404)
    }

    return ok({ id: keyId, status: "revoked" })
  } catch (e) {
    return handleRouteError("api.runtime.keys.revoke", e)
  }
}
