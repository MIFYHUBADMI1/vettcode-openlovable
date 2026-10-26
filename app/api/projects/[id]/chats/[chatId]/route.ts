import { requireUser } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import {
  deleteProjectChat,
  getProjectChat,
  renameProjectChat,
  sanitizeProjectChatTitle,
} from "@/lib/collab-chat/store"

/**
 * One project-scoped co-founder conversation.
 *
 * GET    — full thread with messages (restores the transcript on navigation).
 * PATCH  — rename ({ title }).
 * DELETE — remove the thread.
 *
 * All operations are scoped by projectId + userId; a thread from another
 * account or project reads as 404.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; chatId: string }> },
) {
  try {
    const user = await requireUser()
    const { id, chatId } = await params

    const chat = await getProjectChat(chatId, id, user.id)
    if (!chat) return fail("CHAT_NOT_FOUND", "That conversation no longer exists.", 404)

    return ok({ chat })
  } catch (e) {
    return handleRouteError("api.projects.chats.get", e)
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; chatId: string }> },
) {
  try {
    const user = await requireUser()
    const { id, chatId } = await params

    const body = (await req.json().catch(() => ({}))) as { title?: unknown }
    const title = typeof body.title === "string" ? sanitizeProjectChatTitle(body.title) : ""
    if (!title) {
      return fail("VALIDATION", "Give the conversation a name (up to 80 characters).", 422)
    }

    const renamed = await renameProjectChat(chatId, id, user.id, title)
    if (!renamed) return fail("CHAT_NOT_FOUND", "That conversation no longer exists.", 404)

    return ok({ chat: { id: chatId, title } })
  } catch (e) {
    return handleRouteError("api.projects.chats.rename", e)
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; chatId: string }> },
) {
  try {
    const user = await requireUser()
    const { id, chatId } = await params

    const deleted = await deleteProjectChat(chatId, id, user.id)
    if (!deleted) return fail("CHAT_NOT_FOUND", "That conversation no longer exists.", 404)

    return ok({ deleted: true, id: chatId })
  } catch (e) {
    return handleRouteError("api.projects.chats.delete", e)
  }
}
