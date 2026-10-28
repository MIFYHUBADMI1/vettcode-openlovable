/**
 * Internal API: Get user credit balance by email
 * GET /api/internal/credits?email=<email>
 *
 * Called by ATAI WEB to check Atai Credit balance
 * Auth: x-internal-key header
 */

import { NextRequest } from "next/server"
import { findUserByEmail } from "@/lib/auth/users"
import { getAvailableCredits } from "@/lib/billing/credit-service"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { authorizeInternalRequest } from "@/lib/api/internal-key"
import { checkInternalLimit } from "@/lib/api/internal-limit"

export async function GET(req: NextRequest) {
  try {
    // Auth check — constant-time comparison, no key material in logs.
    const auth = authorizeInternalRequest(req.headers)
    if (!auth.ok) {
      return fail(auth.code, auth.message, auth.status)
    }
    await checkInternalLimit(req.headers)

    // Get email parameter
    const email = req.nextUrl.searchParams.get("email")
    if (!email || email.length > 254) {
      return fail("VALIDATION", "email query parameter is required.", 422)
    }

    // Find user
    const user = await findUserByEmail(email)
    if (!user) {
      return ok({
        hasAccount: false,
        credits: 0,
        subscriptionCredits: 0,
        permanentCredits: 0,
      })
    }

    // Get credit balance
    const balance = await getAvailableCredits(user.id)

    return ok({
      hasAccount: true,
      credits: balance,
      subscriptionCredits: user.subscriptionCredits || 0,
      permanentCredits: user.permanentCredits || 0,
      userId: user.id,
    })
  } catch (e) {
    return handleRouteError("api.internal.credits", e)
  }
}
