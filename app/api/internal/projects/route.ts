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

const Atai_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://Atai.atai.ink"

export async function GET(req: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const internalKey = process.env.ATAI_INTERNAL_KEY
    console.log('[internal-api] ATAI_INTERNAL_KEY configured:', !!internalKey, internalKey?.substring(0, 10) + '...')

    if (!internalKey) {
      console.error('[internal-api] ATAI_INTERNAL_KEY not configured in environment')
      return fail("PROVIDER_NOT_CONFIGURED", "Internal API key is not configured.", 503)
    }

    const providedKey = req.headers.get("x-internal-key") || req.headers.get("X-Internal-Key")
    console.log('[internal-api] Provided key:', !!providedKey, providedKey?.substring(0, 10) + '...')
    console.log('[internal-api] Keys match:', providedKey === internalKey)

    if (!providedKey || providedKey !== internalKey) {
      console.error('[internal-api] Auth failed - provided:', providedKey?.substring(0, 20), 'expected:', internalKey?.substring(0, 20))
      return fail("UNAUTHORIZED", "Invalid or missing internal API key.", 401)
    }

    // ── Input ───────────────────────────────────────────────────────────────
    const email = req.nextUrl.searchParams.get("email")
    if (!email || typeof email !== "string") {
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
