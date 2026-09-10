import { NextRequest } from "next/server"
import { docFeedbackCol } from "@/lib/db/collections"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { createHash } from "crypto"

const VALID_SECTIONS = [
  "getting-started",
  "how-it-works",
  "website-mode",
  "idea-mode",
  "understanding",
  "editing-your-plan",
  "building",
  "workspace",
  "publishing",
  "credits",
  "account",
  "faq",
]

/**
 * POST /api/public/feedback
 *
 * Body: { sectionId: string, vote: "up" | "down", visitorId?: string }
 *
 * Stores a doc feedback vote. Uses a composite key of sectionId + visitorId
 * to deduplicate — each visitor can vote once per section. If they vote
 * again, the previous vote is overwritten.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sectionId, vote, visitorId: rawVisitorId } = body as {
      sectionId?: string
      vote?: string
      visitorId?: string
    }

    if (!sectionId || !VALID_SECTIONS.includes(sectionId)) {
      return fail("VALIDATION", "Invalid section ID.")
    }
    if (vote !== "up" && vote !== "down") {
      return fail("VALIDATION", "Vote must be 'up' or 'down'.")
    }

    // Generate or hash the visitor ID for deduplication
    const visitorId = rawVisitorId
      ? createHash("sha256").update(rawVisitorId).digest("hex").slice(0, 16)
      : createHash("sha256")
          .update(`${req.headers.get("x-forwarded-for") ?? "anonymous"}-${req.headers.get("user-agent") ?? ""}`)
          .digest("hex")
          .slice(0, 16)

    const key = `${sectionId}:${visitorId}`
    const now = Date.now()

    const col = await docFeedbackCol()
    await col.updateOne(
      { key },
      {
        $set: {
          sectionId,
          visitorId,
          vote,
          updatedAt: now,
        },
        $setOnInsert: {
          key,
          createdAt: now,
        },
      },
      { upsert: true },
    )

    // Return aggregate counts for this section
    const [upCount, downCount] = await Promise.all([
      col.countDocuments({ sectionId, vote: "up" }),
      col.countDocuments({ sectionId, vote: "down" }),
    ])

    return ok({
      sectionId,
      vote,
      stats: { up: upCount, down: downCount },
    })
  } catch (e) {
    return handleRouteError("api.public.feedback", e)
  }
}
