import { requireUser } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { getTopUp } from "@/lib/billing/topup-service"
import { verifyPayment } from "@/lib/billing/verify-payment"
import { awardCredits } from "@/lib/billing/topup-service"
import { topupsCol } from "@/lib/db/collections"
import { PAYMENT_RECIPIENT } from "@/lib/billing/packages"
import { analyzePaymentScreenshot } from "@/lib/billing/verify-payment"
import { logger } from "@/lib/logging/logger"

/** Retry payment verification for a pending top-up. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const topUp = await getTopUp(id, user.id)

    if (!topUp) {
      return fail("NOT_FOUND", "Top-up not found.", 404)
    }

    if (topUp.status === "approved") {
      return ok({ topUp: { status: "approved", message: "Payment already approved." } })
    }

    if (topUp.status === "cancelled" || topUp.status === "expired") {
      return fail("VALIDATION", "This top-up is no longer active.", 422)
    }

    if (!topUp.evidenceFileIds.length) {
      return fail("VALIDATION", "Please upload a payment screenshot first.", 422)
    }

    // If AI analysis hasn't completed yet, return analyzing status
    if (!topUp.aiAnalysis) {
      return ok({ topUp: { status: "analyzing", message: "Payment analysis in progress..." } })
    }

    // Re-run verification
    const decision = await verifyPayment(id)

    if (decision.approved) {
      const awarded = await awardCredits(id, "system")
      if (awarded) {
        return ok({ topUp: { status: "approved", message: "Payment verified! Credits have been added to your account." } })
      }
    }

    // Update status
    const col = await topupsCol()
    await col.updateOne(
      { id },
      { $set: { status: decision.status, rejectionReason: decision.reasons.join("; "), updatedAt: Date.now() } },
    )

    return ok({
      topUp: {
        status: decision.status,
        message: decision.status === "manual_review"
          ? "Your payment has been sent for review."
          : decision.status === "amount_mismatch"
            ? "The payment amount doesn't match the selected package."
            : decision.status === "duplicate"
              ? "This transaction has already been used."
              : "We couldn't verify this payment automatically.",
        reasons: decision.reasons,
      },
    })
  } catch (e) {
    return handleRouteError("api.billing.topup.verify", e)
  }
}
