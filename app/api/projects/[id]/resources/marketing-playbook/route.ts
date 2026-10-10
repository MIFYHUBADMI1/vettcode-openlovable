import { requireUser } from "@/lib/auth/session"
import { store } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { generateText } from "ai"
import { MODEL } from "@/lib/analysis/model"
import { chargeMarketingPlaybook, refundResources } from "@/lib/resources/resources-credits"
import { getMarketingChannels } from "@/lib/resources/business-intelligence"

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

    const body = await req.json().catch(() => ({})) as { channel?: string }
    const targetChannel = body.channel // optional: generate playbook for a specific channel

    const charged = await chargeMarketingPlaybook(user.id, id)
    if (!charged) {
      return fail("INSUFFICIENT_CREDITS", "You need 75 credits to generate a marketing playbook.", 402)
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
      const result = await generateText({
        model: MODEL,
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: 3000,
      })
      text = result.text
    } catch (aiError) {
      await refundResources(user.id, id, "marketingPlaybook")
      throw aiError
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
