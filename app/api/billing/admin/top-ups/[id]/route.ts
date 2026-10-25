import { requireAdmin } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { topupsCol, usersCol } from "@/lib/db/collections"

/**
 * @deprecated Legacy Mobile Money gateway is discontinued. Dodo Payments is
 * the only supported payment method.
 *
 * POST is disabled: historical top-ups can no longer be approved or rejected,
 * and this route can never grant credits. GET remains for read-only audit and
 * support access to historical records.
 */
export async function POST() {
  return fail(
    "DEPRECATED",
    "Mobile Money top-up approvals are no longer supported. Dodo Payments is the only payment method.",
    410,
  )
}

/** Admin endpoint: get detailed info for a specific top-up. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params

    const col = await topupsCol()
    const topUp = await col.findOne({ id })
    if (!topUp) {
      return fail("NOT_FOUND", "Top-up not found.", 404)
    }

    // Get user info
    const users = await usersCol()
    const topUpUser = await users.findOne({ id: topUp.userId })

    return ok({
      topUp: {
        id: topUp.id,
        userId: topUp.userId,
        userEmail: topUpUser?.email,
        userName: topUpUser?.name,
        packageId: topUp.packageId,
        credits: topUp.credits,
        expectedAmount: topUp.expectedAmount,
        paymentReference: topUp.paymentReference,
        payerPhone: topUp.payerPhone,
        paymentNetwork: topUp.paymentNetwork,
        status: topUp.status,
        evidenceFileIds: topUp.evidenceFileIds,
        aiAnalysis: topUp.aiAnalysis,
        verifiedAt: topUp.verifiedAt,
        verifiedBy: topUp.verifiedBy,
        rejectionReason: topUp.rejectionReason,
        createdAt: topUp.createdAt,
        updatedAt: topUp.updatedAt,
        expiresAt: topUp.expiresAt,
      },
    })
  } catch (e) {
    return handleRouteError("api.billing.admin.get", e)
  }
}
