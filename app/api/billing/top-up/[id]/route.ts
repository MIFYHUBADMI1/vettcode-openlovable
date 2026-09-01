import { requireUser } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { getTopUp } from "@/lib/billing/topup-service"

/** Get the status and details of a specific top-up. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const topUp = await getTopUp(id, user.id)
    if (!topUp) {
      return fail("NOT_FOUND", "Top-up not found.", 404)
    }
    // Strip internal fields
    return ok({
      topUp: {
        id: topUp.id,
        packageId: topUp.packageId,
        credits: topUp.credits,
        expectedAmount: topUp.expectedAmount,
        paymentReference: topUp.paymentReference,
        payerPhone: topUp.payerPhone,
        paymentNetwork: topUp.paymentNetwork,
        status: topUp.status,
        aiAnalysis: topUp.aiAnalysis
          ? {
              confidence: topUp.aiAnalysis.confidence,
              recommendation: topUp.aiAnalysis.recommendation,
            }
          : null,
        rejectionReason: topUp.rejectionReason,
        createdAt: topUp.createdAt,
        expiresAt: topUp.expiresAt,
        verifiedAt: topUp.verifiedAt,
      },
    })
  } catch (e) {
    return handleRouteError("api.billing.topup.get", e)
  }
}
