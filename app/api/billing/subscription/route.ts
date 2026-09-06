import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/session"
import { subscriptionRecordsCol } from "@/lib/db/collections"
import { getDodoClient } from "@/lib/billing/dodo-service"
import { logger } from "@/lib/logging/logger"

/**
 * POST /api/billing/subscription/cancel
 * Cancel a user's active subscription (prevents renewal at period end)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get the user's active subscription
    const col = await subscriptionRecordsCol()
    const subscription = await col.findOne({
      userId: user.id,
      status: { $in: ["active", "trialing"] },
    })

    if (!subscription) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 },
      )
    }

    // Check if already scheduled for cancellation
    if (subscription.cancelAtPeriodEnd) {
      return NextResponse.json(
        { error: "Subscription is already scheduled for cancellation" },
        { status: 400 },
      )
    }

    // Cancel via Dodo API
    const client = await getDodoClient()
    await client.subscriptions.update(subscription.dodoSubscriptionId, {
      cancel_at_next_billing_date: true,
      cancel_reason: "cancelled_by_customer",
    })

    // Update our database
    await col.updateOne(
      { dodoSubscriptionId: subscription.dodoSubscriptionId },
      {
        $set: {
          cancelAtPeriodEnd: true,
          updatedAt: Date.now(),
        },
      },
    )

    logger.info("subscription.cancel", "User cancelled subscription", {
      userId: user.id,
      subscriptionId: subscription.dodoSubscriptionId,
      planId: subscription.planId,
      periodEnd: subscription.currentPeriodEnd,
    })

    return NextResponse.json({
      success: true,
      message: "Subscription cancelled successfully. You will retain access until the end of your billing period.",
      periodEnd: subscription.currentPeriodEnd,
    })
  } catch (error) {
    logger.error("subscription.cancel", "Failed to cancel subscription", {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      {
        error: "Failed to cancel subscription. Please try again or contact support.",
      },
      { status: 500 },
    )
  }
}