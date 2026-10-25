import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { chargeMarketResearch, refundResources } from "@/lib/resources/resources-credits"
import { scopedIntentKey } from "@/lib/billing/operation-identity"
import { generateWithRetry, logAIFailure } from "@/lib/resources/ai-retry"

/** Read the optional client intent id (idempotency identity only — validated
 * and scoped to this authenticated user + this ownership-checked project). */
async function readIntentKey(req: Request, userId: string, projectId: string): Promise<string | undefined> {
  const body = (await req.json().catch(() => null)) as { requestId?: unknown } | null
  return scopedIntentKey(body?.requestId, { userId, operation: "resources_market_research", projectId })
}

export async function POST(
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
    const charged = await chargeMarketResearch(user.id, id, intentKey)
    if (!charged) {
      return fail("INSUFFICIENT_CREDITS", "You need 75 credits to research your market.", 402)
    }

    const spec = project.specification

    const systemPrompt = `You are a market research analyst with deep expertise in the software and technology industry.
Provide specific, data-informed market analysis. Use real market estimates and trends.
Be direct and analytical. Avoid vague statements — cite approximate numbers wherever possible.
Format in clean markdown.`

    const userPrompt = `Conduct detailed market research for this business:

**Business**: ${spec.title || project.name}
**Type**: ${spec.applicationType || "Software application"}
**Description**: ${spec.description || spec.purpose || ""}
**Target customers**: ${(spec.targetUsers || []).join(", ") || "Not specified"}
**Business model**: ${spec.businessModel || "Not specified"}
**Market positioning**: ${spec.marketPositioning || "Not specified"}

Provide analysis covering:

## Market Size & Growth
- Total Addressable Market (TAM) estimate
- Serviceable Addressable Market (SAM) estimate
- Year-over-year growth rate
- Key market trends driving growth

## Target Customer Deep Dive
- Detailed buyer persona (job title, company size if B2B, demographics if B2C)
- Their top 3 daily frustrations this product solves
- How they currently solve the problem (status quo)
- Willingness to pay (price anchoring)
- Where they discover new tools / products

## Market Timing
- Why is now the right time for this product?
- What technology shift or behaviour change is enabling this?
- Key tailwinds and headwinds

## Entry Strategy
- The lowest-friction entry point into this market
- Which customer segment to win first
- What existing behaviour to attach to

Be specific to this exact business type and category. Cite real market data where relevant.`

    let text: string
    try {
      text = await generateWithRetry(
        { system: systemPrompt, prompt: userPrompt },
        { maxOutputTokens: 2500 },
      )
    } catch (aiError) {
      await refundResources(user.id, id, "marketResearch", intentKey)
      
      logAIFailure("resources.market-research", aiError, {
        projectId: id,
        userId: user.id,
        operation: "marketResearch",
      })
      
      // @ts-expect-error — dynamic cache fields not in strict type
      const cachedResearch = project.resourcesCache?.marketResearch
      if (cachedResearch?.text) {
        return ok({
          text: cachedResearch.text,
          generatedAt: cachedResearch.generatedAt,
          cached: true,
          note: "Using previously generated research. The AI service is temporarily unavailable.",
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
        marketResearch: { text, generatedAt: Date.now() },
      },
    })

    return ok({ text, generatedAt: Date.now() })
  } catch (e) {
    return handleRouteError("resources.market-research", e)
  }
}
