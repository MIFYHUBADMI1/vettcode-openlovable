import "server-only"
import { generateText, tool, stepCountIs, type ToolSet } from "ai"
import { z } from "zod"
import { MODEL } from "@/lib/analysis/model"
import { store } from "@/lib/store/store"
import { buildAgentContextBlock, COFOUNDER_AGENT_SYSTEM } from "./prompts"
import { buildActiveProjectBrief } from "./context"
import { getTool, immediateTools, listTools } from "./tool-registry"
import { toToolOutcome } from "./errors"
import { cofounderMessage, appendCofounderMessages } from "./conversation"
import type { CofounderConversationMessage, ToolContext, ToolDefinition } from "./types"

/**
 * The bounded Co-founder agent loop (spec sections 38–40, 59).
 *
 * Phase 1 architecture (blocking generateText, no streaming): the model runs
 * with the immediate (READ / LOW_RISK_WRITE) tools registered natively via
 * ai@7's tool calling. Confirmation tools are NOT registered as executable —
 * when the model wants one, it calls the prepare_request tool and the loop
 * invokes the tool's prepare() phase, which only validates/prices and creates
 * a pending action. Mutations execute exclusively through the approval
 * endpoint after explicit founder approval.
 */

/** Hard bound on tool steps per turn — no infinite loops. */
export const MAX_TOOL_STEPS = 6

/** Structured request the model uses to reach a confirmation tool. */
const prepareRequestSchema = z.object({
  toolName: z.string().min(1).max(60),
  input: z.record(z.string(), z.unknown()),
}).strip()

export interface AgentTurnInput {
  user: ToolContext["user"]
  message: string
  conversationId: string
  activeProjectId?: string
  currentRoute?: string
  currentSurface?: string
}

export interface AgentTurnResult {
  reply: string
  messages: CofounderConversationMessage[]
  preparedActions: Array<{ id: string; toolName: string; description: string }>
}

/** Convert a registry tool definition into an ai@7 tool bound to ctx. */
function toAiTool(def: ToolDefinition, ctx: ToolContext) {
  return tool({
    description: def.description,
    inputSchema: def.inputSchema,
    execute: async (input: unknown) => {
      try {
        return await def.execute!(input, ctx)
      } catch (e) {
        return toToolOutcome(e, "That action failed. Please try again.")
      }
    },
  })
}

export async function runAgentTurn(input: AgentTurnInput): Promise<AgentTurnResult> {
  const ctx: ToolContext = {
    user: input.user,
    credits: { available: 0, balance: 0, reserved: 0 },
    conversationId: input.conversationId,
    ...(input.activeProjectId ? { activeProjectId: input.activeProjectId } : {}),
    ...(input.currentRoute ? { currentRoute: input.currentRoute } : {}),
    ...(input.currentSurface ? { currentSurface: input.currentSurface } : {}),
  }

  // Real balance for transparency (fail-safe to zeros).
  try {
    const { getAvailableCredits } = await import("@/lib/billing/credit-service")
    const available = await getAvailableCredits(input.user.id)
    ctx.credits = { available, balance: available, reserved: 0 }
  } catch {
    // keep zeros
  }

  const [activeBrief, recentProjects] = await Promise.all([
    input.activeProjectId ? buildActiveProjectBrief(input.activeProjectId, input.user.id) : Promise.resolve(null),
    // Compact recent-projects list from the same store listing the workspace
    // tools use — no separate query system (spec section 77).
    store
      .listProjects(input.user.id, 6)
      .then((projects) =>
        projects
          .filter((p) => p.id !== input.activeProjectId)
          .slice(0, 5)
          .map((p) => ({ id: p.id, name: p.name, state: p.state, updatedAt: p.updatedAt })),
      )
      .catch(() => []),
  ])

  const contextBlock = buildAgentContextBlock({
    userName: input.user.name,
    creditsAvailable: ctx.credits.available,
    ...(input.currentRoute ? { currentRoute: input.currentRoute } : {}),
    ...(input.currentSurface ? { currentSurface: input.currentSurface } : {}),
    ...(activeBrief ? { activeProject: activeBrief } : {}),
    recentProjects,
  })

  // Register ONLY immediate tools as executable + the prepare_request bridge
  // for confirmation tools.
  const tools: ToolSet = {}
  for (const def of immediateTools()) {
    tools[def.name] = toAiTool(def, ctx)
  }
  tools["prepare_request"] = tool({
    description:
      "Prepare a confirmation-required action for the founder's explicit approval (creating projects, plan changes, auto-complete, builds, follow-up edits, deployments, deletions). This NEVER executes the action — it returns a pending action the founder sees as a confirmation card. Pass toolName exactly as listed and the full input for that tool.",
    inputSchema: prepareRequestSchema,
    execute: async (rawInput: unknown) => {
      try {
        const parsed = prepareRequestSchema.parse(rawInput)
        const def = getTool(parsed.toolName)
        if (!def || !def.requiresConfirmation || !def.prepare) {
          return { success: false as const, error: { code: "VALIDATION", message: `Unknown or non-confirmable tool "${parsed.toolName}".` } }
        }
        const prepared = await def.prepare(parsed.input, ctx)
        if (!prepared.ok) return { success: false as const, error: prepared.error }
        // Stamp the conversation so the approval endpoint can append the
        // executed result back into THIS transcript (spec section 55).
        if (ctx.conversationId && !prepared.pending.conversationId) {
          const { cofounderPendingActionsCol } = await import("@/lib/db/collections")
          const col = await cofounderPendingActionsCol()
          await col.updateOne({ id: prepared.pending.id }, { $set: { conversationId: ctx.conversationId } })
          prepared.pending.conversationId = ctx.conversationId
        }
        return {
          success: true as const,
          type: "pending_action" as const,
          data: {
            pendingActionId: prepared.pending.id,
            toolName: prepared.pending.toolName,
            risk: prepared.pending.risk,
            description: prepared.pending.description,
            ...(prepared.pending.cost ? { cost: prepared.pending.cost } : {}),
            ...(prepared.pending.confirmWord ? { confirmWord: prepared.pending.confirmWord } : {}),
            ...(prepared.pending.items ? { items: prepared.pending.items } : {}),
            expiresAt: prepared.pending.expiresAt,
          },
          pendingActionId: prepared.pending.id,
        }
      } catch (e) {
        return toToolOutcome(e, "I couldn't prepare that action.")
      }
    },
  })

  const system = [
    buildSystemPrompt(),
    `AVAILABLE CONFIRMATION TOOLS (via prepare_request): ${listTools()
      .filter((t) => t.requiresConfirmation)
      .map((t) => t.name)
      .join(", ")}`,
  ].join("\n\n")

  const userMsg = cofounderMessage("user", input.message)

  let finalText = ""
  const preparedActions: AgentTurnResult["preparedActions"] = []
  const actionMessages: CofounderConversationMessage[] = []

  try {
    const result = await generateText({
      model: MODEL,
      system,
      prompt: `${contextBlock}\n\n---\nFOUNDER MESSAGE:\n${input.message}`,
      tools,
      stopWhen: stepCountIs(MAX_TOOL_STEPS),
      maxOutputTokens: 4096,
    })

    finalText = result.text

    // Collect pending-action results so the client can render confirmation
    // cards even if the model's prose is thin.
    for (const step of result.steps) {
      for (const part of step.content) {
        if (part.type === "tool-result" && (part as { toolName?: string }).toolName === "prepare_request") {
          const output = (part as unknown as { output?: { data?: Record<string, unknown> } }).output
          const data = output && typeof output === "object" ? (output.data ?? output) : undefined
          if (data && typeof data === "object" && "pendingActionId" in data) {
            preparedActions.push({
              id: String(data.pendingActionId),
              toolName: String(data.toolName ?? ""),
              description: String(data.description ?? ""),
            })
          }
        }
      }
    }

    // Persist an action-result message for every pending action so cards
    // render on reload too.
    for (const pa of preparedActions) {
      actionMessages.push(
        cofounderMessage("assistant", pa.description, {
          kind: "pending_action",
          actionId: pa.id,
          toolName: pa.toolName,
          risk: "CONFIRM",
          description: pa.description,
          expiresAt: Date.now() + 15 * 60 * 1000,
        }),
      )
    }
  } catch (e) {
    loggerSafe("error", "agent loop failed", { message: e instanceof Error ? e.message : String(e) })
    finalText = "I hit a problem reaching my tools. Please try again in a moment."
  }

  const assistantMsg = cofounderMessage("assistant", finalText)

  // Persist the exchange (conversation belongs to the user, survives navigation).
  await appendCofounderMessages(input.conversationId, input.user.id, [userMsg, assistantMsg, ...actionMessages], {
    ...(input.activeProjectId ? { activeProjectId: input.activeProjectId } : {}),
  })

  return {
    reply: finalText,
    messages: [userMsg, assistantMsg, ...actionMessages],
    preparedActions,
  }
}

/** The Co-founder system prompt (spec sections 30, 50). Route-aware context
 * ships in the user prompt block, not the system prompt. */
function buildSystemPrompt(): string {
  return COFOUNDER_AGENT_SYSTEM
}

function loggerSafe(level: "info" | "warn" | "error", message: string, fields?: Record<string, unknown>) {
  try {
    // Lazy import keeps the logger out of unit-test paths that stub modules.
    const { logger } = require("@/lib/logging/logger") as typeof import("@/lib/logging/logger")
    logger[level]("cofounder.agent", message, fields)
  } catch {
    // logging must never break the loop
  }
}
