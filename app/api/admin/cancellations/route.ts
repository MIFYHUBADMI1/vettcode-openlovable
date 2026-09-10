import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/session"
import { getMongoClient } from "@/lib/db/mongodb"

/**
 * GET /api/admin/cancellations
 * Get cancellation feedback statistics and data
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    // Check if user is admin (using isAdmin field which exists on UserDoc)
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Fetch cancellation feedback
    const client = await getMongoClient()
    const db = client.db()
    const collection = db.collection("cancellation_feedback")

    const feedbacks = await collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(100)
      .toArray()

    // Calculate stats
    const totalCancellations = feedbacks.length
    const reasonCounts = feedbacks.reduce((acc: Record<string, number>, fb: any) => {
      acc[fb.reason] = (acc[fb.reason] || 0) + 1
      return acc
    }, {})

    const topReason = Object.entries(reasonCounts).sort((a, b) => (b[1] as number) - (a[1] as number))[0] || null
    const withFeedbackCount = feedbacks.filter((f: any) => f.feedback).length

    return NextResponse.json({
      feedbacks,
      totalCancellations,
      reasonCounts,
      topReason,
      withFeedbackCount,
    })
  } catch (error) {
    console.error("Failed to fetch cancellations:", error)
    return NextResponse.json(
      { error: "Failed to fetch cancellations" },
      { status: 500 },
    )
  }
}