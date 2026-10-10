import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { generateText } from "ai"
import { MODEL } from "@/lib/analysis/model"
import { chargeActionPlan, refundResources } from "@/lib/resources/resources-credits"

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

    const charged = await chargeActionPlan(user.id, id)
    if (!charged) {
      return fail("INSUFFICIENT_CREDITS", "You need 50 credits to generate an action plan.", 402)
    }

    const spec = project.specification

    const systemPrompt = `You are a sharp, direct business strategist helping a founder build a real business.
You have full context of their product. Be specific, concrete, and actionable.
Never use vague corporate language. Write like a smart advisor who has built companies before.
Format your response in clean markdown with clear sections.`

    const userPrompt = `Generate a 30/60/90-day action plan for this business:

**Business**: ${spec.title || project.name}
**Type**: ${spec.applicationType || "Software application"}
**Description**: ${spec.description || spec.purpose || ""}
**Target customers**: ${(spec.targetUsers || []).join(", ") || "Not specified"}
**Business model**: ${spec.businessModel || "Not specified"}
**Revenue model**: ${spec.revenueModel || "Not specified"}
**Value proposition**: ${spec.valueProposition || "Not specified"}
**Stage**: ${project.state}

Write a concrete, specific 30/60/90-day action plan. For each phase include:
- 3-5 specific, measurable actions (not vague advice)
- The single most important metric to track
- One thing to deliberately NOT do (focus matters)

Be ruthlessly specific to this business type and stage. No generic startup advice.`

    let text: string
    try {
      const result = await generateText({
        model: MODEL,
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: 2000,
      })
      text = result.text
    } catch (aiError) {
      await refundResources(user.id, id, "actionPlan")
      throw aiError
    }

    // Cache on project
    await store.updateProject(id, {
      // @ts-expect-error — dynamic cache fields not in strict type
      resourcesCache: {
        // @ts-expect-error
        ...(project.resourcesCache ?? {}),
        actionPlan: { text, generatedAt: Date.now() },
      },
    })

    return ok({ text, generatedAt: Date.now() })
  } catch (e) {
    return handleRouteError("resources.action-plan", e)
  }
}
