import { ObjectId } from "mongodb"
import { AppError } from "@/lib/errors"
import { cryptoId } from "@/lib/store/id"
import { usersCol } from "@/lib/db/collections"
import {
  featureRequestInternalNotesCol,
  featureRequestStatusHistoryCol,
  featureRequestUpdatesCol,
  featureRequestVotesCol,
  featureRequestsCol,
} from "@/lib/db/collections"
import {
  categoryLabel,
  isFeatureRequestCategory,
  isFeatureRequestStatus,
  similarScore,
  type FeatureRequestCategory,
  type FeatureRequestStatus,
} from "./config"
import type { FeatureRequestDoc, PublicFeatureRequest } from "./types"

const PAGE_SIZE = 20
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export type ListSort = "popular" | "recent" | "updated" | "trending"

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

async function authorMap(ids: string[]) {
  if (ids.length === 0) return new Map<string, string>()
  const users = await usersCol()
  const docs = await users.find({ id: { $in: [...new Set(ids)] } }).project({ id: 1, name: 1 }).toArray()
  return new Map(docs.map((u) => [String(u.id), String(u.name || "Founder")]))
}

function toPublic(
  doc: FeatureRequestDoc,
  opts: { hasVoted: boolean; viewerId?: string; authorName: string },
): PublicFeatureRequest {
  return {
    id: doc.id,
    title: doc.title,
    description: doc.description,
    whyItMatters: doc.whyItMatters,
    category: doc.category,
    status: doc.status,
    voteCount: doc.voteCount,
    hasVoted: opts.hasVoted,
    author: { id: doc.authorId, name: opts.authorName },
    isAuthor: opts.viewerId === doc.authorId,
    canonicalRequestId: doc.canonicalRequestId,
    releaseNote: doc.releaseNote,
    releaseLink: doc.releaseLink,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

export async function listFeatureRequests(params: {
  viewerId?: string
  q?: string
  status?: FeatureRequestStatus | "all"
  category?: FeatureRequestCategory | "all"
  sort?: ListSort
  page?: number
  mine?: boolean
  voted?: boolean
}) {
  const col = await featureRequestsCol()
  const page = Math.max(1, params.page ?? 1)
  const filter: Record<string, unknown> = { hidden: { $ne: true } }
  if (params.status && params.status !== "all") filter.status = params.status
  if (params.category && params.category !== "all") filter.category = params.category
  if (params.mine && params.viewerId) filter.authorId = params.viewerId
  if (params.q?.trim()) {
    const rx = new RegExp(escapeRegex(params.q.trim()), "i")
    filter.$or = [{ title: rx }, { description: rx }, { whyItMatters: rx }]
  }
  if (params.voted && params.viewerId) {
    const votes = await featureRequestVotesCol()
    const ids = await votes.find({ userId: params.viewerId }).project({ featureRequestId: 1 }).toArray()
    filter.id = { $in: ids.map((v) => v.featureRequestId) }
  }

  const sort = params.sort ?? "popular"
  let mongoSort: Record<string, 1 | -1> = { voteCount: -1, createdAt: -1 }
  if (sort === "recent") mongoSort = { createdAt: -1 }
  if (sort === "updated") mongoSort = { updatedAt: -1 }
  if (sort === "trending") {
    filter.updatedAt = { $gte: Date.now() - 14 * 24 * 60 * 60 * 1000 }
    mongoSort = { voteCount: -1, updatedAt: -1 }
  }

  const [total, docs] = await Promise.all([
    col.countDocuments(filter),
    col.find(filter).sort(mongoSort).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).toArray(),
  ])

  const voted = new Set<string>()
  if (params.viewerId && docs.length) {
    const votes = await featureRequestVotesCol()
    const rows = await votes
      .find({ userId: params.viewerId, featureRequestId: { $in: docs.map((d) => d.id) } })
      .project({ featureRequestId: 1 })
      .toArray()
    for (const row of rows) voted.add(row.featureRequestId)
  }
  const names = await authorMap(docs.map((d) => d.authorId))
  return {
    page,
    pageSize: PAGE_SIZE,
    total,
    items: docs.map((d) =>
      toPublic(d, {
        hasVoted: voted.has(d.id),
        viewerId: params.viewerId,
        authorName: names.get(d.authorId) ?? "Founder",
      }),
    ),
  }
}

export async function findSimilarRequests(title: string, limit = 5) {
  const col = await featureRequestsCol()
  const docs = await col
    .find({ hidden: { $ne: true }, status: { $ne: "duplicate" } })
    .project({ id: 1, title: 1, voteCount: 1, status: 1 })
    .sort({ voteCount: -1 })
    .limit(80)
    .toArray()
  return docs
    .map((d) => ({
      id: d.id,
      title: d.title,
      voteCount: d.voteCount,
      status: d.status,
      score: similarScore(title, d.title),
    }))
    .filter((d) => d.score >= 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export async function createFeatureRequest(params: {
  authorId: string
  title: string
  description: string
  whyItMatters?: string
  category: string
  force?: boolean
}) {
  const title = params.title.trim()
  const description = params.description.trim()
  if (title.length < 8 || title.length > 120) {
    throw new AppError("VALIDATION", "Give your idea a short title (8–120 characters).", 400)
  }
  if (description.length < 20 || description.length > 4000) {
    throw new AppError("VALIDATION", "Tell us a bit more (at least 20 characters).", 400)
  }
  if (!isFeatureRequestCategory(params.category)) {
    throw new AppError("VALIDATION", "Choose a category.", 400)
  }
  const why = params.whyItMatters?.trim()
  if (why && why.length > 2000) {
    throw new AppError("VALIDATION", "The “why” note is too long.", 400)
  }

  if (!params.force) {
    const similar = await findSimilarRequests(title)
    if (similar.length) return { similar, created: null as PublicFeatureRequest | null }
  }

  const now = Date.now()
  const doc: FeatureRequestDoc = {
    id: `fr_${cryptoId().replace(/-/g, "").slice(0, 16)}`,
    title,
    description,
    whyItMatters: why || undefined,
    category: params.category,
    status: "submitted",
    authorId: params.authorId,
    voteCount: 1,
    createdAt: now,
    updatedAt: now,
  }
  const col = await featureRequestsCol()
  const votes = await featureRequestVotesCol()
  await col.insertOne({ ...doc, _id: new ObjectId() })
  try {
    await votes.insertOne({
      _id: new ObjectId(),
      id: cryptoId(),
      featureRequestId: doc.id,
      userId: params.authorId,
      createdAt: now,
    })
  } catch {
    /* unique vote — author already voted */
  }
  const names = await authorMap([params.authorId])
  return {
    similar: [],
    created: toPublic(doc, { hasVoted: true, viewerId: params.authorId, authorName: names.get(params.authorId) ?? "You" }),
  }
}

export async function getFeatureRequest(id: string, viewerId?: string, admin = false) {
  const col = await featureRequestsCol()
  const doc = await col.findOne({ id })
  if (!doc || (doc.hidden && !admin)) throw new AppError("UNKNOWN", "We couldn't find that request.", 404)
  const votes = await featureRequestVotesCol()
  const hasVoted = viewerId ? Boolean(await votes.findOne({ featureRequestId: id, userId: viewerId })) : false
  const names = await authorMap([doc.authorId])
  const updatesCol = await featureRequestUpdatesCol()
  const updates = await updatesCol.find({ featureRequestId: id }).sort({ createdAt: -1 }).limit(20).toArray()
  const publicDoc = toPublic(doc, {
    hasVoted,
    viewerId,
    authorName: names.get(doc.authorId) ?? "Founder",
  })
  publicDoc.updates = updates.map((u) => ({ id: u.id, body: u.body, createdAt: u.createdAt }))
  return publicDoc
}

export async function setVote(featureRequestId: string, userId: string, wantVote: boolean) {
  const col = await featureRequestsCol()
  const doc = await col.findOne({ id: featureRequestId, hidden: { $ne: true } })
  if (!doc) throw new AppError("UNKNOWN", "We couldn't find that request.", 404)
  const votes = await featureRequestVotesCol()
  if (wantVote) {
    try {
      await votes.insertOne({
        _id: new ObjectId(),
        id: cryptoId(),
        featureRequestId,
        userId,
        createdAt: Date.now(),
      })
      await col.updateOne({ id: featureRequestId }, { $inc: { voteCount: 1 }, $set: { updatedAt: Date.now() } })
    } catch (e) {
      const code = (e as { code?: number }).code
      if (code !== 11000) throw e
    }
  } else {
    const res = await votes.deleteOne({ featureRequestId, userId })
    if (res.deletedCount) {
      await col.updateOne({ id: featureRequestId, voteCount: { $gt: 0 } }, { $inc: { voteCount: -1 }, $set: { updatedAt: Date.now() } })
    }
  }
  const next = await col.findOne({ id: featureRequestId })
  const hasVoted = Boolean(await votes.findOne({ featureRequestId, userId }))
  return { voteCount: next?.voteCount ?? 0, hasVoted }
}

export async function adminList(params: {
  q?: string
  status?: FeatureRequestStatus | "all" | "needs_review"
  category?: FeatureRequestCategory | "all"
  sort?: ListSort | "oldest"
  page?: number
}) {
  const col = await featureRequestsCol()
  const page = Math.max(1, params.page ?? 1)
  const filter: Record<string, unknown> = {}
  if (params.status === "needs_review") filter.status = { $in: ["submitted", "under_review"] }
  else if (params.status && params.status !== "all") filter.status = params.status
  if (params.category && params.category !== "all") filter.category = params.category
  if (params.q?.trim()) {
    const rx = new RegExp(escapeRegex(params.q.trim()), "i")
    filter.$or = [{ title: rx }, { description: rx }, { whyItMatters: rx }, { id: rx }]
  }
  let mongoSort: Record<string, 1 | -1> = { voteCount: -1, createdAt: -1 }
  if (params.sort === "recent") mongoSort = { createdAt: -1 }
  if (params.sort === "oldest") mongoSort = { createdAt: 1 }
  if (params.sort === "updated") mongoSort = { updatedAt: -1 }
  const [total, docs] = await Promise.all([
    col.countDocuments(filter),
    col.find(filter).sort(mongoSort).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).toArray(),
  ])
  const names = await authorMap(docs.map((d) => d.authorId))
  return {
    page,
    pageSize: PAGE_SIZE,
    total,
    items: docs.map((d) => ({
      ...toPublic(d, { hasVoted: false, authorName: names.get(d.authorId) ?? "Founder" }),
      hidden: Boolean(d.hidden),
    })),
  }
}

export async function adminStats() {
  const col = await featureRequestsCol()
  const votes = await featureRequestVotesCol()
  const weekAgo = Date.now() - WEEK_MS
  const [total, newThisWeek, underReview, planned, inProgress, shipped, totalVotes] = await Promise.all([
    col.countDocuments({ hidden: { $ne: true } }),
    col.countDocuments({ hidden: { $ne: true }, createdAt: { $gte: weekAgo } }),
    col.countDocuments({ hidden: { $ne: true }, status: { $in: ["submitted", "under_review"] } }),
    col.countDocuments({ hidden: { $ne: true }, status: "planned" }),
    col.countDocuments({ hidden: { $ne: true }, status: "in_progress" }),
    col.countDocuments({ hidden: { $ne: true }, status: "shipped" }),
    votes.countDocuments({}),
  ])
  return { total, newThisWeek, underReview, planned, inProgress, shipped, totalVotes }
}

export async function adminGet(id: string) {
  const publicDoc = await getFeatureRequest(id, undefined, true)
  const history = await (await featureRequestStatusHistoryCol()).find({ featureRequestId: id }).sort({ createdAt: 1 }).toArray()
  const notes = await (await featureRequestInternalNotesCol()).find({ featureRequestId: id }).sort({ createdAt: -1 }).toArray()
  const votes = await featureRequestVotesCol()
  const uniqueVoters = await votes.countDocuments({ featureRequestId: id })
  const recentVotes = await votes.countDocuments({ featureRequestId: id, createdAt: { $gte: Date.now() - WEEK_MS } })
  const col = await featureRequestsCol()
  const raw = await col.findOne({ id })
  return {
    request: publicDoc,
    uniqueVoters,
    recentVotes,
    hidden: Boolean(raw?.hidden),
    history: history.map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      changedBy: h.changedBy,
      reason: h.reason,
      createdAt: h.createdAt,
    })),
    internalNotes: notes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt })),
  }
}

export async function adminPatch(
  id: string,
  adminId: string,
  patch: {
    status?: string
    category?: string
    reason?: string
    canonicalRequestId?: string
    hidden?: boolean
    releaseNote?: string
    releaseLink?: string
    internalNote?: string
    publicUpdate?: string
  },
) {
  const col = await featureRequestsCol()
  const doc = await col.findOne({ id })
  if (!doc) throw new AppError("UNKNOWN", "We couldn't find that request.", 404)
  const now = Date.now()
  const $set: Record<string, unknown> = { updatedAt: now }

  if (patch.status) {
    if (!isFeatureRequestStatus(patch.status)) throw new AppError("VALIDATION", "Invalid status.", 400)
    if ((patch.status === "declined" || patch.status === "duplicate") && !patch.reason?.trim()) {
      throw new AppError("VALIDATION", "Add a short reason for this decision.", 400)
    }
    if (patch.status === "duplicate") {
      if (!patch.canonicalRequestId) throw new AppError("VALIDATION", "Choose the original request.", 400)
      $set.canonicalRequestId = patch.canonicalRequestId
    }
    if (patch.status !== doc.status) {
      await (await featureRequestStatusHistoryCol()).insertOne({
        _id: new ObjectId(),
        id: cryptoId(),
        featureRequestId: id,
        fromStatus: doc.status,
        toStatus: patch.status,
        changedBy: adminId,
        reason: patch.reason?.trim(),
        createdAt: now,
      })
      $set.status = patch.status
    }
  }
  if (patch.category) {
    if (!isFeatureRequestCategory(patch.category)) throw new AppError("VALIDATION", "Invalid category.", 400)
    $set.category = patch.category
  }
  if (typeof patch.hidden === "boolean") $set.hidden = patch.hidden
  if (typeof patch.releaseNote === "string") $set.releaseNote = patch.releaseNote.trim() || undefined
  if (typeof patch.releaseLink === "string") $set.releaseLink = patch.releaseLink.trim() || undefined

  await col.updateOne({ id }, { $set })

  if (patch.internalNote?.trim()) {
    await (await featureRequestInternalNotesCol()).insertOne({
      _id: new ObjectId(),
      id: cryptoId(),
      featureRequestId: id,
      authorId: adminId,
      body: patch.internalNote.trim().slice(0, 4000),
      createdAt: now,
      updatedAt: now,
    })
  }
  if (patch.publicUpdate?.trim()) {
    await (await featureRequestUpdatesCol()).insertOne({
      _id: new ObjectId(),
      id: cryptoId(),
      featureRequestId: id,
      authorId: adminId,
      body: patch.publicUpdate.trim().slice(0, 4000),
      createdAt: now,
    })
  }
  return adminGet(id)
}

export { categoryLabel, PAGE_SIZE }
