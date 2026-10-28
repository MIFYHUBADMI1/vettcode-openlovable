import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { chargeCompetitors, refundResources } from "@/lib/resources/resources-credits"
import { scopedIntentKey } from "@/lib/billing/operation-identity"
import { generateWithRetry, logAIFailure } from "@/lib/resources/ai-retry"
import { refuseInsufficientCredits } from "@/lib/api/credit-refusal"
import { RESOURCES_CREDIT_COSTS } from "@/lib/resources/credit-costs"

/** Read the optional client intent id (idempotency identity only — validated
 * and scoped to this authenticated user + this ownership-checked project). */
async function readIntentKey(req: Request, userId: string, projectId: string): Promise<string | undefined> {
  const body = (await req.json().catch(() => null)) as { requestId?: unknown } | null
  return scopedIntentKey(body?.requestId, { userId, operation: "resources_competitors", projectId })
}

import { withAiProtection } from "@/lib/api/ai-protection"

export const POST = withAiProtection("resources", post)

async function post(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser()
    const { id } = await params

    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) {
      return fail("NOT_FOUND", "Project not found.", 404)
    }
    if (!project.specification) {
      return fail("VALIDATION", "No specification found for this project.", 409)
    }

    const intentKey = await readIntentKey(req, user.id, id)
    const charged = await chargeCompetitors(user.id, id, intentKey)
    if (!charged) {
      return refuseInsufficientCredits(
        user.id,
        RESOURCES_CREDIT_COSTS.competitors,
        `You need ${RESOURCES_CREDIT_COSTS.competitors} credits to research competitors.`,
      )
    }

    const spec = project.specification

    const systemPrompt = `You are a competitive intelligence analyst.
Return your response as valid JSON — an array of competitor objects.
Include only real, existing competitors. Be accurate and factual.
Do not include markdown fences — return raw JSON only.`

    const userPrompt = `Find the top 5-7 competitors for this business and return them as a JSON array.

Business details:
- Name: ${spec.title || project.name}
- Type: ${spec.applicationType || "Software application"}
- Description: ${spec.description || spec.purpose || ""}
- Target customers: ${(spec.targetUsers || []).join(", ") || "Not specified"}
- Business model: ${spec.businessModel || "Not specified"}
- Value proposition: ${spec.valueProposition || "Not specified"}

Return a JSON array with this exact structure for each competitor:
[
  {
    "name": "Company name",
    "url": "https://example.com",
    "tagline": "Their main tagline or positioning statement",
    "founded": "Year or approximate",
    "pricing": "Free/Freemium/Paid/Enterprise — with approximate price range",
    "businessModel": "How they make money",
    "strengths": ["strength 1", "strength 2", "strength 3"],
    "weaknesses": ["weakness 1", "weakness 2"],
    "targetCustomer": "Who they primarily serve",
    "competitiveEdge": "Their single biggest differentiator",
    "fundingStatus": "Bootstrapped / Seed / Series A / Public / Acquired etc."
  }
]

Include direct competitors first, then adjacent competitors. Be specific and accurate.`

    let competitors: unknown[]
    try {
      const raw = await generateWithRetry(
        { system: systemPrompt, prompt: userPrompt },
        { maxOutputTokens: 3000 },
      )

      const trimmed = raw.trim()
      // Extract JSON array — handle cases where model wraps in markdown
      const jsonMatch = trimmed.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error("No JSON array found in response")
      competitors = JSON.parse(jsonMatch[0])
    } catch (aiError) {
      await refundResources(user.id, id, "competitors", intentKey)
      
      logAIFailure("resources.competitors", aiError, {
        projectId: id,
        userId: user.id,
        operation: "competitors",
      })
      
      // Check if we have a cached version to fall back to
      // @ts-expect-error — dynamic cache fields not in strict type
      const cachedCompetitors = project.resourcesCache?.competitors
      if (cachedCompetitors?.data) {
        return ok({
          competitors: cachedCompetitors.data,
          generatedAt: cachedCompetitors.generatedAt,
          cached: true,
          note: "Using previously researched competitors. The AI service is temporarily unavailable.",
        })
      }
      
      return fail(
        "AI_UNAVAILABLE",
        "The AI service is temporarily unavailable. Your credits have been refunded. Please try again in a few moments.",
        503,
      )
    }

    await store.updateProject(id, {
      // @ts-expect-error
      resourcesCache: {
        // @ts-expect-error
        ...(project.resourcesCache ?? {}),
        competitors: { data: competitors, generatedAt: Date.now() },
      },
    })

    return ok({ competitors, generatedAt: Date.now() })
  } catch (e) {
    return handleRouteError("resources.competitors", e)
  }
}
