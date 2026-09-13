import { requireUser } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { userFollowsCol, usersCol } from "@/lib/db/collections"
import { cryptoId } from "@/lib/store/store"
import { ObjectId } from "mongodb"

/**
 * POST /api/users/:id/follow
 * Toggle follow on another user. Returns { following, followerCount }.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireUser()
    const { id: targetUserId } = await params

    if (currentUser.id === targetUserId) {
      return fail("SELF_FOLLOW", "You can't follow yourself.", 400)
    }

    // Verify the target user exists
    const targetUser = await (await usersCol()).findOne({ id: targetUserId })
    if (!targetUser) return fail("NOT_FOUND", "User not found.", 404)

    const col = await userFollowsCol()
    const existing = await col.findOne({ followerId: currentUser.id, followingId: targetUserId })

    let following: boolean
    if (existing) {
      await col.deleteOne({ followerId: currentUser.id, followingId: targetUserId })
      following = false
    } else {
      await col.insertOne({
        _id: new ObjectId(),
        id: cryptoId(),
        followerId: currentUser.id,
        followingId: targetUserId,
        createdAt: Date.now(),
      })
      following = true
    }

    const followerCount = await col.countDocuments({ followingId: targetUserId })
    return ok({ following, followerCount })
  } catch (e) {
    return handleRouteError("api.users.follow", e)
  }
}
