/**
 * Internal API: Get user credit balance by email
 * GET /api/internal/credits?email=<email>
 *
 * Called by ATAI WEB to check MirrorSite credit balance
 * Auth: x-internal-key header
 */

import { NextRequest } from "next/server"
import { findUserByEmail } from "@/lib/auth/users"
import { getAvailableCredits } from "@/lib/billing/credit-service"
import { ok, fail, handleRouteError } from "@/lib/api/respond"

export async function GET(req: NextRequest) {
  try {
    // Auth check
    const internalKey = process.env.ATAI_INTERNAL_KEY
    if (!internalKey) {
      return fail("PROVIDER_NOT_CONFIGURED", "Internal API key is not configured.", 503)
    }

    const providedKey = req.headers.get("x-internal-key") || req.headers.get("X-Internal-Key")
    if (!providedKey || providedKey !== internalKey) {
      return fail("UNAUTHORIZED", "Invalid or missing internal API key.", 401)
    }

    // Get email parameter
    const email = req.nextUrl.searchParams.get("email")
    if (!email) {
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

    // Log for debugging
    console.log('[credits-api] User found:', {
      email,
      userId: user.id,
      userSubscriptionCredits: user.subscriptionCredits,
      userPermanentCredits: user.permanentCredits,
      userLegacyCredits: user.credits,
    })

    // Get credit balance
    const balance = await getAvailableCredits(user.id)

    console.log('[credits-api] Balance from getAvailableCredits:', {
      userId: user.id,
      balance,
    })

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
