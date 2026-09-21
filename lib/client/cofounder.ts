"use client"

import { postJson } from "@/lib/client/api"
import type { CofounderConversationMessage, ToolResult, ToolResultType } from "@/lib/cofounder/types"

/**
 * Client-side Co-founder API (spec sections 60–62). Thin wrappers over the
 * existing envelope-unwrapping fetch helpers — no second transport layer.
 */

export interface CofounderTurnResponse {
  conversationId: string
  reply: string
  messages: CofounderConversationMessage[]
  preparedActions: Array<{ id: string; toolName: string; description: string }>
  maxToolSteps: number
}

export interface CofounderActionResponse {
  status: "executed" | "rejected"
  result?: ToolResult
}

export interface CofounderRouteContext {
  activeProjectId?: string
  currentRoute?: string
  currentSurface?: string
}

/** Send one conversation turn. The server owns auth, context, and tools. */
export function sendCofounderMessage(
  message: string,
  conversationId: string | undefined,
  context: CofounderRouteContext = {},
): Promise<CofounderTurnResponse> {
  return postJson<CofounderTurnResponse>("/api/cofounder", {
    ...(conversationId ? { conversationId } : {}),
    message,
    ...(context.activeProjectId ? { activeProjectId: context.activeProjectId } : {}),
    ...(context.currentRoute ? { currentRoute: context.currentRoute } : {}),
    ...(context.currentSurface ? { currentSurface: context.currentSurface } : {}),
  })
}

/** Approve (optionally with a typed confirm word) or reject a pending action. */
export function decideCofounderAction(
  actionId: string,
  decision: "approve" | "reject",
  confirmWord?: string,
): Promise<CofounderActionResponse> {
  return postJson<CofounderActionResponse>(`/api/cofounder/actions/${encodeURIComponent(actionId)}`, {
    decision,
    ...(confirmWord ? { confirmWord } : {}),
  })
}

export type { CofounderConversationMessage, ToolResultType }
