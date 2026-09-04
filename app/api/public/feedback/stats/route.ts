import { docFeedbackCol } from "@/lib/db/collections"
import { ok, handleRouteError } from "@/lib/api/respond"

/**
 * GET /api/public/feedback/stats
 *
 * Returns aggregated vote counts for all doc sections.
 * Response: { stats: Record<sectionId, { up: number, down: number }> }
 */
export async function GET() {
  try {
    const col = await docFeedbackCol()

    const pipeline = [
      {
        $group: {
          _id: { sectionId: "$sectionId", vote: "$vote" },
          count: { $sum: 1 },
        },
      },
    ]

    const results = await col.aggregate(pipeline).toArray()

    // Build a map: { "getting-started": { up: 12, down: 2 }, ... }
    const stats: Record<string, { up: number; down: number }> = {}

    for (const doc of results) {
      const sectionId = doc._id.sectionId as string
      const vote = doc._id.vote as "up" | "down"
      if (!stats[sectionId]) stats[sectionId] = { up: 0, down: 0 }
      stats[sectionId][vote] = doc.count as number
    }

    return ok({ stats })
  } catch (e) {
    return handleRouteError("api.public.feedback.stats", e)
  }
}
