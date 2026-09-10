import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/session"
import { getMongoClient } from "@/lib/db/mongodb"
import { logger } from "@/lib/logging/logger"

/**
 * POST /api/billing/subscription/cancel-feedback
 * Save cancellation reason and feedback from user
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { reason, feedback, planName } = body

    if (!reason) {
      return NextResponse.json(
        { error: "Cancellation reason is required" },
        { status: 400 },
      )
    }

    // Save to cancellation_feedback collection
    const client = await getMongoClient()
    const db = client.db()
    const collection = db.collection("cancellation_feedback")

    await collection.insertOne({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      planName,
      reason,
      feedback: feedback || null,
      createdAt: new Date(),
      timestamp: Date.now(),
    })

    logger.info("subscription.cancel_feedback", "User provided cancellation feedback", {
      userId: user.id,
      reason,
      planName,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error("subscription.cancel_feedback", "Failed to save cancellation feedback", {
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: "Failed to save feedback" },
      { status: 500 },
    )
  }
}