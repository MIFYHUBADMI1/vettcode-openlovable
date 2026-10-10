import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { generateText } from "ai"
import { MODEL } from "@/lib/analysis/model"
import { chargeCompetitors, refundResources } from "@/lib/resources/resources-credits"

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

    const charged = await chargeCompetitors(user.id, id)
    if (!charged) {
      return fail("INSUFFICIENT_CREDITS", "You need 100 credits to research competitors.", 402)
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
      const result = await generateText({
        model: MODEL,
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: 3000,
      })

      const raw = result.text.trim()
      // Extract JSON array — handle cases where model wraps in markdown
      const jsonMatch = raw.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error("No JSON array found in response")
      competitors = JSON.parse(jsonMatch[0])
    } catch (aiError) {
      await refundResources(user.id, id, "competitors")
      throw aiError
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
