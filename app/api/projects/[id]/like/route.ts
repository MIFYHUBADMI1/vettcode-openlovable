import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { projectLikesCol } from "@/lib/db/collections"
import { cryptoId } from "@/lib/store/store"
import { ObjectId } from "mongodb"

/**
 * POST /api/projects/:id/like
 * Toggle like on a public project. Returns { liked, likeCount }.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params

    const project = await store.getProject(id)
    if (!project) return fail("NOT_FOUND", "Project not found.", 404)
    if (project.visibility !== "public") return fail("NOT_PUBLIC", "You can only like public projects.", 403)

    const col = await projectLikesCol()
    const existing = await col.findOne({ userId: user.id, projectId: id })

    let liked: boolean
    if (existing) {
      // Unlike
      await col.deleteOne({ userId: user.id, projectId: id })
      liked = false
    } else {
      // Like
      await col.insertOne({
        _id: new ObjectId(),
        id: cryptoId(),
        userId: user.id,
        projectId: id,
        createdAt: Date.now(),
      })
      liked = true
    }

    const likeCount = await col.countDocuments({ projectId: id })
    return ok({ liked, likeCount })
  } catch (e) {
    return handleRouteError("api.projects.like", e)
  }
}

/**
 * GET /api/projects/:id/like
 * Returns like status and count for the current user.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params

    const col = await projectLikesCol()
    const [existing, likeCount] = await Promise.all([
      col.findOne({ userId: user.id, projectId: id }),
      col.countDocuments({ projectId: id }),
    ])

    return ok({ liked: Boolean(existing), likeCount })
  } catch (e) {
    return handleRouteError("api.projects.like.get", e)
  }
}
