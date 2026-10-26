import { requireUser } from "@/lib/auth/session"
import { store, cryptoId } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { generateText } from "ai"
import { MODEL } from "@/lib/analysis/model"
import { requestRawCompletion } from "@/lib/analysis/raw-chat"
import { logger } from "@/lib/logging/logger"
import {
  aiTimeoutUserMessage,
  describeErrorChain,
} from "@/lib/api/upstream-error"
import type { ConversationMessage, ProjectEvent } from "@/lib/types/project"
import {
  buildCollaborateContext,
  COFOUNDER_CHAT_SYSTEM,
  parseChatProposal,
  buildProposal,
} from "@/lib/analysis/cofounder"
import { chargeChatCredits, refundCollaboration } from "@/lib/analysis/collaborate-credits"
import { getPlanSection } from "@/lib/analysis/plan-sections"
import {
  appendProjectChatMessages,
  createProjectChat,
  deleteProjectChat,
  ensureLegacyProjectChat,
  getLatestProjectChat,
  getProjectChat,
} from "@/lib/collab-chat/store"

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
 * Request body: { message, activeSection?, chatId?, newChat? }
 * Response: { reply, proposal?, decisions, chatId, truncated }
 *
 * Threads are project-scoped (see lib/collab-chat/store.ts): each thread's own
 * messages form the model's collaboration memory, so past conversations stay
 * separate while accepted plan decisions remain shared across all of them.
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

    const body = (await req.json().catch(() => ({}))) as {
      message?: string
      activeSection?: string
      chatId?: string
      newChat?: boolean
    }
    const message = (body.message ?? "").trim()
    if (!message) {
      return fail("VALIDATION", "Please include a message.", 422)
    }
    if (message.length > 8000) {
      return fail("VALIDATION", "That message is too long.", 422)
    }
    const activeSection = typeof body.activeSection === "string" ? body.activeSection : null
    const requestedChatId = typeof body.chatId === "string" ? body.chatId.trim() : ""
    const startNewChat = body.newChat === true && !requestedChatId

    // Resolve the thread before charging so a stale chat id costs nothing.
    let chat = requestedChatId ? await getProjectChat(requestedChatId, id, user.id) : null
    if (requestedChatId && !chat) {
      return fail("CHAT_NOT_FOUND", "That conversation no longer exists. Start a new one.", 404)
    }
    if (!chat && !startNewChat) {
      // First message after deploy: adopt the imported legacy history (if any)
      // so the co-founder keeps its memory of earlier exchanges. An explicit
      // "new conversation" opts out — otherwise it would inherit the newest
      // thread instead of starting fresh.
      await ensureLegacyProjectChat(project, user.id)
      chat = await getLatestProjectChat(id, user.id)
    }

    // Charge before the model call — refuse when the user can't afford it.
    const charged = await chargeChatCredits(user.id, id)
    if (!charged) {
      return fail("INSUFFICIENT_CREDITS", "You don't have enough credits for this message.", 402)
    }

    let createdChat = false
    if (!chat) {
      chat = await createProjectChat(id, user.id)
      createdChat = true
    }
    const activeChat = chat

    // A failed first turn should not leave an empty thread in the history list.
    const dropEmptyChat = async () => {
      if (!createdChat) return
      await deleteProjectChat(activeChat.id, id, user.id).catch(() => {})
    }

    const spec = project.specification

    const context = buildCollaborateContext({
      spec,
      preferences: project.preferences,
      // Accepted proposals are recorded as planUpdateNotes on the project.
      decisions: project.planUpdateNotes ?? [],
      conversation: activeChat.messages ?? [],
      activeSection,
      founderVision: project.idea,
      sourceUrl: project.sourceUrl,
    })

    const chatPrompt = `${context}\n\n---\nFOUNDER MESSAGE:\n${activeSection
      ? `[Working on: ${getPlanSection(activeSection)?.label ?? activeSection} (${activeSection})]\n`
      : ""
      }${message}`

    let reply = ""
    let truncated = false
    let aiFailure: unknown = null
    try {
      const result = await generateText({
        model: MODEL,
        system: COFOUNDER_CHAT_SYSTEM,
        prompt: chatPrompt,
        maxOutputTokens: 4096, // Increased from 2048 to allow detailed, production-ready responses
        // Free-tier models intermittently fail to even open a connection (the
        // provider reports these as retryable network errors). Without retries
        // a single ~10s connect timeout is a 500 for the founder.
        maxRetries: 3,
        abortSignal: AbortSignal.timeout(180_000), // generous enough to survive retry + slow free-tier queueing
      })
      reply = result.text
      truncated = result.finishReason === "length"
    } catch (aiError) {
      aiFailure = aiError
    }

    // A rejected payload or an empty answer still means the co-founder wrote
    // something the SDK wouldn't hand back. Read the provider's reply directly
    // so the founder sees it instead of an error.
    if (!reply.trim()) {
      const salvaged = await requestRawCompletion({
        system: COFOUNDER_CHAT_SYSTEM,
        prompt: chatPrompt,
        maxOutputTokens: 4096,
      })
      if (salvaged?.text.trim()) {
        reply = salvaged.text
        truncated = salvaged.truncated
        logger.warn("api.projects.plan-chat", "recovered co-founder reply from the raw provider response", {
          detail: aiFailure ? describeErrorChain(aiFailure).join(" <- ") : "empty completion from SDK",
        })
      } else {
        // The charge already happened — give the credits back so a provider
        // outage never costs the user money (spec section 43).
        await dropEmptyChat()
        await refundCollaboration(user.id, id, "chat")
        if (aiFailure) {
          logger.error("api.projects.plan-chat", "co-founder reply failed", {
            detail: describeErrorChain(aiFailure).join(" <- "),
          })
          throw aiFailure
        }
        return fail("AI_UNAVAILABLE", aiTimeoutUserMessage(), 503)
      }
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
    await appendProjectChatMessages(activeChat.id, id, user.id, [userMsg, assistantMsg])
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
      chatId: activeChat.id,
      truncated,
    })
  } catch (e) {
    return handleRouteError("api.projects.plan-chat", e)
  }
}
