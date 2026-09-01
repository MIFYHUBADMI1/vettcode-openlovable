import { ObjectId } from "mongodb"
import { requireAdmin } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { usersCol, creditTransactionsCol } from "@/lib/db/collections"
import { cryptoId } from "@/lib/store/store"
import { logger } from "@/lib/logging/logger"

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

    const col = await usersCol()
    const result = await col.updateOne(
      { id: admin.id },
      { $inc: { credits: body.amount }, $set: { updatedAt: Date.now() } },
    )

    if (result.modifiedCount === 0) {
      return fail("NOT_FOUND", "User not found.", 404)
    }

    // Record transaction
    const txCol = await creditTransactionsCol()
    await txCol.insertOne({
      _id: new ObjectId(),
      id: cryptoId(),
      userId: admin.id,
      type: "grant",
      amount: body.amount,
      reason: `Admin self-credit: ${body.amount.toLocaleString()} credits`,
      createdAt: Date.now(),
    })

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
