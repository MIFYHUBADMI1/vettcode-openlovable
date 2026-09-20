import { requireUser } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { revokeApiKey } from "@/lib/runtime/keys/service"
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
 * DELETE /api/runtime/keys/:keyId
 * Revoke a key. The historical record is preserved (status → "revoked");
 * revoked keys can never authenticate runtime requests.
 * Body (optional): { reason?: string } — sanitized server-side.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ keyId: string }> }) {
  try {
    const user = await requireUser()
    const { keyId } = await params

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
