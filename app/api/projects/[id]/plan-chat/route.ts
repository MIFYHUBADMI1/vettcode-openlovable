import { requireUser } from "@/lib/auth/session"
import { store, cryptoId } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { generateText } from "ai"
import { MODEL } from "@/lib/analysis/model"
import type { ConversationMessage, ProjectEvent } from "@/lib/types/project"
import {
  buildCollaborateContext,
  COFOUNDER_CHAT_SYSTEM,
  parseChatProposal,
  buildProposal,
} from "@/lib/analysis/cofounder"
import { chargeChatCredits, refundCollaboration } from "@/lib/analysis/collaborate-credits"

function event(stage: string, message: string, level: ProjectEvent["level"] = "info"): ProjectEvent {
  return { id: cryptoId(), at: Date.now(), level, stage, message }
}

/**
 * POST /api/projects/[id]/plan-chat
 *
 * AI Co-Founder chat for the Collaborate workspace. The model receives the
 * real project context and MAY propose a plan-section update, returned to
 * the client as a structured proposal. The plan is NEVER modified by this
 * endpoint — approved changes persist through PATCH /api/projects/[id]
 * (spec sections 22, 28, 31).
 *
 * Charges a small credit amount per message (existing ledger).
 * Request body: { message: string, activeSection?: string }
 * Response: { reply, proposal?, decisions }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser()
    const { id } = await params

    const project = await store.getProject(id)
    if (!project || project.userId !== user.id) {
      return fail("UNAUTHORIZED_PROJECT_ACCESS", "Project not found.", 404)
    }

    if (!project.specification) {
      return fail("VALIDATION", "This project has no application plan to discuss yet.", 409)
    }

    const body = (await req.json().catch(() => ({}))) as { message?: string; activeSection?: string }
    const message = (body.message ?? "").trim()
    if (!message) {
      return fail("VALIDATION", "Please include a message.", 422)
    }
    if (message.length > 8000) {
      return fail("VALIDATION", "That message is too long.", 422)
    }
    const activeSection = typeof body.activeSection === "string" ? body.activeSection : null

    // Charge before the model call — refuse when the user can't afford it.
    const charged = await chargeChatCredits(user.id, id)
    if (!charged) {
      return fail("INSUFFICIENT_CREDITS", "You don't have enough credits for this message.", 402)
    }

    const spec = project.specification

    const context = buildCollaborateContext({
      spec,
      preferences: project.preferences,
      // Accepted proposals are recorded as planUpdateNotes on the project.
      decisions: project.planUpdateNotes ?? [],
      conversation: project.conversation ?? [],
      activeSection,
      founderVision: project.idea,
      sourceUrl: project.sourceUrl,
    })

    let reply: string
    try {
      const result = await generateText({
        model: MODEL,
        system: COFOUNDER_CHAT_SYSTEM,
        prompt: `${context}\n\n---\nFOUNDER MESSAGE:\n${message}`,
        maxOutputTokens: 4096,
      })
      reply = result.text
    } catch (aiError) {
      // The charge already happened — give the credits back so a provider
      // outage never costs the user money (spec section 43).
      await refundCollaboration(user.id, id, "chat")
      throw aiError
    }

    const { cleanReply, proposal: parsedProposal } = parseChatProposal(reply)

    // Build the reviewable proposal (current value stamped from the real spec).
    const proposal = parsedProposal ? buildProposal(spec, parsedProposal, "chat") : undefined

    // Persist the exchange so the co-founder remembers the collaboration.
    const userMsg: ConversationMessage = {
      id: cryptoId(),
      role: "user",
      content: message,
      at: Date.now(),
    }
    const assistantMsg: ConversationMessage = {
      id: cryptoId(),
      role: "assistant",
      content: cleanReply,
      at: Date.now(),
    }
    await store.appendMessage(id, userMsg)
    await store.appendMessage(id, assistantMsg)
    await store.appendEvent(
      id,
      event("plan", `💬 Co-founder session: "${message.slice(0, 60)}${message.length > 60 ? "…" : ""}"`),
    )

    return ok({
      reply: cleanReply,
      proposal: proposal ?? null,
      decisions: (project.planUpdateNotes ?? []).length,
    })
  } catch (e) {
    return handleRouteError("api.projects.plan-chat", e)
  }
}
