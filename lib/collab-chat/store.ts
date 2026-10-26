import "server-only"
import { ObjectId } from "mongodb"
import { projectChatsCol, projectsCol } from "@/lib/db/collections"
import { cryptoId } from "@/lib/store/id"
import {
  DEFAULT_PROJECT_CHAT_TITLE,
  MAX_PROJECT_CHAT_MESSAGES,
  MAX_PROJECT_CHAT_TITLE,
  type ProjectChat,
  type ProjectChatMessage,
  type ProjectChatMongoDoc,
  type ProjectChatSummary,
} from "@/lib/types/collab-chat"
import type { MirrorProject } from "@/lib/types/project"

/**
 * Persistence for project-scoped co-founder conversations.
 *
 * Every query is scoped by projectId AND userId — a chat id alone is never
 * enough to read or mutate a thread.
 */

const PREVIEW_LENGTH = 140

function toChat(doc: ProjectChatMongoDoc): ProjectChat {
  const messages = doc.messages ?? []
  return {
    id: doc.id,
    projectId: doc.projectId,
    userId: doc.userId,
    title: doc.title,
    preview: previewOf(messages),
    messageCount: messages.length,
    messages,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

function previewOf(messages: ProjectChatMessage[]): string | undefined {
  const last = messages[messages.length - 1]
  if (!last?.content) return undefined
  const flat = last.content.replace(/\s+/g, " ").trim()
  return flat.length > PREVIEW_LENGTH ? `${flat.slice(0, PREVIEW_LENGTH - 1)}…` : flat
}

/** Derive a human title from the first founder message. */
export function deriveProjectChatTitle(message: string): string {
  const flat = message.replace(/\s+/g, " ").trim()
  if (!flat) return DEFAULT_PROJECT_CHAT_TITLE
  return flat.length > 60 ? `${flat.slice(0, 59).trimEnd()}…` : flat
}

export function sanitizeProjectChatTitle(title: string): string {
  return title.replace(/\s+/g, " ").trim().slice(0, MAX_PROJECT_CHAT_TITLE)
}

export async function listProjectChats(projectId: string, userId: string): Promise<ProjectChatSummary[]> {
  const col = await projectChatsCol()
  const rows = await col
    .aggregate<{
      id: string
      title: string
      createdAt: number
      updatedAt: number
      messageCount: number
      preview?: string
      lastContent?: string
    }>([
      { $match: { projectId, userId } },
      { $sort: { updatedAt: -1 } },
      { $limit: 100 },
      {
        $project: {
          _id: 0,
          id: 1,
          title: 1,
          createdAt: 1,
          updatedAt: 1,
          messageCount: { $size: { $ifNull: ["$messages", []] } },
          lastContent: {
            $let: {
              vars: { last: { $arrayElemAt: [{ $ifNull: ["$messages", []] }, -1] } },
              in: "$$last.content",
            },
          },
        },
      },
    ])
    .toArray()

  return rows.map((row) => {
    const flat = typeof row.lastContent === "string" ? row.lastContent.replace(/\s+/g, " ").trim() : ""
    return {
      id: row.id,
      title: row.title || DEFAULT_PROJECT_CHAT_TITLE,
      preview: flat
        ? flat.length > PREVIEW_LENGTH
          ? `${flat.slice(0, PREVIEW_LENGTH - 1)}…`
          : flat
        : undefined,
      messageCount: row.messageCount ?? 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  })
}

export async function getProjectChat(
  chatId: string,
  projectId: string,
  userId: string,
): Promise<ProjectChat | null> {
  const col = await projectChatsCol()
  const doc = await col.findOne({ id: chatId, projectId, userId })
  return doc ? toChat(doc) : null
}

export async function getLatestProjectChat(projectId: string, userId: string): Promise<ProjectChat | null> {
  const col = await projectChatsCol()
  const doc = await col.find({ projectId, userId }).sort({ updatedAt: -1 }).limit(1).next()
  return doc ? toChat(doc) : null
}

export async function createProjectChat(
  projectId: string,
  userId: string,
  title?: string,
): Promise<ProjectChat> {
  const now = Date.now()
  const doc: ProjectChat = {
    id: `pc_${cryptoId()}`,
    projectId,
    userId,
    title: title ? sanitizeProjectChatTitle(title) || DEFAULT_PROJECT_CHAT_TITLE : DEFAULT_PROJECT_CHAT_TITLE,
    preview: undefined,
    messageCount: 0,
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
  const col = await projectChatsCol()
  await col.insertOne({ ...doc, _id: new ObjectId() })
  return doc
}

export async function renameProjectChat(
  chatId: string,
  projectId: string,
  userId: string,
  title: string,
): Promise<boolean> {
  const clean = sanitizeProjectChatTitle(title)
  if (!clean) return false
  const col = await projectChatsCol()
  const result = await col.updateOne(
    { id: chatId, projectId, userId },
    { $set: { title: clean, updatedAt: Date.now() } },
  )
  return result.matchedCount > 0
}

export async function deleteProjectChat(chatId: string, projectId: string, userId: string): Promise<boolean> {
  const col = await projectChatsCol()
  const result = await col.deleteOne({ id: chatId, projectId, userId })
  return result.deletedCount > 0
}

/** Append a turn and keep the document bounded. Titles still sitting at the
 * default are derived from the first founder message. */
export async function appendProjectChatMessages(
  chatId: string,
  projectId: string,
  userId: string,
  messages: ProjectChatMessage[],
): Promise<string | null> {
  if (!messages.length) return null
  const col = await projectChatsCol()
  const existing = await col.findOne(
    { id: chatId, projectId, userId },
    { projection: { id: 1, title: 1 } },
  )
  if (!existing) return null

  const set: Record<string, unknown> = { updatedAt: Date.now() }
  const firstUser = messages.find((m) => m.role === "user")
  if (firstUser && (!existing.title || existing.title === DEFAULT_PROJECT_CHAT_TITLE)) {
    set.title = deriveProjectChatTitle(firstUser.content)
  }

  await col.updateOne(
    { id: chatId, projectId, userId },
    {
      $push: { messages: { $each: messages, $slice: -MAX_PROJECT_CHAT_MESSAGES } },
      $set: set,
    },
  )
  return typeof set.title === "string" ? set.title : existing.title ?? null
}

/**
 * One-time import of the pre-thread `project.conversation` history so existing
 * founders keep their past exchanges. The project records that the import ran
 * even when there was nothing to copy, so deleting the imported thread does
 * not resurrect it.
 */
export async function ensureLegacyProjectChat(project: MirrorProject, userId: string): Promise<void> {
  if (project.collabChatHistoryImportedAt) return
  const now = Date.now()
  const history = (project.conversation ?? []).slice(-MAX_PROJECT_CHAT_MESSAGES)

  if (history.length) {
    const col = await projectChatsCol()
    const first = history[0]
    const last = history[history.length - 1]
    try {
      await col.updateOne(
        { id: `pc_legacy_${project.id}` },
        {
          $setOnInsert: {
            id: `pc_legacy_${project.id}`,
            projectId: project.id,
            userId,
            title: "Earlier conversation",
            messages: history,
            createdAt: first?.at ?? now,
            updatedAt: last?.at ?? now,
          } satisfies ProjectChatMongoDoc,
        },
        { upsert: true },
      )
    } catch (e) {
      // Two surfaces (desktop + mobile panel) can request the list at the same
      // time; the unique id index makes one upsert lose. The winner's copy is
      // identical, so a duplicate-key error is success.
      if ((e as { code?: number }).code !== 11000) throw e
    }
  }

  await (await projectsCol()).updateOne(
    { id: project.id, userId },
    { $set: { collabChatHistoryImportedAt: now } },
  )
}
