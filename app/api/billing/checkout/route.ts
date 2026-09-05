import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/session"
import { getDodoConfig, getAppUrl } from "@/lib/env"
import { SUBSCRIPTION_PLANS, PERMANENT_CREDIT_PACKS } from "@/lib/billing/config"
import { logger } from "@/lib/logging/logger"
import {
  getOrCreateSubscriptionProduct,
  getOrCreatePermanentProduct,
} from "@/lib/billing/dodo-service"
import { checkoutSessionLocks, checkoutRateLimiter } from "@/lib/cache/locks"
import { detectCountryFromRequest, resolveBillingCurrency } from "@/lib/billing/currency"

/**
 * Create a Dodo Payments checkout session.
 *
 * Flow:
 * 1. Frontend sends POST with product details
 * 2. Backend auto-provisions Dodo product if needed (or uses cached ID)
 * 3. Backend creates Dodo checkout session via SDK
 * 4. Backend returns checkout_url to frontend
 * 5. Frontend redirects user to Dodo checkout
 * 6. Dodo handles payment → sends webhook → we grant credits
 *
 * Features:
 * - Auto-creates Dodo products if they don't exist in the environment
 * - Rate limits to prevent duplicate product creation
 * - Rate limits to prevent duplicate checkout attempts per user
 * - In-memory caching of created product IDs (5 min TTL)
 *
 * @see https://docs.dodopayments.com/developer-resources/checkout-session
 */

export const runtime = "nodejs"

interface CheckoutRequest {
  /** 'subscription' for plan purchases, 'permanent' for credit pack purchases */
  type: "subscription" | "permanent"
  /** Plan ID (for subscriptions) or pack ID (for permanent credits) */
  productId: string
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 },
      )
    }

    const body = (await req.json()) as CheckoutRequest

    if (!body.type || !body.productId) {
      return NextResponse.json(
        { ok: false, error: { code: "INVALID_REQUEST", message: "type and productId are required" } },
        { status: 400 },
      )
    }

    // ─── Rate limit: prevent duplicate checkout attempts per user+product ───
    // Window is 15s (long enough to cover a Dodo API round-trip) with a limit
    // of 2 so a genuine double-click is absorbed but a second deliberate attempt
    // after the first one fails is still allowed.
    const rateLimitKey = `${body.type}:${body.productId}:${user.id}`
    if (!checkoutRateLimiter.allowed(rateLimitKey)) {
      return NextResponse.json(
        { ok: false, error: { code: "RATE_LIMITED", message: "A checkout is already in progress. Please wait a moment before trying again." } },
        { status: 429 },
      )
    }

    const { apiKey, environment } = getDodoConfig()

    // Detect the user's country and resolve the preferred billing currency.
    // Dodo's Adaptive Currency feature will display prices in the local currency
    // and unlock local payment methods. Falls back to USD if country is unknown
    // or the currency isn't in Dodo's supported list.
    const countryCode = await detectCountryFromRequest(req)
    const billingCurrency = resolveBillingCurrency(countryCode)

    logger.info("checkout", "Resolved billing currency", {
      userId: user.id,
      countryCode,
      billingCurrency: billingCurrency ?? "USD (base)",
    })

    // Dynamically import dodopayments to avoid SSR issues
    const { default: DodoPayments } = await import("dodopayments")
    const client = new DodoPayments({
      bearerToken: apiKey,
      environment: environment as "test_mode" | "live_mode",
    })

    const returnUrl = `${getAppUrl()}/settings/billing`

    // Use a lock to deduplicate concurrent checkout requests for the same user+product.
    // acquire() returns null if the lock is already held — we return 429 and the
    // client shows a friendly message. The lock is always released in the finally block.
    const sessionLockKey = `checkout:${body.type}:${body.productId}:${user.id}`
    const releaseSessionLock = checkoutSessionLocks.acquire(sessionLockKey)
    if (releaseSessionLock === null) {
      return NextResponse.json(
        { ok: false, error: { code: "BUSY", message: "A checkout session is already being created. Please wait a moment." } },
        { status: 429 },
      )
    }

    try {
      if (body.type === "subscription") {
        const plan = SUBSCRIPTION_PLANS.find((p) => p.id === body.productId)
        if (!plan) {
          return NextResponse.json(
            { ok: false, error: { code: "INVALID_REQUEST", message: "Unknown plan ID" } },
            { status: 400 },
          )
        }

        // Auto-provision the product if not configured
        const product = await getOrCreateSubscriptionProduct(
          plan.id,
          `MirrorSite AI — ${plan.name}`,
          `${plan.mirrorCredits.toLocaleString()} MirrorSite Credits per month. ${plan.name} plan.`,
          plan.priceUSD,
          plan.mirrorCredits,
        )

        logger.info("checkout", "Creating subscription checkout session", {
          userId: user.id,
          planId: plan.id,
          productId: product.productId,
          autoCreated: !plan.dodoProductId,
        })

        const session = await client.checkoutSessions.create({
          product_cart: [{ product_id: product.productId, quantity: 1 }],
          return_url: returnUrl,
          ...(billingCurrency ? { billing_currency: billingCurrency } : {}),
          metadata: {
            userId: user.id,
            type: "subscription",
            planId: plan.id,
            credits: String(plan.mirrorCredits),
          },
        })

        return NextResponse.json({
          ok: true,
          data: { checkoutUrl: session.checkout_url, sessionId: session.session_id },
        })
      }

      if (body.type === "permanent") {
        const pack = PERMANENT_CREDIT_PACKS.find((p) => p.id === body.productId)
        if (!pack) {
          return NextResponse.json(
            { ok: false, error: { code: "INVALID_REQUEST", message: "Unknown credit pack ID" } },
            { status: 400 },
          )
        }

        // Auto-provision the product if not configured
        const product = await getOrCreatePermanentProduct(
          pack.id,
          `MirrorSite AI — ${pack.label}`,
          `${pack.credits.toLocaleString()} permanent MirrorSite Credits. Never expire.`,
          pack.priceUSD,
          pack.credits,
        )

        logger.info("checkout", "Creating permanent credit checkout session", {
          userId: user.id,
          packId: pack.id,
          productId: product.productId,
          autoCreated: !pack.dodoProductId,
        })

        const session = await client.checkoutSessions.create({
          product_cart: [{ product_id: product.productId, quantity: 1 }],
          return_url: returnUrl,
          ...(billingCurrency ? { billing_currency: billingCurrency } : {}),
          metadata: {
            userId: user.id,
            type: "permanent",
            packageId: pack.id,
            credits: String(pack.credits),
          },
        })

        return NextResponse.json({
          ok: true,
          data: { checkoutUrl: session.checkout_url, sessionId: session.session_id },
        })
      }

      return NextResponse.json(
        { ok: false, error: { code: "INVALID_REQUEST", message: "Invalid checkout type" } },
        { status: 400 },
      )
    } finally {
      releaseSessionLock?.()
    }
  } catch (error) {
    logger.error("checkout", "Failed to create checkout session", {
      error: error instanceof Error ? error.message : String(error),
      userId: (error instanceof Error && error.message.includes("UNAUTHORIZED")) ? "unknown" : "unknown",
    })
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "Failed to create checkout session" } },
      { status: 500 },
    )
  }
}
