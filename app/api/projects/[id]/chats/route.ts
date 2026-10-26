import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import {
  createProjectChat,
  ensureLegacyProjectChat,
  listProjectChats,
  sanitizeProjectChatTitle,
} from "@/lib/collab-chat/store"

/**
 * Project-scoped co-founder conversations (Collaborate workspace).
 *
 * GET  /api/projects/[id]/chats — history list for the drawer, newest first.
 * POST /api/projects/[id]/chats — create an empty thread.
 *
 * Threads are always scoped by the authenticated owner; a project id alone is
 * never enough to read someone else's history.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser()
    const { id } = await params

    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) {
      return fail("UNAUTHORIZED_PROJECT_ACCESS", "Project not found.", 404)
    }

    // Import pre-thread history once so existing founders keep their chats.
    await ensureLegacyProjectChat(project, user.id)

    const chats = await listProjectChats(id, user.id)
    return ok({ chats })
  } catch (e) {
    return handleRouteError("api.projects.chats.list", e)
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser()
    const { id } = await params

    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) {
      return fail("UNAUTHORIZED_PROJECT_ACCESS", "Project not found.", 404)
    }

    const body = (await req.json().catch(() => ({}))) as { title?: unknown }
    const title =
      typeof body.title === "string" && body.title.trim()
        ? sanitizeProjectChatTitle(body.title)
        : undefined

    const chat = await createProjectChat(id, user.id, title)
    return ok({ chat })
  } catch (e) {
    return handleRouteError("api.projects.chats.create", e)
  }
}
