import "server-only"

/**
 * Growth task service (Phase 5 — W4).
 *
 * A small, durable, tenant-scoped task LIST on top of `growth_tasks` +
 * `growth_task_history`. This is NOT a scheduler: it records status/priority/due
 * and appends an immutable audit row per change, but NOTHING here executes on a
 * timer — the job substrate (Phase 0) does not exist and is deliberately not
 * faked. Tasks are FREE (no credits): W4 manages work, it does not bill for it.
 *
 * Ownership is re-asserted against the project owner via `store.getProject`
 * BEFORE every write and fail-closed on mismatch — the same posture as the
 * Studio service and the co-founder tools.
 */

import { ObjectId } from "mongodb"
import { store } from "@/lib/store/store"
import { cryptoId } from "@/lib/store/store"
import { growthTasksCol, growthTaskHistoryCol } from "@/lib/db/collections"
import { AppError } from "@/lib/errors"
import { logger } from "@/lib/logging/logger"
import type {
  GrowthTaskDoc,
  GrowthTaskHistoryDoc,
  GrowthTaskStatus,
  GrowthTaskPriority,
  GrowthTaskOrigin,
} from "@/lib/types/db"

const TASK_STATUSES: readonly GrowthTaskStatus[] = ["open", "done", "dismissed"]
const TASK_PRIORITIES: readonly GrowthTaskPriority[] = ["low", "medium", "high"]

export function isGrowthTaskStatus(value: unknown): value is GrowthTaskStatus {
  return TASK_STATUSES.includes(value as GrowthTaskStatus)
}
export function isGrowthTaskPriority(value: unknown): value is GrowthTaskPriority {
  return TASK_PRIORITIES.includes(value as GrowthTaskPriority)
}

/** Create one task. Fails closed on missing title or a non-owned project. */
export async function createGrowthTask(input: {
  userId: string
  projectId: string
  title: string
  detail?: string
  priority?: GrowthTaskPriority
  dueAt?: number | null
  origin: GrowthTaskOrigin
  sourceNextStepId?: string
}): Promise<GrowthTaskDoc> {
  const title = (input.title ?? "").trim()
  if (!title) throw new AppError("VALIDATION")

  const project = await store.getProject(input.projectId)
  if (!project || project.userId !== input.userId) {
    // Fail closed — the caller's ownership gate should have prevented this.
    throw new AppError("UNAUTHORIZED_PROJECT_ACCESS")
  }

  const priority = isGrowthTaskPriority(input.priority) ? input.priority : "medium"
  const dueAt = typeof input.dueAt === "number" && Number.isFinite(input.dueAt) ? input.dueAt : null

  const now = Date.now()
  const id = `task_${cryptoId()}`
  const doc: GrowthTaskDoc = {
    _id: new ObjectId(),
    id,
    userId: input.userId,
    projectId: input.projectId,
    title,
    ...(input.detail ? { detail: input.detail.trim() || undefined } : {}),
    status: "open",
    priority,
    dueAt,
    ...(input.sourceNextStepId ? { sourceNextStepId: input.sourceNextStepId } : {}),
    origin: input.origin,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  }

  await insertTask(doc, input.projectId)
  await appendHistory({
    taskId: id,
    projectId: input.projectId,
    userId: input.userId,
    action: "created",
    to: "open",
  })
  logger.info("marketing.tasks", "task created", { projectId: input.projectId, taskId: id, origin: input.origin })
  return doc
}

/** Latest tasks for a project (ownership-scoped by caller). Read-only, free. */
export async function listTasks(
  projectId: string,
  opts: { status?: GrowthTaskStatus; limit?: number } = {},
): Promise<GrowthTaskDoc[]> {
  const filter: Record<string, unknown> = { projectId }
  if (isGrowthTaskStatus(opts.status)) filter.status = opts.status
  const col = await growthTasksCol()
  return (await col
    .find(filter)
    .sort({ updatedAt: -1 })
    .limit(opts.limit ?? 100)
    .toArray()) as unknown as GrowthTaskDoc[]
}

/** Fetch a single task by business id within its project. Returns null when absent. */
export async function getTask(projectId: string, taskId: string): Promise<GrowthTaskDoc | null> {
  const col = await growthTasksCol()
  const doc = await col.findOne({ id: taskId, projectId })
  return (doc as unknown as GrowthTaskDoc | null) ?? null
}

/** Change a task's lifecycle status. Sets/clears `completedAt` on the done edge. */
export async function updateTaskStatus(input: {
  userId: string
  projectId: string
  taskId: string
  status: GrowthTaskStatus
}): Promise<GrowthTaskDoc> {
  if (!isGrowthTaskStatus(input.status)) throw new AppError("VALIDATION")

  const project = await store.getProject(input.projectId)
  if (!project || project.userId !== input.userId) {
    throw new AppError("UNAUTHORIZED_PROJECT_ACCESS")
  }

  const existing = await getTask(input.projectId, input.taskId)
  if (!existing || existing.userId !== input.userId) {
    throw new AppError("UNAUTHORIZED_PROJECT_ACCESS")
  }
  if (existing.status === input.status) return existing

  const now = Date.now()
  const completedAt =
    input.status === "done" ? existing.completedAt ?? now : null

  const col = await growthTasksCol()
  const updated = await col.findOneAndUpdate(
    { id: input.taskId, projectId: input.projectId },
    { $set: { status: input.status, completedAt, updatedAt: now } },
    { returnDocument: "after" },
  ) as unknown as GrowthTaskDoc | null
  if (!updated) throw new AppError("DATABASE_UNAVAILABLE")

  await appendHistory({
    taskId: input.taskId,
    projectId: input.projectId,
    userId: input.userId,
    action: "status",
    field: "status",
    from: existing.status,
    to: input.status,
  })
  logger.info("marketing.tasks", "task status changed", {
    projectId: input.projectId,
    taskId: input.taskId,
    from: existing.status,
    to: input.status,
  })
  return updated
}

/** Edit a task's title / priority / due date. Appends one history row per field changed. */
export async function updateTaskFields(input: {
  userId: string
  projectId: string
  taskId: string
  title?: string
  priority?: GrowthTaskPriority
  dueAt?: number | null
}): Promise<GrowthTaskDoc> {
  const project = await store.getProject(input.projectId)
  if (!project || project.userId !== input.userId) {
    throw new AppError("UNAUTHORIZED_PROJECT_ACCESS")
  }
  const existing = await getTask(input.projectId, input.taskId)
  if (!existing || existing.userId !== input.userId) {
    throw new AppError("UNAUTHORIZED_PROJECT_ACCESS")
  }

  const now = Date.now()
  const set: Record<string, unknown> = { updatedAt: now }
  const changes: Array<{ field: GrowthTaskHistoryDoc["field"]; from: string | null; to: string | null }> = []

  if (input.title !== undefined) {
    const title = input.title.trim()
    if (!title) throw new AppError("VALIDATION")
    if (title !== existing.title) {
      set.title = title
      changes.push({ field: "title", from: existing.title, to: title })
    }
  }
  if (input.priority !== undefined && isGrowthTaskPriority(input.priority)) {
    if (input.priority !== existing.priority) {
      set.priority = input.priority
      changes.push({ field: "priority", from: existing.priority, to: input.priority })
    }
  }
  if (input.dueAt !== undefined) {
    const dueAt = typeof input.dueAt === "number" && Number.isFinite(input.dueAt) ? input.dueAt : null
    if (dueAt !== existing.dueAt) {
      set.dueAt = dueAt
      changes.push({ field: "dueAt", from: existing.dueAt === null ? null : String(existing.dueAt), to: dueAt === null ? null : String(dueAt) })
    }
  }

  if (changes.length === 0) return existing

  const col = await growthTasksCol()
  const updated = await col.findOneAndUpdate(
    { id: input.taskId, projectId: input.projectId },
    { $set: set },
    { returnDocument: "after" },
  ) as unknown as GrowthTaskDoc | null
  if (!updated) throw new AppError("DATABASE_UNAVAILABLE")

  for (const c of changes) {
    await appendHistory({
      taskId: input.taskId,
      projectId: input.projectId,
      userId: input.userId,
      action: "updated",
      field: c.field,
      from: c.from,
      to: c.to,
    })
  }
  logger.info("marketing.tasks", "task fields updated", {
    projectId: input.projectId,
    taskId: input.taskId,
    fields: changes.map((c) => c.field).join(","),
  })
  return updated
}

/** Append-only lifecycle history for one task, oldest→newest. */
export async function getTaskHistory(projectId: string, taskId: string, limit = 50): Promise<GrowthTaskHistoryDoc[]> {
  const col = await growthTaskHistoryCol()
  return (await col
    .find({ taskId, projectId })
    .sort({ createdAt: 1 })
    .limit(limit)
    .toArray()) as unknown as GrowthTaskHistoryDoc[]
}

async function insertTask(doc: GrowthTaskDoc, projectId: string): Promise<void> {
  try {
    const col = await growthTasksCol()
    await col.insertOne(doc as never)
  } catch (e) {
    logger.error("marketing.tasks", "failed to persist task", {
      projectId,
      message: e instanceof Error ? e.message : String(e),
    })
    throw new AppError("DATABASE_UNAVAILABLE")
  }
}

async function appendHistory(input: {
  taskId: string
  projectId: string
  userId: string
  action: GrowthTaskHistoryDoc["action"]
  field?: GrowthTaskHistoryDoc["field"]
  from?: string | null
  to?: string | null
  reason?: string
}): Promise<void> {
  try {
    const col = await growthTaskHistoryCol()
    const doc: GrowthTaskHistoryDoc = {
      _id: new ObjectId(),
      id: `taskh_${cryptoId()}`,
      taskId: input.taskId,
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
    logger.error("marketing.tasks", "failed to append task history", {
      projectId: input.projectId,
      taskId: input.taskId,
      message: e instanceof Error ? e.message : String(e),
    })
  }
}
