import "server-only"

/**
 * Campaign service (Phase 6 — W5).
 *
 * A small, durable, tenant-scoped campaign PLAN store on top of `campaigns` +
 * `campaign_history`. This is NOT an execution engine: it records what the
 * founder plans (objective/channels/budget/dates) and the lifecycle status they
 * set manually, and appends an immutable audit row per change. NOTHING here
 * sends email, posts to social, spends ad budget, or runs on a timer — the job
 * substrate (Phase 0) does not exist and is deliberately not faked, email needs
 * a consent layer, and social/ad posting needs per-platform approvals.
 *
 * Campaigns are FREE (no credits): W5 plans and tracks work, it does not bill
 * for it. `plannedBudgetCents` is a founder-tracked number, NEVER spend.
 *
 * Ownership is re-asserted against the project owner via `store.getProject`
 * BEFORE every write and fail-closed on mismatch — the same posture as the
 * tasks and Studio services.
 */

import { ObjectId } from "mongodb"
import { store } from "@/lib/store/store"
import { cryptoId } from "@/lib/store/store"
import { campaignsCol, campaignHistoryCol } from "@/lib/db/collections"
import { AppError } from "@/lib/errors"
import { logger } from "@/lib/logging/logger"
import type {
  CampaignDoc,
  CampaignHistoryDoc,
  CampaignStatus,
  CampaignChannel,
  CampaignOrigin,
} from "@/lib/types/db"

const CAMPAIGN_STATUSES: readonly CampaignStatus[] = [
  "draft",
  "active",
  "paused",
  "completed",
  "cancelled",
]
const CAMPAIGN_CHANNELS: readonly CampaignChannel[] = [
  "email",
  "social",
  "content",
  "seo",
  "referral",
  "other",
]
const CAMPAIGN_ORIGINS: readonly CampaignOrigin[] = ["ai_generated", "user_created"]

/**
 * Allowed lifecycle transitions. `completed` and `cancelled` are terminal — the
 * founder starts/finishes/abandons a plan, they never resurrect a finished one.
 * Every state may be cancelled (abandonment), and a paused plan may resume.
 */
export const CAMPAIGN_TRANSITIONS: Record<CampaignStatus, readonly CampaignStatus[]> = {
  draft: ["active", "cancelled"],
  active: ["paused", "completed", "cancelled"],
  paused: ["active", "completed", "cancelled"],
  completed: [],
  cancelled: [],
}

export function isCampaignStatus(value: unknown): value is CampaignStatus {
  return CAMPAIGN_STATUSES.includes(value as CampaignStatus)
}
export function isCampaignChannel(value: unknown): value is CampaignChannel {
  return CAMPAIGN_CHANNELS.includes(value as CampaignChannel)
}
export function isCampaignOrigin(value: unknown): value is CampaignOrigin {
  return CAMPAIGN_ORIGINS.includes(value as CampaignOrigin)
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function budgetOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  const cents = Math.round(value)
  return cents >= 0 ? cents : null
}

/** Keep only valid channels, de-duplicated, preserving first-seen order. */
function normalizeChannels(values: unknown): CampaignChannel[] {
  if (!Array.isArray(values)) return []
  const out: CampaignChannel[] = []
  for (const v of values) {
    if (isCampaignChannel(v) && !out.includes(v)) out.push(v)
  }
  return out
}

/** Create one campaign plan. Fails closed on missing name or a non-owned project. */
export async function createCampaign(input: {
  userId: string
  projectId: string
  name: string
  objective?: string
  channels?: unknown
  plannedBudgetCents?: number | null
  utmCampaign?: string | null
  startDate?: number | null
  endDate?: number | null
  notes?: string
  origin: CampaignOrigin
}): Promise<CampaignDoc> {
  const name = (input.name ?? "").trim()
  if (!name) throw new AppError("VALIDATION")

  const project = await store.getProject(input.projectId)
  if (!project || project.userId !== input.userId) {
    // Fail closed — the caller's ownership gate should have prevented this.
    throw new AppError("UNAUTHORIZED_PROJECT_ACCESS")
  }

  const origin = isCampaignOrigin(input.origin) ? input.origin : "user_created"
  const now = Date.now()
  const id = `campaign_${cryptoId()}`
  const doc: CampaignDoc = {
    _id: new ObjectId(),
    id,
    userId: input.userId,
    projectId: input.projectId,
    name,
    objective: (input.objective ?? "").trim(),
    channels: normalizeChannels(input.channels),
    status: "draft",
    plannedBudgetCents: budgetOrNull(input.plannedBudgetCents),
    utmCampaign:
      typeof input.utmCampaign === "string" && input.utmCampaign.trim()
        ? input.utmCampaign.trim()
        : null,
    startDate: finiteOrNull(input.startDate),
    endDate: finiteOrNull(input.endDate),
    ...(input.notes && input.notes.trim() ? { notes: input.notes.trim() } : {}),
    origin,
    createdAt: now,
    updatedAt: now,
    pausedAt: null,
    cancelledAt: null,
  }

  await insertCampaign(doc, input.projectId)
  await appendHistory({
    campaignId: id,
    projectId: input.projectId,
    userId: input.userId,
    action: "created",
    to: "draft",
  })
  logger.info("marketing.campaigns", "campaign created", {
    projectId: input.projectId,
    campaignId: id,
    origin,
  })
  return doc
}

/** Latest campaigns for a project (ownership-scoped by caller). Read-only, free. */
export async function listCampaigns(
  projectId: string,
  opts: { status?: CampaignStatus; limit?: number } = {},
): Promise<CampaignDoc[]> {
  const filter: Record<string, unknown> = { projectId }
  if (isCampaignStatus(opts.status)) filter.status = opts.status
  const col = await campaignsCol()
  return (await col
    .find(filter)
    .sort({ updatedAt: -1 })
    .limit(opts.limit ?? 100)
    .toArray()) as unknown as CampaignDoc[]
}

/** Fetch a single campaign by business id within its project. Returns null when absent. */
export async function getCampaign(projectId: string, campaignId: string): Promise<CampaignDoc | null> {
  const col = await campaignsCol()
  const doc = await col.findOne({ id: campaignId, projectId })
  return (doc as unknown as CampaignDoc | null) ?? null
}

/**
 * Move a campaign through its lifecycle. Enforces CAMPAIGN_TRANSITIONS (an
 * illegal move fails validation) and sets/clears `pausedAt`/`cancelledAt` on the
 * relevant edges: paused ⟺ active, cancelled is terminal.
 */
export async function updateCampaignStatus(input: {
  userId: string
  projectId: string
  campaignId: string
  status: CampaignStatus
}): Promise<CampaignDoc> {
  if (!isCampaignStatus(input.status)) throw new AppError("VALIDATION")

  const project = await store.getProject(input.projectId)
  if (!project || project.userId !== input.userId) {
    throw new AppError("UNAUTHORIZED_PROJECT_ACCESS")
  }

  const existing = await getCampaign(input.projectId, input.campaignId)
  if (!existing || existing.userId !== input.userId) {
    throw new AppError("UNAUTHORIZED_PROJECT_ACCESS")
  }
  if (existing.status === input.status) return existing

  const allowed = CAMPAIGN_TRANSITIONS[existing.status] ?? []
  if (!allowed.includes(input.status)) throw new AppError("VALIDATION")

  const now = Date.now()
  // pausedAt is meaningful only while paused; cancelledAt only once cancelled.
  const pausedAt = input.status === "paused" ? now : null
  const cancelledAt = input.status === "cancelled" ? now : existing.cancelledAt

  const col = await campaignsCol()
  const updated = await col.findOneAndUpdate(
    { id: input.campaignId, projectId: input.projectId },
    { $set: { status: input.status, pausedAt, cancelledAt, updatedAt: now } },
    { returnDocument: "after" },
  ) as unknown as CampaignDoc | null
  if (!updated) throw new AppError("DATABASE_UNAVAILABLE")

  await appendHistory({
    campaignId: input.campaignId,
    projectId: input.projectId,
    userId: input.userId,
    action: "status",
    field: "status",
    from: existing.status,
    to: input.status,
  })
  logger.info("marketing.campaigns", "campaign status changed", {
    projectId: input.projectId,
    campaignId: input.campaignId,
    from: existing.status,
    to: input.status,
  })
  return updated
}

/** Edit a campaign's plan fields. Appends one history row per field changed. */
export async function updateCampaignFields(input: {
  userId: string
  projectId: string
  campaignId: string
  name?: string
  objective?: string
  channels?: unknown
  plannedBudgetCents?: number | null
  utmCampaign?: string | null
  startDate?: number | null
  endDate?: number | null
  notes?: string | null
}): Promise<CampaignDoc> {
  const project = await store.getProject(input.projectId)
  if (!project || project.userId !== input.userId) {
    throw new AppError("UNAUTHORIZED_PROJECT_ACCESS")
  }
  const existing = await getCampaign(input.projectId, input.campaignId)
  if (!existing || existing.userId !== input.userId) {
    throw new AppError("UNAUTHORIZED_PROJECT_ACCESS")
  }

  const now = Date.now()
  const set: Record<string, unknown> = { updatedAt: now }
  const changes: Array<{ field: NonNullable<CampaignHistoryDoc["field"]>; from: string | null; to: string | null }> = []

  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) throw new AppError("VALIDATION")
    if (name !== existing.name) {
      set.name = name
      changes.push({ field: "name", from: existing.name, to: name })
    }
  }
  if (input.objective !== undefined) {
    const objective = input.objective.trim()
    if (objective !== existing.objective) {
      set.objective = objective
      changes.push({ field: "objective", from: existing.objective, to: objective })
    }
  }
  if (input.channels !== undefined) {
    const channels = normalizeChannels(input.channels)
    if (channels.join(",") !== existing.channels.join(",")) {
      set.channels = channels
      changes.push({ field: "channels", from: existing.channels.join(","), to: channels.join(",") })
    }
  }
  if (input.plannedBudgetCents !== undefined) {
    const plannedBudgetCents = budgetOrNull(input.plannedBudgetCents)
    if (plannedBudgetCents !== existing.plannedBudgetCents) {
      set.plannedBudgetCents = plannedBudgetCents
      changes.push({
        field: "plannedBudgetCents",
        from: existing.plannedBudgetCents === null ? null : String(existing.plannedBudgetCents),
        to: plannedBudgetCents === null ? null : String(plannedBudgetCents),
      })
    }
  }
  if (input.utmCampaign !== undefined) {
    const utmCampaign =
      typeof input.utmCampaign === "string" && input.utmCampaign.trim() ? input.utmCampaign.trim() : null
    if (utmCampaign !== existing.utmCampaign) {
      set.utmCampaign = utmCampaign
      changes.push({ field: "utmCampaign", from: existing.utmCampaign, to: utmCampaign })
    }
  }
  if (input.startDate !== undefined) {
    const startDate = finiteOrNull(input.startDate)
    if (startDate !== existing.startDate) {
      set.startDate = startDate
      changes.push({ field: "startDate", from: numToStr(existing.startDate), to: numToStr(startDate) })
    }
  }
  if (input.endDate !== undefined) {
    const endDate = finiteOrNull(input.endDate)
    if (endDate !== existing.endDate) {
      set.endDate = endDate
      changes.push({ field: "endDate", from: numToStr(existing.endDate), to: numToStr(endDate) })
    }
  }
  if (input.notes !== undefined) {
    const notes = input.notes === null ? "" : input.notes.trim()
    const current = existing.notes ?? ""
    if (notes !== current) {
      if (notes) set.notes = notes
      else set.notes = ""
      changes.push({ field: "notes", from: current || null, to: notes || null })
    }
  }

  if (changes.length === 0) return existing

  const col = await campaignsCol()
  const updated = await col.findOneAndUpdate(
    { id: input.campaignId, projectId: input.projectId },
    { $set: set },
    { returnDocument: "after" },
  ) as unknown as CampaignDoc | null
  if (!updated) throw new AppError("DATABASE_UNAVAILABLE")

  for (const c of changes) {
    await appendHistory({
      campaignId: input.campaignId,
      projectId: input.projectId,
      userId: input.userId,
      action: "updated",
      field: c.field,
      from: c.from,
      to: c.to,
    })
  }
  logger.info("marketing.campaigns", "campaign fields updated", {
    projectId: input.projectId,
    campaignId: input.campaignId,
    fields: changes.map((c) => c.field).join(","),
  })
  return updated
}

/** Append-only lifecycle history for one campaign, oldest→newest. */
export async function getCampaignHistory(
  projectId: string,
  campaignId: string,
  limit = 50,
): Promise<CampaignHistoryDoc[]> {
  const col = await campaignHistoryCol()
  return (await col
    .find({ campaignId, projectId })
    .sort({ createdAt: 1 })
    .limit(limit)
    .toArray()) as unknown as CampaignHistoryDoc[]
}

function numToStr(value: number | null): string | null {
  return value === null ? null : String(value)
}

async function insertCampaign(doc: CampaignDoc, projectId: string): Promise<void> {
  try {
    const col = await campaignsCol()
    await col.insertOne(doc as never)
  } catch (e) {
    logger.error("marketing.campaigns", "failed to persist campaign", {
      projectId,
      message: e instanceof Error ? e.message : String(e),
    })
    throw new AppError("DATABASE_UNAVAILABLE")
  }
}

async function appendHistory(input: {
  campaignId: string
  projectId: string
  userId: string
  action: CampaignHistoryDoc["action"]
  field?: CampaignHistoryDoc["field"]
  from?: string | null
  to?: string | null
  reason?: string
}): Promise<void> {
  try {
    const col = await campaignHistoryCol()
    const doc: CampaignHistoryDoc = {
      _id: new ObjectId(),
      id: `cph_${cryptoId()}`,
      campaignId: input.campaignId,
      projectId: input.projectId,
      userId: input.userId,
      action: input.action,
      ...(input.field ? { field: input.field } : {}),
      ...(input.from !== undefined ? { from: input.from } : {}),
      ...(input.to !== undefined ? { to: input.to } : {}),
      changedBy: input.userId,
      ...(input.reason ? { reason: input.reason } : {}),
      createdAt: Date.now(),
    }
    await col.insertOne(doc as never)
  } catch (e) {
    // History is best-effort durability; never fail the primary mutation on it,
    // but keep it loud so a broken audit trail is never silent.
    logger.error("marketing.campaigns", "failed to append campaign history", {
      projectId: input.projectId,
      campaignId: input.campaignId,
      message: e instanceof Error ? e.message : String(e),
    })
  }
}
