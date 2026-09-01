import { requireAdmin } from "@/lib/auth/session"
import { ok, handleRouteError } from "@/lib/api/respond"
import { listPendingTopUps } from "@/lib/billing/topup-service"
import { usersCol } from "@/lib/db/collections"

/** Admin endpoint: list pending top-ups for manual review. */
export async function GET() {
  try {
    await requireAdmin()

    const topUps = await listPendingTopUps(50)

    // Enrich with user info
    const users = await usersCol()
    const userIds = [...new Set(topUps.map((t) => t.userId))]
    const userDocs = await users.find({ id: { $in: userIds } }).toArray()
    const userMap = new Map(userDocs.map((u) => [u.id, u]))

    const enriched = topUps.map((t) => {
      const u = userMap.get(t.userId)
      return {
        id: t.id,
        userId: t.userId,
        userEmail: u?.email,
        userName: u?.name,
        packageId: t.packageId,
        credits: t.credits,
        expectedAmount: t.expectedAmount,
        paymentReference: t.paymentReference,
        payerPhone: t.payerPhone,
        paymentNetwork: t.paymentNetwork,
        status: t.status,
        evidenceFileIds: t.evidenceFileIds,
        aiAnalysis: t.aiAnalysis,
        verifiedAt: t.verifiedAt,
        verifiedBy: t.verifiedBy,
        rejectionReason: t.rejectionReason,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }
    })

    return ok({ topUps: enriched })
  } catch (e) {
    return handleRouteError("api.billing.admin.list", e)
  }
}
