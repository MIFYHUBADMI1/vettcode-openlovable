import { requireAdmin } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { awardCredits, rejectTopUp, getTopUp } from "@/lib/billing/topup-service"
import { topupsCol, usersCol } from "@/lib/db/collections"

/** Admin endpoint: approve or reject a specific top-up. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin()

    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as { action?: string; reason?: string }

    if (body.action !== "approve" && body.action !== "reject") {
      return fail("VALIDATION", "Action must be 'approve' or 'reject'.", 422)
    }

    const topUp = await getTopUp(id, "any") // Admin can access any top-up
    if (!topUp) {
      return fail("NOT_FOUND", "Top-up not found.", 404)
    }

    if (body.action === "approve") {
      const awarded = await awardCredits(id, user.id)
      if (awarded) {
        return ok({ message: "Top-up approved. Credits awarded.", status: "approved" })
      } else {
        return fail("VALIDATION", "Could not approve this top-up. It may have already been processed.", 422)
      }
    } else {
      const reason = (body.reason || "Rejected by administrator").slice(0, 500).trim()
      const rejected = await rejectTopUp(id, reason, user.id)
      if (rejected) {
        return ok({ message: "Top-up rejected.", status: "rejected" })
      } else {
        return fail("VALIDATION", "Could not reject this top-up.", 422)
      }
    }
  } catch (e) {
    return handleRouteError("api.billing.admin.action", e)
  }
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
