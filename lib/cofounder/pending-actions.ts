import "server-only"
import { ObjectId } from "mongodb"
import { cofounderPendingActionsCol } from "@/lib/db/collections"
import { cryptoId } from "@/lib/store/id"
import type { PendingActionRecord } from "./types"

/**
 * Pending-action persistence (spec sections 33–35, 57).
 *
 * Pending actions are the ONLY path to a confirmed Co-founder mutation. The
 * record is created when a CONFIRM/HARD_CONFIRM tool is proposed, and the
 * approval endpoint executes it exactly once via an atomic status transition
 * (pending → executing) — double-clicks and retries can never double-execute.
 */

/** Pending confirmations live for 15 minutes. */
export const PENDING_ACTION_TTL_MS = 15 * 60 * 1000

export interface CreatePendingActionInput {
  userId: string
  toolName: string
  parameters: Record<string, unknown>
  risk: PendingActionRecord["risk"]
  description: string
  cost?: PendingActionRecord["cost"]
  items?: PendingActionRecord["items"]
  conversationId?: string
  /** For HARD_CONFIRM tools: word the user must type to approve. */
  confirmWord?: string
  /** Per-action TTL override. */
  ttlMs?: number
}

export async function createPendingAction(input: CreatePendingActionInput): Promise<PendingActionRecord> {
  const now = Date.now()
  const record: PendingActionRecord = {
    id: `pa_${cryptoId()}`,
    userId: input.userId,
    toolName: input.toolName,
    parameters: input.parameters,
    risk: input.risk,
    cost: input.cost,
    description: input.description,
    items: input.items,
    conversationId: input.conversationId,
    ...(input.confirmWord ? { confirmWord: input.confirmWord } : {}),
    status: "pending",
    expiresAt: now + (input.ttlMs ?? PENDING_ACTION_TTL_MS),
    createdAt: now,
  }
  const col = await cofounderPendingActionsCol()
  await col.insertOne({ ...record, _id: new ObjectId() })
  return record
}

export async function getPendingAction(id: string): Promise<PendingActionRecord | null> {
  const col = await cofounderPendingActionsCol()
  return col.findOne({ id })
}

/** Expire any stale pending actions for a user (called on read paths). */
export async function expireStalePendingActions(userId: string): Promise<void> {
  const col = await cofounderPendingActionsCol()
  await col.updateMany(
    { userId, status: "pending", expiresAt: { $lte: Date.now() } },
    { $set: { status: "expired" } },
  )
}

/**
 * Atomically claim a pending action for execution (pending → executing).
 * Returns null when the action is missing, owned by someone else, expired,
 * rejected, or already used — the caller must NOT execute in that case.
 * The atomic findOneAndUpdate is what makes double-approval impossible
 * (spec section 34).
 */
export async function claimPendingAction(id: string, userId: string): Promise<PendingActionRecord | null> {
  const col = await cofounderPendingActionsCol()
  const doc = await col.findOneAndUpdate(
    {
      id,
      userId,
      status: "pending",
      expiresAt: { $gt: Date.now() },
    },
    { $set: { status: "executing", approvedAt: Date.now() } },
    { returnDocument: "after" },
  )
  return doc ?? null
}

/**
 * Finalize a claimed action. Pass the result on success, or the error to
 * mark the action failed. Always record an end state so a claimed action can
 * never be left "executing" forever.
 */
export async function finalizePendingAction(
  id: string,
  outcome: { ok: true; result: PendingActionRecord["result"] } | { ok: false; error: { code: string; message: string } },
): Promise<void> {
  const col = await cofounderPendingActionsCol()
  const now = Date.now()
  if (outcome.ok) {
    await col.updateOne({ id }, { $set: { status: "executed", executedAt: now, result: outcome.result } })
  } else {
    await col.updateOne({ id }, { $set: { status: "failed", executedAt: now, error: outcome.error } })
  }
}
