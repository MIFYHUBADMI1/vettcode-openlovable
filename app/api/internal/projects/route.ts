/**
 * Internal API: List projects by user email.
 * GET /api/internal/projects?email=<email>
 *
 * This endpoint is called server-to-server by the ATAI.INK WEB app so it can
 * surface a user's Atai projects inside the VettCode dashboard.
 *
 * Auth: a shared secret passed in the X-Internal-Key header.
 * The secret must match the ATAI_INTERNAL_KEY environment variable — never
 * expose this key to the browser.
 */

import { NextRequest } from "next/server"
import { findUserByEmail } from "@/lib/auth/users"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { authorizeInternalRequest } from "@/lib/api/internal-key"
import { checkInternalLimit } from "@/lib/api/internal-limit"
import { getAppUrl } from "@/lib/env"

const Atai_URL = getAppUrl()

export async function GET(req: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    // Constant-time comparison; no key material (not even a prefix) is
    // logged or returned.
    const auth = authorizeInternalRequest(req.headers)
    if (!auth.ok) {
      return fail(auth.code, auth.message, auth.status)
    }
    await checkInternalLimit(req.headers)

    // ── Input ───────────────────────────────────────────────────────────────
    const email = req.nextUrl.searchParams.get("email")
    if (!email || email.length > 254) {
      return fail("VALIDATION", "email query parameter is required.", 422)
    }

    // ── Lookup ──────────────────────────────────────────────────────────────
    const user = await findUserByEmail(email)
    if (!user) {
      // Not an error — this user simply hasn't signed up for Atai yet.
      return ok({ projects: [], AtaiUrl: `${Atai_URL}/register` })
    }

    const projects = await store.listProjects(user.id)

    return ok({
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        mode: p.mode,
        state: p.state,
        sourceUrl: p.sourceUrl ?? null,
        updatedAt: p.updatedAt,
        url: `${Atai_URL}/project/${p.id}`,
      })),
      AtaiUrl: `${Atai_URL}/dashboard`,
      newProjectUrl: `${Atai_URL}/new`,
    })
  } catch (e) {
    return handleRouteError("api.internal.projects", e)
  }
}
