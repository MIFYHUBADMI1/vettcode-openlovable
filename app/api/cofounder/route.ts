import "server-only"
import { store } from "@/lib/store/store"
import { requireUser } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { z } from "zod"
import { runAgentTurn, MAX_TOOL_STEPS } from "@/lib/cofounder/agent"
import {
  getCofounderConversation,
  getLatestCofounderConversation,
  createCofounderConversation,
  appendCofounderMessages,
} from "@/lib/cofounder/conversation"
import { expireStalePendingActions } from "@/lib/cofounder/pending-actions"

/**
 * POST /api/cofounder — one Co-founder conversation turn (spec section 60).
 *
 * Authentication comes from the session cookie ONLY; no client-controlled
 * userId is ever accepted. All request metadata (activeProjectId,
 * currentRoute, currentSurface) is normalized and treated as CONTEXT ONLY —
 * never as authorization (spec section 48).
 *
 * GET /api/cofounder — loads the user's most recent conversation (or one by
 * id) so the panel can reopen with history intact (spec section 47).
 */

const PostBodySchema = z.object({
  conversationId: z.string().min(1).max(80).optional(),
  message: z.string().min(1).max(8000),
  activeProjectId: z.string().min(1).max(80).optional(),
  currentRoute: z.string().max(300).optional(),
  currentSurface: z.string().max(60).optional(),
}).strip()

export async function POST(req: Request) {
  try {
    const user = await requireUser()
    await checkRateLimit({
      action: "cofounder_message",
      identifier: user.id,
      limit: 30,
      windowMs: 10 * 60 * 1000,
    })

    const body = PostBodySchema.safeParse(await req.json().catch(() => ({})))
    if (!body.success) {
      return fail("VALIDATION", "That message didn't look right.", 422)
    }
    const { message, conversationId, activeProjectId, currentRoute, currentSurface } = body.data

    // Load or create the workspace-level conversation (always user-scoped).
    let conversation = conversationId
      ? await getCofounderConversation(conversationId, user.id)
      : await getLatestCofounderConversation(user.id)
    if (!conversation) {
      conversation = await createCofounderConversation(user.id, activeProjectId)
    }

    // Ownership context: if the client sent an activeProjectId that isn't
    // theirs, silently ignore it (context, not authorization).
    let safeActiveProjectId: string | undefined = undefined
    if (activeProjectId) {
      // Ownership check: another user's project id is ignored entirely.
      const project = await store.getProject(activeProjectId)
      if (project && project.userId === user.id) safeActiveProjectId = activeProjectId
    }

    const turn = await runAgentTurn({
      user: { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified },
      message,
      conversationId: conversation.id,
      ...(safeActiveProjectId ? { activeProjectId: safeActiveProjectId } : {}),
      ...(currentRoute ? { currentRoute } : {}),
      ...(currentSurface ? { currentSurface } : {}),
    })

    return ok({
      conversationId: conversation.id,
      reply: turn.reply,
      messages: turn.messages,
      preparedActions: turn.preparedActions,
      maxToolSteps: MAX_TOOL_STEPS,
    })
  } catch (e) {
    return handleRouteError("api.cofounder.post", e)
  }
}

export async function GET(req: Request) {
  try {
    const user = await requireUser()
    const url = new URL(req.url)
    const id = url.searchParams.get("id")
    const conversation = id
      ? await getCofounderConversation(id, user.id)
      : await getLatestCofounderConversation(user.id)
    if (!conversation) {
      return ok({ conversation: null })
    }
    // Surface any pending confirmations for this conversation.
    await expireStalePendingActions(user.id)
    return ok({ conversation })
  } catch (e) {
    return handleRouteError("api.cofounder.get", e)
  }
}
