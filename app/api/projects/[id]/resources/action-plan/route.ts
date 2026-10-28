import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { chargeActionPlan, refundResources } from "@/lib/resources/resources-credits"
import { scopedIntentKey } from "@/lib/billing/operation-identity"
import { generateWithRetry, logAIFailure } from "@/lib/resources/ai-retry"
import { refuseInsufficientCredits } from "@/lib/api/credit-refusal"
import { RESOURCES_CREDIT_COSTS } from "@/lib/resources/credit-costs"

/** Extract the optional client intent id (idempotency identity ONLY — never
 * authorization; `scopedIntentKey` validates it and scopes it to this
 * authenticated user + this ownership-checked project). */
async function readIntentKey(req: Request, userId: string, projectId: string): Promise<string | undefined> {
  const body = (await req.json().catch(() => null)) as { requestId?: unknown } | null
  return scopedIntentKey(body?.requestId, { userId, operation: "resources_action_plan", projectId })
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
    const charged = await chargeActionPlan(user.id, id, intentKey)
    if (!charged) {
      return refuseInsufficientCredits(
        user.id,
        RESOURCES_CREDIT_COSTS.actionPlan,
        `You need ${RESOURCES_CREDIT_COSTS.actionPlan} credits to generate an action plan.`,
      )
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
      text = await generateWithRetry(
        { system: systemPrompt, prompt: userPrompt },
        { maxOutputTokens: 2000 },
      )
    } catch (aiError) {
      // Refund credits on AI failure
      await refundResources(user.id, id, "actionPlan", intentKey)
      
      // Log the error for debugging
      logAIFailure("resources.action-plan", aiError, {
        projectId: id,
        userId: user.id,
        operation: "actionPlan",
      })
      
      // Check if we have a cached version to fall back to
      // @ts-expect-error — dynamic cache fields not in strict type
      const cachedPlan = project.resourcesCache?.actionPlan
      if (cachedPlan?.text) {
        // Return cached version with a note
        return ok({
          text: cachedPlan.text,
          generatedAt: cachedPlan.generatedAt,
          cached: true,
          note: "Using a previously generated plan. The AI service is temporarily unavailable.",
        })
      }
      
      // No cache — return a user-friendly error
      return fail(
        "AI_UNAVAILABLE",
        "The AI service is temporarily unavailable. Your credits have been refunded. Please try again in a few moments.",
        503,
      )
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
