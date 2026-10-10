import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { generateText } from "ai"
import { MODEL } from "@/lib/analysis/model"
import { chargeMarketResearch, refundResources } from "@/lib/resources/resources-credits"

export async function POST(
  _req: Request,
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

    const charged = await chargeMarketResearch(user.id, id)
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
      const result = await generateText({
        model: MODEL,
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: 2500,
      })
      text = result.text
    } catch (aiError) {
      await refundResources(user.id, id, "marketResearch")
      throw aiError
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
