import "server-only"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { generateText } from "ai"
import { topupsCol } from "@/lib/db/collections"
import { normalizePhone } from "./payment-ref"
import { logger } from "@/lib/logging/logger"
import type { AIAnalysisResult, TopUpStatus } from "@/lib/types/db"

// ─── OpenRouter Vision Client ────────────────────────────────────────────────

function getOpenRouterClient() {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured")
  return createOpenAICompatible({
    name: "openrouter-vision",
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  })
}

// ─── AI Analysis ─────────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are analyzing a Mobile Money payment confirmation screenshot from Uganda.

Analyze the image and extract ALL visible transaction information. For any field that is not visible or clearly readable, set it to null.

Expected fields to extract:
- amount: The payment amount (as a number, e.g. 25000)
- currency: The currency shown (e.g. "UGX")
- recipient_name: The recipient's name
- recipient_phone: The recipient's phone number
- sender_name: The sender's name (if visible)
- sender_phone: The sender's phone number (if visible)
- transaction_id: The Mobile Money transaction ID
- payment_reference: Any payment reference or reason code
- date: The transaction date
- time: The transaction time
- network: The mobile network (MTN, Airtel, etc.) - may not be visible
- transaction_fee: Any transaction fee shown
- balance: Remaining balance if shown
- other_visible_information: Any other transaction details

Return ONLY a valid JSON object with these exact keys. Do not add explanations.

IMPORTANT: If a field is not visible, use null. Do NOT guess or hallucinate values.
Do NOT include markdown formatting, code blocks, or any text other than the JSON.`

export async function analyzePaymentScreenshot(
  imageBase64: string,
  mimeType: string,
  expectedInfo: {
    amount: number
    recipientName: string
    recipientPhone: string
    paymentReference: string
    payerPhone: string
    network: string
    topUpId: string
  },
): Promise<AIAnalysisResult> {
  try {
    const client = getOpenRouterClient()
    const model = client.chatModel("minimax/minimax-m3:free")

    const result = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${EXTRACTION_PROMPT}\n\nExpected transaction details:\n- Amount: ${expectedInfo.amount} UGX\n- Recipient: ${expectedInfo.recipientName}\n- Recipient phone: ${expectedInfo.recipientPhone}\n- Payment reference: ${expectedInfo.paymentReference}\n- Payer phone: ${expectedInfo.payerPhone}\n- Network: ${expectedInfo.network}\n- Top-up ID: ${expectedInfo.topUpId}`,
            },
            {
              type: "file",
              data: `data:${mimeType};base64,${imageBase64}`,
              mediaType: mimeType,
            },
          ],
        },
      ],
    })

    // Parse the AI response
    const analysis = parseAIResponse(result.text)

    // Run deterministic backend checks
    const verification = performDeterministicChecks(analysis, expectedInfo)

    return {
      ...analysis,
      confidence: verification.confidence,
      recommendation: verification.recommendation,
      rawResponse: result.text,
    }
  } catch (error) {
    logger.error("topup.verify", "AI analysis failed", {
      topUpId: expectedInfo.topUpId,
      error: (error as Error).message,
    })
    // Return a REVIEW recommendation when AI fails — don't auto-reject
    return {
      confidence: 0,
      recommendation: "REVIEW",
      rawResponse: `AI analysis failed: ${(error as Error).message}`,
    }
  }
}

// ─── Response Parsing ────────────────────────────────────────────────────────

interface ParsedExtraction {
  extractedAmount?: number | null
  extractedCurrency?: string | null
  extractedRecipientName?: string | null
  extractedRecipientPhone?: string | null
  extractedSenderName?: string | null
  extractedSenderPhone?: string | null
  extractedTransactionId?: string | null
  extractedPaymentReference?: string | null
  extractedDate?: string | null
  extractedTime?: string | null
  extractedNetwork?: string | null
  extractedTransactionFee?: string | null
  extractedBalance?: string | null
  otherVisibleInformation?: string | null
}

function parseAIResponse(text: string): ParsedExtraction {
  // Try to extract JSON from the response (handle markdown code blocks)
  let jsonStr = text.trim()

  // Remove markdown code blocks if present
  const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (jsonMatch) {
    jsonStr = jsonMatch[1]!.trim()
  }

  // Try to find JSON object in the text
  const objectMatch = jsonStr.match(/\{[\s\S]*\}/)
  if (objectMatch) {
    jsonStr = objectMatch[0]
  }

  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>
    return {
      extractedAmount: safeNumber(parsed.amount),
      extractedCurrency: safeString(parsed.currency),
      extractedRecipientName: safeString(parsed.recipient_name),
      extractedRecipientPhone: safeString(parsed.recipient_phone),
      extractedSenderName: safeString(parsed.sender_name),
      extractedSenderPhone: safeString(parsed.sender_phone),
      extractedTransactionId: safeString(parsed.transaction_id),
      extractedPaymentReference: safeString(parsed.payment_reference),
      extractedDate: safeString(parsed.date),
      extractedTime: safeString(parsed.time),
      extractedNetwork: safeString(parsed.network),
      extractedTransactionFee: safeString(parsed.transaction_fee),
      extractedBalance: safeString(parsed.balance),
      otherVisibleInformation: safeString(parsed.other_visible_information),
    }
  } catch {
    // If JSON parsing fails, return empty extraction with REVIEW
    logger.warn("topup.verify", "Failed to parse AI response", { text: text.slice(0, 500) })
    return {}
  }
}

function safeNumber(val: unknown): number | null {
  if (typeof val === "number" && !isNaN(val)) return val
  if (typeof val === "string") {
    const num = Number(val.replace(/[^0-9.-]/g, ""))
    if (!isNaN(num) && num > 0) return num
  }
  return null
}

function safeString(val: unknown): string | null {
  if (typeof val === "string" && val.toLowerCase() !== "null" && val.trim() !== "") return val.trim()
  return null
}

// ─── Deterministic Backend Checks ────────────────────────────────────────────

interface VerificationCheck {
  confidence: number
  recommendation: "MATCH" | "REVIEW" | "MISMATCH"
}

function performDeterministicChecks(
  extraction: ParsedExtraction,
  expected: {
    amount: number
    recipientName: string
    recipientPhone: string
    paymentReference: string
    payerPhone: string
    network: string
    topUpId: string
  },
): VerificationCheck {
  let confidence = 50 // Start at neutral
  let issues = 0
  let matches = 0

  // 1. Amount check (critical)
  if (extraction.extractedAmount !== null && extraction.extractedAmount !== undefined) {
    if (extraction.extractedAmount === expected.amount) {
      matches++
      confidence += 20
    } else {
      issues++
      confidence -= 30 // Wrong amount is a major red flag
    }
  }

  // 2. Recipient name check (important)
  if (extraction.extractedRecipientName) {
    const expectedName = expected.recipientName.toLowerCase()
    const extractedName = extraction.extractedRecipientName.toLowerCase()
    if (extractedName.includes(expectedName) || expectedName.includes(extractedName)) {
      matches++
      confidence += 15
    } else {
      issues++
      confidence -= 15
    }
  }

  // 3. Payment reference check (important)
  if (extraction.extractedPaymentReference) {
    const expectedRef = expected.paymentReference
    const extractedRef = extraction.extractedPaymentReference.replace(/\s/g, "")
    if (extractedRef === expectedRef || extractedRef.includes(expectedRef)) {
      matches++
      confidence += 15
    } else {
      issues++
      confidence -= 10
    }
  }

  // 4. Recipient phone (optional — don't penalize if absent)
  if (extraction.extractedRecipientPhone) {
    const normalizedExtracted = normalizePhone(extraction.extractedRecipientPhone)
    const normalizedExpected = normalizePhone(expected.recipientPhone)
    if (normalizedExtracted === normalizedExpected) {
      matches++
      confidence += 5
    }
    // Don't penalize for phone mismatch — format differences are common
  }

  // 5. Network (optional — don't penalize if absent)
  if (extraction.extractedNetwork) {
    const networkLower = extraction.extractedNetwork.toLowerCase()
    const expectedNetworkLower = expected.network.toLowerCase()
    if (networkLower.includes(expectedNetworkLower) || expectedNetworkLower.includes(networkLower)) {
      matches++
      confidence += 5
    }
    // Don't penalize — network may not be visible in screenshot
  }

  // Clamp confidence
  confidence = Math.max(0, Math.min(100, confidence))

  // Determine recommendation
  let recommendation: "MATCH" | "REVIEW" | "MISMATCH"
  if (confidence >= 70 && issues === 0) {
    recommendation = "MATCH"
  } else if (confidence < 30 || issues >= 2) {
    recommendation = "MISMATCH"
  } else {
    recommendation = "REVIEW"
  }

  return { confidence, recommendation }
}

// ─── Backend Verification Decision ───────────────────────────────────────────

export interface VerificationDecision {
  approved: boolean
  status: TopUpStatus
  reasons: string[]
}

/**
 * Perform the full layered verification: AI analysis → deterministic checks →
 * duplicate checks → risk assessment → final decision.
 */
export async function verifyPayment(topUpId: string): Promise<VerificationDecision> {
  const col = await topupsCol()
  const topUp = await col.findOne({ id: topUpId })

  if (!topUp) {
    return { approved: false, status: "rejected", reasons: ["Top-up not found"] }
  }

  if (topUp.status === "approved") {
    return { approved: true, status: "approved", reasons: ["Already approved"] }
  }

  if (topUp.status === "rejected" || topUp.status === "cancelled" || topUp.status === "expired") {
    return { approved: false, status: topUp.status, reasons: [`Status is ${topUp.status}`] }
  }

  if (!topUp.aiAnalysis) {
    return { approved: false, status: "manual_review", reasons: ["No AI analysis available"] }
  }

  const analysis = topUp.aiAnalysis
  const reasons: string[] = []

  // 1. Check for duplicate transaction ID
  if (analysis.extractedTransactionId) {
    const existingUse = await col.findOne({
      "aiAnalysis.extractedTransactionId": analysis.extractedTransactionId,
      id: { $ne: topUpId },
      status: "approved",
    })
    if (existingUse) {
      return {
        approved: false,
        status: "duplicate",
        reasons: ["This transaction ID has already been used"],
      }
    }
  }

  // 2. Amount validation (critical)
  if (analysis.extractedAmount !== null && analysis.extractedAmount !== undefined) {
    if (analysis.extractedAmount !== topUp.expectedAmount) {
      reasons.push(`Amount mismatch: expected ${topUp.expectedAmount}, got ${analysis.extractedAmount}`)
      return {
        approved: false,
        status: "amount_mismatch",
        reasons,
      }
    }
  }

  // 3. AI recommendation assessment
  if (analysis.recommendation === "MISMATCH") {
    reasons.push("AI detected significant mismatches")
    return { approved: false, status: "manual_review", reasons }
  }

  // 4. Confidence threshold
  if (analysis.confidence < 40) {
    reasons.push("Low AI confidence — needs manual review")
    return { approved: false, status: "manual_review", reasons }
  }

  // 5. If AI says MATCH with sufficient confidence and amount matches, approve
  if (analysis.recommendation === "MATCH" && analysis.confidence >= 70) {
    // Additional safety: ensure we have at least some extracted data
    if (analysis.extractedAmount !== null || analysis.extractedRecipientName || analysis.extractedPaymentReference) {
      return { approved: true, status: "approved", reasons: ["Automated verification passed"] }
    }
  }

  // 6. Default to manual review for edge cases
  reasons.push("Automated verification could not confirm — sent for manual review")
  return { approved: false, status: "manual_review", reasons }
}
