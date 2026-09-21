import "server-only"
import { requireUser } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { z } from "zod"
import {
  getPendingAction,
  claimPendingAction,
  finalizePendingAction,
  expireStalePendingActions,
} from "@/lib/cofounder/pending-actions"
import { getTool } from "@/lib/cofounder/tool-registry"
import { buildToolContext } from "@/lib/cofounder/context"
import type { ToolOutcome, CofounderConversationMessage } from "@/lib/cofounder/types"
import { logger } from "@/lib/logging/logger"
import { store } from "@/lib/store/store"

/**
 * POST /api/cofounder/actions/[id] — approve or reject a pending action
 * (spec sections 61–63). body: { decision: "approve" | "reject", confirmWord?: string }
 *
 * The approval path is the ONLY route to a Co-founder mutation. It performs
 * the full revalidation chain server-side — the frontend proves nothing:
 *
 *   authenticate → load action → verify ownership → verify not expired →
 *   verify single-use (atomic claim) → revalidate input (zod) →
 *   re-check project ownership → re-check credits → re-check rate limit →
 *   execute existing service → finalize atomically → audit event
 */

const BodySchema = z.object({
  decision: z.enum(["approve", "reject"]),
  confirmWord: z.string().max(40).optional(),
}).strip()

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params

    const body = BodySchema.safeParse(await req.json().catch(() => ({})))
    if (!body.success) return fail("VALIDATION", "Invalid request.", 422)
    const { decision, confirmWord } = body.data

    await expireStalePendingActions(user.id)
    const action = await getPendingAction(id)
    if (!action || action.userId !== user.id) {
      return fail("PENDING_ACTION_NOT_FOUND", "That confirmation isn't available.", 404)
    }

    if (decision === "reject") {
      if (action.status !== "pending") {
        return fail("PENDING_ACTION_ALREADY_USED", "That confirmation was already handled.", 409)
      }
      // Rejection is a simple status flip (single-use not required — the
      // claim gate below protects execution).
      const { cofounderPendingActionsCol } = await import("@/lib/db/collections")
      const col = await cofounderPendingActionsCol()
      await col.updateOne({ id: action.id, userId: user.id, status: "pending" }, { $set: { status: "rejected" } })
      // Mark the conversation card resolved (spec sections 55, 62).
      await appendResolutionMessage(action, user.id, "rejected", undefined)
      logger.info("cofounder.action", "pending action rejected", { actionId: action.id, toolName: action.toolName, userId: user.id })
      return ok({ status: "rejected" })
    }

    // ── Approve ──
    if (action.status !== "pending") {
      return fail("PENDING_ACTION_ALREADY_USED", "That confirmation was already handled.", 409)
    }

    const tool = getTool(action.toolName)
    if (!tool || !tool.requiresConfirmation || !tool.executeApproved) {
      return fail("VALIDATION", "That action is no longer available.", 422)
    }

    // HARD_CONFIRM: require the typed word to match the stored one.
    if (action.confirmWord) {
      if ((confirmWord ?? "").trim() !== action.confirmWord) {
        return fail("VALIDATION", `Type "${action.confirmWord}" to confirm this action.`, 422)
      }
    }

    // Atomic single-use claim: pending → executing. A second concurrent
    // approve can never reach execution (spec section 34).
    const claimed = await claimPendingAction(action.id, user.id)
    if (!claimed) {
      return fail("PENDING_ACTION_ALREADY_USED", "That confirmation was already handled.", 409)
    }

    try {
      // Revalidate the stored parameters through the tool's zod schema.
      const revalidated = tool.inputSchema.safeParse(action.parameters)
      if (!revalidated.success) {
        await finalizePendingAction(action.id, { ok: false, error: { code: "VALIDATION", message: "The stored action parameters are no longer valid." } })
        return fail("VALIDATION", "That action's parameters are no longer valid. Ask me to prepare it again.", 422)
      }

      // Re-check project ownership where the tool is project-scoped.
      const projectId = (revalidated.data as { projectId?: string }).projectId
      if (projectId) {
        const project = await store.getProject(projectId)
        if (!project || project.userId !== user.id) {
          await finalizePendingAction(action.id, { ok: false, error: { code: "UNAUTHORIZED_PROJECT_ACCESS", message: "Project access could not be verified." } })
          return fail("UNAUTHORIZED_PROJECT_ACCESS", "I couldn't access that project.", 403)
        }
      }

      // Re-check credits for priced actions.
      if (action.cost && action.cost.amount > 0) {
        const { getAvailableCredits } = await import("@/lib/billing/credit-service")
        const available = await getAvailableCredits(user.id)
        if (available < action.cost.amount) {
          await finalizePendingAction(action.id, { ok: false, error: { code: "INSUFFICIENT_CREDITS", message: "You don't have enough credits for this action." } })
          return fail("INSUFFICIENT_CREDITS", `You don't have enough credits for this action. It needs about ${action.cost.amount.toLocaleString()}.`, 402)
        }
      }

      // Re-check rate limit at the approval path (never bypass existing
      // per-action limits — the shared services enforce their own too).
      await checkRateLimit({ action: "cofounder_approve", identifier: user.id, limit: 20, windowMs: 60 * 60 * 1000 })

      const ctx = await buildToolContext(
        { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified },
        { ...(action.conversationId ? { conversationId: action.conversationId } : {}), pendingActionId: action.id },
      )

      const outcome = await tool.executeApproved(revalidated.data, ctx)

      if (outcome.success) {
        await finalizePendingAction(action.id, { ok: true, result: outcome })
        // Append the structured result into the conversation so the action
        // card renders correctly on reload (spec sections 40, 55).
        await appendResolutionMessage(action, user.id, "executed", outcome)
        logger.info("cofounder.action", "pending action executed", { actionId: action.id, toolName: action.toolName, userId: user.id })
        return ok({ status: "executed", result: outcome })
      }
      await finalizePendingAction(action.id, { ok: false, error: outcome.error })
      await appendResolutionMessage(action, user.id, "failed", undefined)
      return fail(outcome.error.code, outcome.error.message, 402)
    } catch (execError) {
      await finalizePendingAction(action.id, { ok: false, error: { code: "UNKNOWN", message: "The action failed during execution." } })
      throw execError
    }
  } catch (e) {
    return handleRouteError("api.cofounder.action", e)
  }
}

/** Persist an action-card message into the conversation when a pending action
 * settles (executed / failed / rejected). Best-effort: transcript updates must
 * never break the approval response. */
async function appendResolutionMessage(
  action: Awaited<ReturnType<typeof getPendingAction>>,
  userId: string,
  resolution: "executed" | "rejected" | "failed",
  result?: ToolOutcome,
) {
  try {
    if (!action?.conversationId) return
    const { getCofounderConversation, appendCofounderMessages, cofounderMessage } = await import("@/lib/cofounder/conversation")
    const conversation = await getCofounderConversation(action.conversationId, userId)
    if (!conversation) return
    const messages: CofounderConversationMessage[] = []

    // 1. Resolve the original pending_action card so it doesn't look active.
    const index = [...conversation.messages].reverse().findIndex((m) => m.action?.kind === "pending_action" && m.action.actionId === action.id)
    if (index >= 0) {
      const realIndex = conversation.messages.length - 1 - index
      const original = conversation.messages[realIndex]
      const updatedAction = original.action && original.action.kind === "pending_action" ? { ...original.action, resolved: resolution } : original.action
      messages.push({ ...original, action: updatedAction })
    }

    // 2. For executed mutations, append an action_result card from the actual
    // backend result — never from model prose (spec section 40).
    if (resolution === "executed" && result && result.success) {
      messages.push(
        cofounderMessage("assistant", "", {
          kind: "action_result",
          resultType: result.type,
          data: result.data,
          success: true,
        }),
      )
    }

    if (messages.length) {
      await appendCofounderMessages(action.conversationId, userId, messages)
    }
  } catch (e) {
    logger.warn("cofounder.action", "failed to record resolution in conversation (non-fatal)", {
      actionId: action?.id,
      message: e instanceof Error ? e.message : String(e),
    })
  }
}
