import { ObjectId } from "mongodb"
import { requireAdmin } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { usersCol, creditTransactionsCol, sessionsCol } from "@/lib/db/collections"
import { cryptoId } from "@/lib/store/store"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { logger } from "@/lib/logging/logger"

/** Admin endpoint: get detailed user info. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const col = await usersCol()
    const user = await col.findOne({ id })
    if (!user) return fail("NOT_FOUND", "User not found.", 404)

    const txCol = await creditTransactionsCol()
    const transactions = await txCol
      .find({ userId: id })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray()

    return ok({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        authProvider: user.authProvider,
        emailVerified: user.emailVerified,
        credits: user.credits,
        isAdmin: user.isAdmin ?? false,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
      transactions: transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        reason: tx.reason,
        createdAt: tx.createdAt,
      })),
    })
  } catch (e) {
    return handleRouteError("api.admin.users.get", e)
  }
}

/** Admin endpoint: adjust a user's credits (grant or deduct). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    const { id } = await params

    // Prevent admins from modifying their own credits (privilege escalation guard)
    if (id === admin.id) {
      return fail("VALIDATION", "You cannot modify your own credits.", 422)
    }

    // Rate limit: max 20 credit adjustments per hour per admin
    await checkRateLimit({
      action: `admin_credit_adjust:${admin.id}`,
      identifier: admin.id,
      limit: 20,
      windowMs: 60 * 60 * 1000,
    })

    const body = (await req.json().catch(() => ({}))) as {
      action?: string
      amount?: number
      reason?: string
    }

    if (body.action !== "grant" && body.action !== "deduct") {
      return fail("VALIDATION", "Action must be 'grant' or 'deduct'.", 422)
    }
    if (!body.amount || body.amount <= 0) {
      return fail("VALIDATION", "Amount must be a positive number.", 422)
    }
    if (body.amount > 1_000_000) {
      return fail("VALIDATION", "Amount exceeds maximum of 1,000,000 credits per operation.", 422)
    }

    const col = await usersCol()
    const amount = body.action === "grant" ? body.amount : -body.amount

    // Atomic deduction: use $inc with a conditional to prevent race conditions.
    // For deductions, the update only applies if credits >= amount, preventing
    // double-spend from concurrent requests.
    if (body.action === "deduct") {
      const result = await col.updateOne(
        { id, credits: { $gte: body.amount } },
        { $inc: { credits: amount }, $set: { updatedAt: Date.now() } },
      )
      if (result.modifiedCount === 0) {
        const user = await col.findOne({ id })
        if (!user) return fail("NOT_FOUND", "User not found.", 404)
        return fail("VALIDATION", `Insufficient credits. User has ${user.credits.toLocaleString()} credits.`, 422)
      }
    } else {
      const result = await col.updateOne(
        { id },
        { $inc: { credits: amount }, $set: { updatedAt: Date.now() } },
      )
      if (result.modifiedCount === 0) {
        return fail("NOT_FOUND", "User not found.", 404)
      }
    }

    // Record transaction with admin info for audit trail
    const txCol = await creditTransactionsCol()
    await txCol.insertOne({
      _id: new ObjectId(),
      id: cryptoId(),
      userId: id,
      type: body.action === "grant" ? "grant" : "deduction",
      amount,
      reason: body.reason || `Admin ${body.action}: ${body.amount.toLocaleString()} credits`,
      createdAt: Date.now(),
    })

    const updatedUser = await col.findOne({ id })
    const newBalance = updatedUser?.credits ?? 0

    logger.info("admin.credit_adjust", `${body.action} credits`, {
      adminId: admin.id,
      targetUserId: id,
      amount: body.amount,
      action: body.action,
      reason: body.reason,
      newBalance,
    })

    return ok({
      message: `${body.action === "grant" ? "Granted" : "Deducted"} ${body.amount.toLocaleString()} credits.`,
      newBalance,
    })
  } catch (e) {
    return handleRouteError("api.admin.users.adjust", e)
  }
}

/** Admin endpoint: suspend, unsuspend, ban, unban, or delete a user. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    const { id } = await params

    if (id === admin.id) {
      return fail("VALIDATION", "You cannot perform this action on yourself.", 422)
    }

    const body = (await req.json().catch(() => ({}))) as {
      action?: string
      reason?: string
    }

    if (!body.action) {
      return fail("VALIDATION", "Action is required.", 422)
    }

    const col = await usersCol()
    const user = await col.findOne({ id, deletedAt: { $exists: false } })
    if (!user) return fail("NOT_FOUND", "User not found.", 404)

    // Prevent actions on other admins
    if (user.isAdmin && body.action !== "unsuspend" && body.action !== "unban") {
      return fail("VALIDATION", "Cannot perform this action on another admin.", 422)
    }

    const now = Date.now()
    const reason = body.reason || `Admin ${body.action}`

    switch (body.action) {
      case "suspend": {
        await col.updateOne(
          { id },
          { $set: { suspended: true, suspendedAt: now, suspendedReason: reason, updatedAt: now } },
        )
        // Revoke all sessions
        const sessCol = await sessionsCol()
        await sessCol.deleteMany({ userId: id })
        logger.info("admin.user_action", "suspended user", { adminId: admin.id, targetUserId: id, reason })
        return ok({ message: "User suspended. All sessions revoked." })
      }
      case "unsuspend": {
        await col.updateOne(
          { id },
          { $unset: { suspended: "", suspendedAt: "", suspendedReason: "" }, $set: { updatedAt: now } },
        )
        logger.info("admin.user_action", "unsuspended user", { adminId: admin.id, targetUserId: id })
        return ok({ message: "User unsuspended." })
      }
      case "ban": {
        await col.updateOne(
          { id },
          { $set: { banned: true, bannedAt: now, bannedReason: reason, updatedAt: now } },
        )
        // Revoke all sessions
        const sessCol = await sessionsCol()
        await sessCol.deleteMany({ userId: id })
        logger.info("admin.user_action", "banned user", { adminId: admin.id, targetUserId: id, reason })
        return ok({ message: "User banned. All sessions revoked." })
      }
      case "unban": {
        await col.updateOne(
          { id },
          { $unset: { banned: "", bannedAt: "", bannedReason: "" }, $set: { updatedAt: now } },
        )
        logger.info("admin.user_action", "unbanned user", { adminId: admin.id, targetUserId: id })
        return ok({ message: "User unbanned." })
      }
      case "revoke_sessions": {
        const sessCol = await sessionsCol()
        const result = await sessCol.deleteMany({ userId: id })
        logger.info("admin.user_action", "revoked sessions", { adminId: admin.id, targetUserId: id, count: result.deletedCount })
        return ok({ message: `Revoked ${result.deletedCount} session(s).` })
      }
      case "delete": {
        await col.updateOne(
          { id },
          {
            $set: {
              deletedAt: now,
              email: `deleted_${id}@deleted.mirrorsite.invalid`,
              name: "Deleted user",
              passwordHash: undefined,
              googleId: undefined,
              imageUrl: undefined,
              imageFileId: undefined,
              updatedAt: now,
            },
          },
        )
        // Revoke all sessions
        const sessCol = await sessionsCol()
        await sessCol.deleteMany({ userId: id })
        logger.info("admin.user_action", "deleted user", { adminId: admin.id, targetUserId: id })
        return ok({ message: "User permanently deleted." })
      }
      default:
        return fail("VALIDATION", `Unknown action: ${body.action}`, 422)
    }
  } catch (e) {
    return handleRouteError("api.admin.users.action", e)
  }
}
