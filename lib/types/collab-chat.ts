import type { ConversationMessage } from "@/lib/types/project"

/**
 * Project-scoped co-founder conversations (Collaborate workspace).
 *
 * Threads live in their own collection rather than on the project document so
 * history can grow without inflating every project read. Messages reuse the
 * shared `ConversationMessage` shape (id/role/content/at).
 */

export const DEFAULT_PROJECT_CHAT_TITLE = "New conversation"
export const MAX_PROJECT_CHAT_MESSAGES = 200
export const MAX_PROJECT_CHAT_TITLE = 80

export type ProjectChatMessage = ConversationMessage

/** Lightweight row for the history drawer — no message bodies beyond the
 * latest preview. */
export interface ProjectChatSummary {
  id: string
  title: string
  preview?: string
  messageCount: number
  createdAt: number
  updatedAt: number
}

export interface ProjectChat extends ProjectChatSummary {
  projectId: string
  userId: string
  messages: ProjectChatMessage[]
}

/** Mongo document shape (ObjectId primary + string mirror id). */
export interface ProjectChatMongoDoc {
  _id?: unknown
  id: string
  projectId: string
  userId: string
  title: string
  messages: ProjectChatMessage[]
  createdAt: number
  updatedAt: number
}
