import { getCurrentUser } from "@/lib/auth/session"
import { projectsCol, usersCol, projectLikesCol, userFollowsCol } from "@/lib/db/collections"
import { ok, handleRouteError } from "@/lib/api/respond"
import { resolveProjectThumbnail } from "@/lib/media/project-thumbnail"

/**
 * GET /api/explore
 * Returns paginated public projects with like counts, author info,
 * and whether the current user has liked/followed each item.
 * Auth is optional — unauthenticated users still see the library.
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser().catch(() => null)
    const url = new URL(req.url)
    const search = url.searchParams.get("q")?.trim() || ""
    const sort = url.searchParams.get("sort") || "recent" // recent | popular | forked
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10))
    const limit = 24
    const skip = (page - 1) * limit

    const col = await projectsCol()

    // Base filter: public projects only
    const filter: Record<string, unknown> = { visibility: "public" }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { "understanding.purpose": { $regex: search, $options: "i" } },
        { sourceUrl: { $regex: search, $options: "i" } },
      ]
    }

    const sortMap = {
      recent: { updatedAt: -1 as const },
      popular: { likeCount: -1 as const, updatedAt: -1 as const },
      forked: { forkCount: -1 as const, updatedAt: -1 as const },
    }
    const sortQuery = sortMap[sort as keyof typeof sortMap] ?? sortMap.recent

    const [projects, total] = await Promise.all([
      col.find(filter).sort(sortQuery).skip(skip).limit(limit).toArray(),
      col.countDocuments(filter),
    ])

    if (projects.length === 0) {
      return ok({ projects: [], total: 0, page, pages: 0 })
    }

    // Fetch author info for all projects
    const userIds = [...new Set(projects.map(p => p.userId))]
    const usersData = await (await usersCol()).find({ id: { $in: userIds } }, {
      projection: { id: 1, name: 1, email: 1, imageUrl: 1 }
    }).toArray()
    const usersMap = Object.fromEntries(usersData.map(u => [u.id, u]))

    // Fetch like counts per project
    const projectIds = projects.map(p => p.id)
    const likesCol = await projectLikesCol()
    const likeCounts = await likesCol.aggregate<{ _id: string; count: number }>([
      { $match: { projectId: { $in: projectIds } } },
      { $group: { _id: "$projectId", count: { $sum: 1 } } },
    ]).toArray()
    const likeCountMap = Object.fromEntries(likeCounts.map(l => [l._id, l.count]))

    // If logged in, check which projects the user already liked
    let likedSet = new Set<string>()
    let followingSet = new Set<string>()
    if (user) {
      const [userLikes, userFollowing] = await Promise.all([
        likesCol.find({ userId: user.id, projectId: { $in: projectIds } }).toArray(),
        (await userFollowsCol()).find({ followerId: user.id, followingId: { $in: userIds } }).toArray(),
      ])
      likedSet = new Set(userLikes.map(l => l.projectId))
      followingSet = new Set(userFollowing.map(f => f.followingId))
    }

    const result = projects.map(p => {
      const author = usersMap[p.userId]
      const latestDeploy = [...(p.deploymentHistory ?? [])].reverse().find(d => d.status === "success")
      return {
        id: p.id,
        name: p.name,
        mode: p.mode,
        state: p.state,
        sourceUrl: p.sourceUrl ?? null,
        purpose: p.understanding?.purpose ?? null,
        thumbnailUrl: resolveProjectThumbnail(p.understanding?.screenshots),
        productionUrl: latestDeploy?.productionUrl ?? null,
        likeCount: likeCountMap[p.id] ?? 0,
        forkCount: (p as Record<string, unknown>).forkCount as number ?? 0,
        liked: likedSet.has(p.id),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        author: author ? {
          id: author.id,
          name: author.name,
          email: author.email,
          imageUrl: author.imageUrl ?? null,
          following: followingSet.has(author.id),
          isCurrentUser: user?.id === author.id,
        } : null,
      }
    })

    return ok({ projects: result, total, page, pages: Math.ceil(total / limit) })
  } catch (e) {
    return handleRouteError("api.explore", e)
  }
}
