import { ObjectId } from "mongodb"
import { requireAdmin } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { usersCol } from "@/lib/db/collections"
import { logger } from "@/lib/logging/logger"
import { grantCredits } from "@/lib/billing/credit-service"
import { cryptoId } from "@/lib/store/store"

/** Admin endpoint: grant credits to yourself for testing. */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()

    const body = (await req.json().catch(() => ({}))) as {
      amount?: number
    }

    if (!body.amount || body.amount <= 0) {
      return fail("VALIDATION", "Amount must be a positive number.", 422)
    }
    if (body.amount > 1_000_000) {
      return fail("VALIDATION", "Amount exceeds maximum of 1,000,000 credits per operation.", 422)
    }

    // Use credit-service to grant credits
    const reason = `Admin self-credit: ${body.amount.toLocaleString()} credits`
    await grantCredits({
      userId: admin.id,
      amount: body.amount,
      creditType: "permanent",
      transactionType: "admin_adjustment",
      idempotencyKey: cryptoId(),
      metadata: {
        reason,
        adminId: admin.id,
        selfGrant: true,
      },
    })

    const col = await usersCol()
    const updatedUser = await col.findOne({ id: admin.id })
    const newBalance = updatedUser?.credits ?? 0

    logger.info("admin.self_credit", "granted credits to self", {
      adminId: admin.id,
      amount: body.amount,
      newBalance,
    })

    return ok({
      message: `Granted ${body.amount.toLocaleString()} credits.`,
      newBalance,
    })
  } catch (e) {
    return handleRouteError("api.admin.self_credit", e)
  }
}
