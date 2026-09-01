import { requireUser } from "@/lib/auth/session"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { uploadEvidence } from "@/lib/billing/topup-service"
import { analyzePaymentScreenshot } from "@/lib/billing/verify-payment"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { topupsCol } from "@/lib/db/collections"
import { PAYMENT_RECIPIENT } from "@/lib/billing/packages"
import { logger } from "@/lib/logging/logger"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"])

/** Upload a payment confirmation screenshot and trigger AI verification. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params

    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return fail("VALIDATION", "Please upload a screenshot.", 422)
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return fail("VALIDATION", "Only PNG, JPEG, WEBP, or GIF images are allowed.", 422)
    }

    if (file.size > MAX_FILE_SIZE) {
      return fail("VALIDATION", "Image must be smaller than 10MB.", 422)
    }

    // Rate limit: max 10 evidence uploads per hour per user per top-up
    await checkRateLimit({
      action: `topup_evidence:${id}`,
      identifier: user.id,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    })

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload evidence
    const { fileId } = await uploadEvidence({
      topUpId: id,
      userId: user.id,
      fileBuffer: buffer,
      fileName: file.name,
      mimeType: file.type,
    })

    // Get the top-up details for AI analysis
    const col = await topupsCol()
    const topUp = await col.findOne({ id })
    if (!topUp) {
      return fail("NOT_FOUND", "Top-up not found.", 404)
    }

    // Trigger AI analysis in the background
    const base64 = buffer.toString("base64")
    analyzePaymentScreenshot(base64, file.type, {
      amount: topUp.expectedAmount,
      recipientName: PAYMENT_RECIPIENT.name,
      recipientPhone: PAYMENT_RECIPIENT.phone,
      paymentReference: topUp.paymentReference,
      payerPhone: topUp.payerPhone,
      network: topUp.paymentNetwork,
      topUpId: topUp.id,
    })
      .then(async (analysis) => {
        // Store the analysis result
        await col.updateOne(
          { id },
          {
            $set: {
              aiAnalysis: analysis,
              status: analysis.recommendation === "MATCH" ? "analyzing" : "manual_review",
              updatedAt: Date.now(),
            },
          },
        )

        // If AI says MATCH, run backend verification
        if (analysis.recommendation === "MATCH") {
          const { verifyPayment } = await import("@/lib/billing/verify-payment")
          const { awardCredits } = await import("@/lib/billing/topup-service")
          const decision = await verifyPayment(id)
          if (decision.approved) {
            await awardCredits(id, "system")
          } else if (decision.status === "manual_review" || decision.status === "amount_mismatch" || decision.status === "duplicate") {
            await col.updateOne(
              { id },
              { $set: { status: decision.status, rejectionReason: decision.reasons.join("; "), updatedAt: Date.now() } },
            )
          }
        }

        logger.info("topup.evidence", "AI analysis completed", {
          topUpId: id,
          confidence: analysis.confidence,
          recommendation: analysis.recommendation,
        })
      })
      .catch((error) => {
        logger.error("topup.evidence", "AI analysis background failed", {
          topUpId: id,
          error: (error as Error).message,
        })
        // Set to manual review on AI failure
        col.updateOne(
          { id },
          { $set: { status: "manual_review", updatedAt: Date.now() } },
        )
      })

    return ok({ fileId, message: "Screenshot uploaded. Verifying payment..." }, { status: 201 })
  } catch (e) {
    return handleRouteError("api.billing.topup.evidence", e)
  }
}
