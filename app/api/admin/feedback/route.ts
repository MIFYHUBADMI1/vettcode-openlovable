import { docFeedbackCol } from "@/lib/db/collections"
import { ok, handleRouteError } from "@/lib/api/respond"
import { requireAdmin } from "@/lib/auth/session"

const SECTION_LABELS: Record<string, string> = {
  "getting-started": "Getting Started",
  "how-it-works": "How It Works",
  "website-mode": "Website Mode",
  "idea-mode": "Idea Mode",
  "understanding": "Understanding & Planning",
  "editing-your-plan": "Editing Your Plan",
  "building": "Building Your Application",
  "workspace": "Working With Your App",
  "publishing": "Publishing & Domains",
  "credits": "Credits & Billing",
  "account": "Account & Settings",
  "faq": "Frequently Asked Questions",
}

/**
 * GET /api/admin/feedback
 *
 * Returns aggregated feedback data for all doc sections.
 * Admin-only.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin() // throws 401/403 if not admin

    const col = await docFeedbackCol()

    // Aggregate: count up and down per section
    const pipeline = [
      {
        $group: {
          _id: { sectionId: "$sectionId", vote: "$vote" },
          count: { $sum: 1 },
        },
      },
    ]

    const results = await col.aggregate(pipeline).toArray()
    const totalVotes = await col.countDocuments()

    // Build per-section stats
    const sectionStats: Record<string, { up: number; down: number; label: string }> = {}

    for (const [id, label] of Object.entries(SECTION_LABELS)) {
      sectionStats[id] = { up: 0, down: 0, label }
    }

    for (const doc of results) {
      const sectionId = doc._id.sectionId as string
      const vote = doc._id.vote as "up" | "down"
      if (!sectionStats[sectionId]) {
        sectionStats[sectionId] = { up: 0, down: 0, label: sectionId }
      }
      sectionStats[sectionId][vote] = doc.count as number
    }

    // Compute sentiment per section
    const sections = Object.entries(sectionStats).map(([id, s]) => {
      const total = s.up + s.down
      const sentiment = total > 0 ? Math.round((s.up / total) * 100) : null
      return {
        id,
        label: s.label,
        up: s.up,
        down: s.down,
        total,
        sentiment,
      }
    })

    // Sort by total votes descending
    sections.sort((a, b) => b.total - a.total)

    // Overall stats
    const totalUp = sections.reduce((sum, s) => sum + s.up, 0)
    const totalDown = sections.reduce((sum, s) => sum + s.down, 0)
    const overallSentiment = totalVotes > 0 ? Math.round((totalUp / totalVotes) * 100) : null

    return ok({
      totalVotes,
      totalUp,
      totalDown,
      overallSentiment,
      sections,
    })
  } catch (e) {
    return handleRouteError("api.admin.feedback", e)
  }
}
