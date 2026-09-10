import { ObjectId } from "mongodb"
import { getDb } from "@/lib/db/mongodb"
import { cryptoId } from "@/lib/store/id"
import { logger } from "@/lib/logging/logger"

/**
 * Infrastructure audit log — records all administrative infrastructure actions.
 * Stored in a dedicated MongoDB collection for compliance and debugging.
 */

export interface AuditLogEntry {
  _id: ObjectId
  id: string
  /** Admin user ID who performed the action. */
  adminUserId: string
  adminUserEmail?: string
  /** Action performed. */
  action: string
  /** Target project ID. */
  projectId?: string
  projectName?: string
  /** Target user ID. */
  userId?: string
  userEmail?: string
  /** Previous value (for changes). */
  previousValue?: string
  /** New value (for changes). */
  newValue?: string
  /** Reason for the action. */
  reason?: string
  /** Result of the action. */
  result: "success" | "failure" | "error"
  /** Additional metadata. */
  metadata?: Record<string, unknown>
  createdAt: number
}

async function getAuditCol() {
  const db = await getDb()
  return db.collection<AuditLogEntry>("infrastructure_audit_log")
}

/** Ensure audit log indexes exist. */
export async function ensureAuditIndexes() {
  const col = await getAuditCol()
  await Promise.all([
    col.createIndex({ id: 1 }, { unique: true, sparse: true }),
    col.createIndex({ adminUserId: 1, createdAt: -1 }),
    col.createIndex({ projectId: 1, createdAt: -1 }),
    col.createIndex({ userId: 1, createdAt: -1 }),
    col.createIndex({ action: 1, createdAt: -1 }),
    col.createIndex({ createdAt: -1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 }), // 1 year TTL
  ])
}

/** Record an audit log entry. */
export async function logAuditAction(entry: Omit<AuditLogEntry, "_id" | "id" | "createdAt">) {
  try {
    const col = await getAuditCol()
    await col.insertOne({
      _id: new ObjectId(),
      id: cryptoId(),
      ...entry,
      createdAt: Date.now(),
    })
  } catch (e) {
    logger.error("audit.log", "failed to write audit log", { action: entry.action, error: (e as Error).message })
  }
}

/** Get audit logs with pagination. */
export async function getAuditLogs(opts: {
  limit?: number
  offset?: number
  projectId?: string
  userId?: string
  action?: string
} = {}) {
  const col = await getAuditCol()
  const filter: Record<string, unknown> = {}
  if (opts.projectId) filter.projectId = opts.projectId
  if (opts.userId) filter.userId = opts.userId
  if (opts.action) filter.action = opts.action

  const limit = Math.min(opts.limit ?? 50, 200)
  const offset = opts.offset ?? 0

  const [logs, total] = await Promise.all([
    col.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit).toArray(),
    col.countDocuments(filter),
  ])

  return { logs, total }
}
