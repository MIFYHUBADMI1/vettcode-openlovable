import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { chargeMarketingPlaybook, refundResources } from "@/lib/resources/resources-credits"
import { getMarketingChannels } from "@/lib/resources/business-intelligence"
import { scopedIntentKey } from "@/lib/billing/operation-identity"
import { generateWithRetry, logAIFailure } from "@/lib/resources/ai-retry"
import { refuseInsufficientCredits } from "@/lib/api/credit-refusal"
import { RESOURCES_CREDIT_COSTS } from "@/lib/resources/credit-costs"

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

    const body = await req.json().catch(() => ({})) as { channel?: string; requestId?: unknown }
    const targetChannel = body.channel // optional: generate playbook for a specific channel

    // Optional client intent id — validated + scoped, never authorization.
    const intentKey = scopedIntentKey(body.requestId, { userId: user.id, operation: "resources_playbook", projectId: id })
    const charged = await chargeMarketingPlaybook(user.id, id, intentKey)
    if (!charged) {
      return refuseInsufficientCredits(
        user.id,
        RESOURCES_CREDIT_COSTS.marketingPlaybook,
        `You need ${RESOURCES_CREDIT_COSTS.marketingPlaybook} credits to generate a marketing playbook.`,
      )
    }

    const spec = project.specification
    const channels = getMarketingChannels(spec)
    const topChannels = channels.filter(c => c.fit === "high").slice(0, 3)

    const systemPrompt = `You are an expert growth marketer who has scaled multiple software businesses.
Write specific, tactical marketing playbooks — not strategy overviews.
Include exact copy angles, message templates, and week-by-week plans.
Be ruthlessly specific to this business type. No generic marketing advice.
Format in clean, scannable markdown.`

    const channelContext = targetChannel
      ? `Focus specifically on: ${targetChannel}`
      : `Focus on the top channels: ${topChannels.map(c => c.name).join(", ")}`

    const userPrompt = `Write a 90-day marketing playbook for this business.

**Business**: ${spec.title || project.name}
**Type**: ${spec.applicationType || "Software application"}
**Description**: ${spec.description || spec.purpose || ""}
**Target customers**: ${(spec.targetUsers || []).join(", ") || "Not specified"}
**Business model**: ${spec.businessModel || "Not specified"}
**Value proposition**: ${spec.valueProposition || "Not specified"}
**Market positioning**: ${spec.marketPositioning || "Not specified"}

${channelContext}

For each channel include:
1. **Why this channel fits this specific business** (2-3 sentences, be specific)
2. **Months 1-3 Week-by-Week Plan** with concrete weekly actions
3. **Message angles** — 3 specific copy angles / hooks to test
4. **Sample headline or opening line** — write actual copy, not a description
5. **The one metric to track** for this channel
6. **What success looks like at 90 days**

Also include a **Channel Priority Order** — which to start first and why.
And a **Common Mistakes** section — what founders in this niche typically get wrong.`

    let text: string
    try {
      text = await generateWithRetry(
        { system: systemPrompt, prompt: userPrompt },
        { maxOutputTokens: 3000 },
      )
    } catch (aiError) {
      await refundResources(user.id, id, "marketingPlaybook", intentKey)
      
      logAIFailure("resources.marketing-playbook", aiError, {
        projectId: id,
        userId: user.id,
        operation: "marketingPlaybook",
      })
      
      // @ts-expect-error — dynamic cache fields not in strict type
      const cachedPlaybook = project.resourcesCache?.marketingPlaybook
      if (cachedPlaybook?.text) {
        return ok({
          text: cachedPlaybook.text,
          generatedAt: cachedPlaybook.generatedAt,
          cached: true,
          note: "Using previously generated playbook. The AI service is temporarily unavailable.",
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
        marketingPlaybook: { text, generatedAt: Date.now() },
      },
    })

    return ok({ text, generatedAt: Date.now() })
  } catch (e) {
    return handleRouteError("resources.marketing-playbook", e)
  }
}
