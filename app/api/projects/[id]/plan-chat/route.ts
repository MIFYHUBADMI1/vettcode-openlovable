import { requireUser } from "@/lib/auth/session"
import { store, cryptoId } from "@/lib/store/store"
import { ok, fail, handleRouteError } from "@/lib/api/respond"
import { generateText } from "ai"
import { MODEL } from "@/lib/analysis/model"
import { requestRawCompletion, streamRawCompletion } from "@/lib/analysis/raw-chat"
import { createPlanUpdateFilter } from "@/lib/analysis/plan-update-stream"
import { logger } from "@/lib/logging/logger"
import {
  aiTimeoutUserMessage,
  describeErrorChain,
} from "@/lib/api/upstream-error"
import type { ConversationMessage, ProjectEvent } from "@/lib/types/project"
import type { ApplicationSpecification } from "@/lib/types/specification"
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
 * Request body: { message, activeSection?, chatId?, newChat?, stream? }
 * Response: { reply, proposal?, decisions, chatId, truncated }
 *
 * With `stream: true` the response is newline-delimited JSON instead, so the
 * founder watches the answer being written rather than waiting for it:
 *   {chatId}                                    — the thread this turn belongs to
 *   {delta}                                     — visible prose, protocol withheld
 *   {done, proposal, truncated, decisions}      — the turn is finished and stored
 *   {error: { code, message }}                  — nothing usable arrived (refunded)
 *
 * Closing that stream early is the founder's Stop button: the provider request
 * is cancelled with it. Whatever already arrived stays in the transcript and is
 * paid for; a stop before the first word costs nothing.
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
      /** NDJSON streaming response: prose arrives as it is written. */
      stream?: boolean
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
      // Flagged gaps/weaknesses from the last plan analysis — proposal
      // prompts must trace back to these instead of inventing critiques.
      findings: project.planAnalysis?.findings ?? [],
      conversation: activeChat.messages ?? [],
      activeSection,
      founderVision: project.idea,
      sourceUrl: project.sourceUrl,
    })

    const chatPrompt = `${context}\n\n---\nFOUNDER MESSAGE:\n${activeSection
      ? `[Working on: ${getPlanSection(activeSection)?.label ?? activeSection} (${activeSection})]\n`
      : ""
      }${message}`

    const turnContext = {
      spec,
      projectId: id,
      userId: user.id,
      chatId: activeChat.id,
      message,
      decisions: project.planUpdateNotes ?? [],
      context: chatPrompt,
      createdChat,
    }

    // Streaming: the founder watches the co-founder write instead of staring
    // at a spinner through a 30–90s free-tier wait.
    if (body.stream === true) {
      return streamChatTurn(turnContext)
    }

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

    return ok(await finalizeChatTurn(turnContext, reply, truncated))
  } catch (e) {
    return handleRouteError("api.projects.plan-chat", e)
  }
}

interface ChatTurnContext {
  spec: ApplicationSpecification
  projectId: string
  userId: string
  chatId: string
  message: string
  decisions: string[]
  /** The fully built prompt (context + founder message). */
  context: string
  createdChat: boolean
}

/** Parse the reply, persist the exchange and shape the client payload. Shared
 * by the JSON and streaming responses so both store the same transcript. */
async function finalizeChatTurn(ctx: ChatTurnContext, rawReply: string, truncated: boolean) {
  const { cleanReply, proposal: parsedProposal } = parseChatProposal(rawReply)

  // Build the reviewable proposal (current value stamped from the real spec).
  const proposal = parsedProposal ? buildProposal(ctx.spec, parsedProposal, "chat") : undefined

  // Persist the exchange so the co-founder remembers the collaboration.
  const userMsg: ConversationMessage = {
    id: cryptoId(),
    role: "user",
    content: ctx.message,
    at: Date.now(),
  }
  const assistantMsg: ConversationMessage = {
    id: cryptoId(),
    role: "assistant",
    content: cleanReply,
    at: Date.now(),
  }
  await appendProjectChatMessages(ctx.chatId, ctx.projectId, ctx.userId, [userMsg, assistantMsg])
  await store.appendMessage(ctx.projectId, userMsg)
  await store.appendMessage(ctx.projectId, assistantMsg)
  await store.appendEvent(
    ctx.projectId,
    event("plan", `💬 Co-founder session: "${ctx.message.slice(0, 60)}${ctx.message.length > 60 ? "…" : ""}"`),
  )

  return {
    reply: cleanReply,
    proposal: proposal ?? null,
    decisions: ctx.decisions.length,
    chatId: ctx.chatId,
    truncated,
  }
}

function ndjsonFrame(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value)}\n`)
}

/**
 * NDJSON turn: `{chatId}` then `{delta}` frames, ending with either
 * `{done, proposal, truncated, decisions}` or `{error}`.
 *
 * The headers are sent before the model answers, so every failure path has to
 * be reported inside the stream. Nothing arrived means the founder's credits
 * go back; anything at all arriving means they keep them — the reply is real
 * work even when the provider cut it short.
 *
 * A founder pressing Stop tears the HTTP response down. Next aborts the pipe,
 * which cancels this stream, and `cancel()` forwards that to the provider
 * request — so stopping mid-wait costs the model nothing it wasn't asked for
 * and costs the founder nothing they didn't read.
 */
async function streamChatTurn(ctx: ChatTurnContext): Promise<Response> {
  const dropEmptyChat = async () => {
    if (!ctx.createdChat) return
    await deleteProjectChat(ctx.chatId, ctx.projectId, ctx.userId).catch(() => {})
  }

  const turn = new AbortController()
  let founderLeft = false

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let frameLost = false
      const send = (value: unknown) => {
        if (frameLost || founderLeft) return
        try {
          controller.enqueue(ndjsonFrame(value))
        } catch {
          // The response is gone; keep working, just stop talking.
          frameLost = true
        }
      }
      const filter = createPlanUpdateFilter()
      let visible = ""

      try {
        send({ chatId: ctx.chatId })

        const streamed = await streamRawCompletion({
          system: COFOUNDER_CHAT_SYSTEM,
          prompt: ctx.context,
          maxOutputTokens: 4096,
          abortSignal: turn.signal,
          onDelta: (chunk) => {
            const safe = filter.push(chunk)
            if (!safe) return
            visible += safe
            send({ delta: safe })
          },
        })

        let rawReply = streamed.text
        let truncated = streamed.truncated

        // A stream that never started is exactly the case the raw single-shot
        // reader was built for: the provider answered, the transport didn't.
        // Someone who stopped the turn asked for no second attempt.
        if (streamed.failed && !founderLeft) {
          const salvaged = await requestRawCompletion({
            system: COFOUNDER_CHAT_SYSTEM,
            prompt: ctx.context,
            maxOutputTokens: 4096,
          })
          if (salvaged?.text.trim()) {
            rawReply = salvaged.text
            truncated = salvaged.truncated
            logger.warn("api.projects.plan-chat", "streaming unavailable, recovered the reply in one piece", {
              projectId: ctx.projectId,
            })
            const safe = filter.push(salvaged.text) + filter.flush()
            if (safe) {
              visible += safe
              send({ delta: safe })
            }
          }
        }

        if (founderLeft) {
          // Whatever they read is what they get kept on record for; a stop
          // before the first word is free.
          if (rawReply.trim()) {
            await finalizeChatTurn(ctx, rawReply, true).catch(() => {})
          } else {
            await dropEmptyChat()
            await refundCollaboration(ctx.userId, ctx.projectId, "chat")
            logger.info("api.projects.plan-chat", "founder stopped the turn before any reply arrived", {
              projectId: ctx.projectId,
            })
          }
          return
        }

        if (!rawReply.trim()) {
          await dropEmptyChat()
          await refundCollaboration(ctx.userId, ctx.projectId, "chat")
          send({ error: { code: "AI_UNAVAILABLE", message: aiTimeoutUserMessage() } })
          return
        }

        const result = await finalizeChatTurn(ctx, rawReply, truncated)
        send({ done: true, proposal: result.proposal, truncated: result.truncated, decisions: result.decisions })
      } catch (e) {
        // Whatever the founder already watched get written is worth keeping.
        logger.error("api.projects.plan-chat", "streamed turn failed", {
          projectId: ctx.projectId,
          visibleLength: visible.length,
          detail: describeErrorChain(e).join(" <- "),
        })
        if (!visible.trim()) {
          await dropEmptyChat().catch(() => {})
          await refundCollaboration(ctx.userId, ctx.projectId, "chat").catch(() => {})
        }
        send({ error: { code: "UNKNOWN", message: "The co-founder's reply stopped mid-sentence. Please try again." } })
      } finally {
        try {
          controller.close()
        } catch {
          // Already closed by the cancel path.
        }
      }
    },
    cancel() {
      founderLeft = true
      turn.abort()
    },
  })

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
    },
  })
}
