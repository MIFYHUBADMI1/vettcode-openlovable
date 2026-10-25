import "server-only"

/**
 * Content library service (Phase 4 v2).
 *
 * Durable, project-scoped reads and writes over `content_items`: bounded
 * search/filter with cursor pagination, rename, status, planning date,
 * duplicate, delete, and saving a generated variant.
 *
 * Every query is scoped by `projectId`. There is NO publish field and no
 * scheduler: `plannedAt` records the founder's own plan, and a passed date
 * never implies anything was published.
 */

import { ObjectId } from "mongodb"
import { contentItemsCol } from "@/lib/db/collections"
import { cryptoId } from "@/lib/store/store"
import { AppError } from "@/lib/errors"
import { logger } from "@/lib/logging/logger"
import type { ContentItemDoc, ContentItemStatus } from "@/lib/types/db"

export const LIBRARY_DEFAULT_LIMIT = 20
export const LIBRARY_MAX_LIMIT = 50
export const LIBRARY_STATUSES: readonly ContentItemStatus[] = ["draft", "ready_for_review"]

/** Filterable content kinds (the union of market kinds and legacy templates). */
export const LIBRARY_KINDS = [
  "copy",
  "email",
  "social",
  "timeline",
  "blog",
  "brief",
  "image",
  "voice",
  "video",
] as const
export type LibraryKind = (typeof LIBRARY_KINDS)[number]

/** v1 drafts predate `assetKind`; map their fixed templates into a kind. */
const LEGACY_TEMPLATES_BY_KIND: Partial<Record<LibraryKind, string[]>> = {
  copy: ["landing_hero", "feature_blurb", "ad_headline"],
  email: ["email_welcome"],
}

export interface LibraryQuery {
  q?: string
  kind?: LibraryKind
  status?: ContentItemStatus
  planned?: "any" | "planned" | "unplanned"
  limit?: number
  cursor?: string
}

function parseCursor(cursor: string | undefined): { updatedAt: number; id: string } | null {
  if (!cursor) return null
  const idx = cursor.indexOf("_")
  if (idx <= 0) return null
  const updatedAt = Number(cursor.slice(0, idx))
  const id = cursor.slice(idx + 1)
  if (!Number.isFinite(updatedAt) || !id) return null
  return { updatedAt, id }
}

function encodeCursor(updatedAt: number, id: string): string {
  return `${updatedAt}_${id}`
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Bounded, newest-first library search. Search matches title or body with a
 * capped regex (the query is escaped and length-limited, so it cannot inject
 * an expensive expression).
 */
export async function searchContentItems(
  projectId: string,
  query: LibraryQuery = {},
): Promise<{ items: ContentItemDoc[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(query.limit ?? LIBRARY_DEFAULT_LIMIT, 1), LIBRARY_MAX_LIMIT)
  const and: Record<string, unknown>[] = []

  if (query.kind) {
    const clauses: Record<string, unknown>[] = [{ assetKind: query.kind }]
    const legacy = LEGACY_TEMPLATES_BY_KIND[query.kind]
    if (legacy?.length) clauses.push({ template: { $in: legacy } })
    and.push({ $or: clauses })
  }
  if (query.status) and.push({ status: query.status })
  if (query.planned === "planned") and.push({ plannedAt: { $type: "number" } })
  if (query.planned === "unplanned") {
    and.push({ $or: [{ plannedAt: { $exists: false } }, { plannedAt: null }] })
  }

  const q = (query.q ?? "").trim().slice(0, 100)
  if (q) {
    const regex = escapeRegex(q)
    and.push({ $or: [{ title: { $regex: regex, $options: "i" } }, { body: { $regex: regex, $options: "i" } }] })
  }

  const cursor = parseCursor(query.cursor)
  if (cursor) {
    and.push({
      $or: [
        { updatedAt: { $lt: cursor.updatedAt } },
        { updatedAt: cursor.updatedAt, id: { $lt: cursor.id } },
      ],
    })
  }

  const filter: Record<string, unknown> = and.length ? { projectId, $and: and } : { projectId }
  const col = await contentItemsCol()
  const docs = (await col
    .find(filter)
    .sort({ updatedAt: -1, id: -1 })
    .limit(limit + 1)
    .toArray()) as unknown as ContentItemDoc[]

  const hasMore = docs.length > limit
  const page = hasMore ? docs.slice(0, limit) : docs
  const last = page[page.length - 1]

  return {
    items: page,
    nextCursor: hasMore && last ? encodeCursor(last.updatedAt, last.id) : null,
  }
}

/** One item, scoped by project — null when it belongs to another project. */
export async function getContentItem(projectId: string, contentId: string): Promise<ContentItemDoc | null> {
  if (!contentId) return null
  const col = await contentItemsCol()
  const doc = await col.findOne({ projectId, id: contentId })
  return (doc as unknown as ContentItemDoc) ?? null
}

/**
 * Update library metadata only (never the body — edits use the immutable
 * version path so nothing is silently overwritten).
 */
export async function updateContentItem(input: {
  projectId: string
  contentId: string
  title?: string
  status?: ContentItemStatus
  plannedAt?: number | null
  tags?: string[] | null
}): Promise<ContentItemDoc | null> {
  const set: Record<string, unknown> = { updatedAt: Date.now() }
  const unset: Record<string, 1> = {}

  if (input.title !== undefined) {
    const title = input.title.trim().slice(0, 200)
    if (!title) throw new AppError("VALIDATION", "A title is required.")
    set.title = title
  }
  if (input.status !== undefined) {
    if (!LIBRARY_STATUSES.includes(input.status)) throw new AppError("VALIDATION", "Unknown content status.")
    set.status = input.status
  }
  if (input.plannedAt !== undefined) {
    if (input.plannedAt === null) unset.plannedAt = 1
    else {
      if (!Number.isFinite(input.plannedAt)) throw new AppError("VALIDATION", "Invalid planned date.")
      set.plannedAt = input.plannedAt
    }
  }
  if (input.tags !== undefined) {
    const tags = input.tags === null ? [] : input.tags
    const cleaned = [...new Set(tags.map((t) => (t ?? "").trim()).filter(Boolean))].slice(0, 12)
    if (cleaned.length === 0) unset.tags = 1
    else set.tags = cleaned.map((t) => t.slice(0, 40))
  }

  const update: Record<string, unknown> = { $set: set }
  if (Object.keys(unset).length > 0) update.$unset = unset

  const col = await contentItemsCol()
  const result = await col.updateOne({ projectId: input.projectId, id: input.contentId }, update)
  if (result.matchedCount === 0) return null
  return getContentItem(input.projectId, input.contentId)
}

/** Copy an item into a NEW draft (v1). The original is never touched. */
export async function duplicateContentItem(input: {
  userId: string
  projectId: string
  contentId: string
}): Promise<ContentItemDoc> {
  const source = await getContentItem(input.projectId, input.contentId)
  if (!source) throw new AppError("VALIDATION", "We couldn't find that draft.", 404)

  const now = Date.now()
  const doc: ContentItemDoc = {
    _id: new ObjectId(),
    id: `content_${cryptoId()}`,
    userId: input.userId,
    projectId: input.projectId,
    kind: source.kind,
    template: source.template,
    status: "draft",
    title: `${source.title.slice(0, 180)} (copy)`,
    body: source.body,
    version: 1,
    origin: source.origin,
    creditsCharged: 0,
    ...(source.model ? { model: source.model } : {}),
    ...(source.assetKind ? { assetKind: source.assetKind } : {}),
    ...(source.media ? { media: source.media } : {}),
    ...(source.brief ? { brief: source.brief } : {}),
    ...(source.channel ? { channel: source.channel } : {}),
    ...(source.tags ? { tags: source.tags } : {}),
    createdAt: now,
    updatedAt: now,
  }

  const col = await contentItemsCol()
  await col.insertOne(doc as never)
  logger.info("marketing.studio.library", "content duplicated", { projectId: input.projectId, id: doc.id })
  return doc
}

/** Persist a generated alternative as its own draft, linked to its source. */
export async function saveContentVariant(input: {
  userId: string
  projectId: string
  sourceId: string
  title: string
  body: string
}): Promise<ContentItemDoc> {
  const source = await getContentItem(input.projectId, input.sourceId)
  if (!source) throw new AppError("VALIDATION", "We couldn't find that draft.", 404)

  const body = input.body.trim()
  if (!body) throw new AppError("VALIDATION", "A variation needs content.")

  const now = Date.now()
  const doc: ContentItemDoc = {
    _id: new ObjectId(),
    id: `content_${cryptoId()}`,
    userId: input.userId,
    projectId: input.projectId,
    kind: source.kind,
    template: source.template,
    status: "draft",
    title: (input.title.trim() || "Variation").slice(0, 200),
    body: body.slice(0, 20000),
    version: 1,
    origin: source.origin,
    variantOf: source.variantOf ?? source.id,
    creditsCharged: 0,
    ...(source.model ? { model: source.model } : {}),
    ...(source.assetKind ? { assetKind: source.assetKind } : {}),
    ...(source.channel ? { channel: source.channel } : {}),
    createdAt: now,
    updatedAt: now,
  }

  const col = await contentItemsCol()
  await col.insertOne(doc as never)
  return doc
}

/** Delete one stored item, project-scoped. False when nothing matched. */
export async function deleteContentItem(input: { projectId: string; contentId: string }): Promise<boolean> {
  const col = await contentItemsCol()
  const result = await col.deleteOne({ projectId: input.projectId, id: input.contentId })
  if (result.deletedCount > 0) {
    logger.info("marketing.studio.library", "content deleted", { projectId: input.projectId, id: input.contentId })
    return true
  }
  return false
}

/**
 * Planned content for the calendar. A bounded window keeps the read small; the
 * rows are plans only — nothing is scheduled externally.
 */
export async function listPlannedContent(
  projectId: string,
  options: { from?: number; to?: number; limit?: number } = {},
): Promise<ContentItemDoc[]> {
  const limit = Math.min(Math.max(options.limit ?? LIBRARY_MAX_LIMIT, 1), LIBRARY_MAX_LIMIT)
  const range: Record<string, unknown> = { $type: "number" }
  if (Number.isFinite(options.from)) range.$gte = options.from
  if (Number.isFinite(options.to)) range.$lte = options.to

  const col = await contentItemsCol()
  return (await col
    .find({ projectId, plannedAt: range })
    .sort({ plannedAt: 1, id: 1 })
    .limit(limit)
    .toArray()) as unknown as ContentItemDoc[]
}
