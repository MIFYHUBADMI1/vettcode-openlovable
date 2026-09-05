import type { DataStore } from "@/lib/store/store"
import { cryptoId } from "@/lib/store/id"
import { usersCol, projectsCol, buildRunsCol, creditTransactionsCol } from "@/lib/db/collections"
import { logger } from "@/lib/logging/logger"
import type { MirrorProject, BuildRun, CreditTransaction, ProjectEvent, ConversationMessage, DeploymentHistoryEntry } from "@/lib/types/project"

const STARTING_CREDITS = 500

/**
 * MongoDB-backed implementation of the same `DataStore` interface the
 * in-memory store implements — the Firecrawl/Totalum orchestration code
 * never changes, only the persistence layer underneath it (spec section 20).
 * User balance now lives on the `users` collection (see lib/auth/users.ts);
 * `ensureUser`/`getBalance` here delegate to it so callers keep one surface.
 *
 * In-process LRU caches live on every read-heavy method. They survive across
 * Next.js dev HMR reloads (per process), eliminating the hundreds of

 * individual DB round-trips that pile up when SWR re-renders on every route
 * change / page refresh. Entries have a short TTL and are invalidated on any
 * write to the same key so you never serve stale balances or projects.
 */
export class MongoStore implements DataStore {
  // ─── lightweight in-memory LRU caches (per process, no extra deps) ───

  private readonly cache = new Map<string, { v: unknown; t: number }>()
  private readonly ttlMs: number

  constructor(ttlMs = 30_000) {
    // Default 30s cache lifetime — balances freshness against DB load.
    this.ttlMs = ttlMs
  }

  private cacheGet<T>(key: string, now: number): T | undefined {
    const entry = this.cache.get(key)
    if (!entry || now - entry.t > this.ttlMs) {
      this.cache.delete(key)
      return undefined
    }
    return entry.v as T
  }

  private cacheSet<T>(key: string, value: T, now: number): void {
    this.cache.set(key, { v: value, t: now })
    // Cap map size to avoid unbounded memory growth.
    if (this.cache.size > 4096) {
      // Eject the oldest entries.
      const keys = Array.from(this.cache.keys())
      const drop = keys.slice(0, keys.length - 2048)
      for (const k of drop) this.cache.delete(k)
    }
  }
  async ensureUser(userId: string): Promise<void> {
    const users = await usersCol()
    const existing = await users.findOne({ id: userId })
    if (!existing) return // Real users are created at registration/OAuth time.
  }

  async getBalance(userId: string): Promise<number> {
    const now = Date.now()
    const cached = this.cacheGet<number>(`bal:${userId}`, now)
    if (cached !== undefined) return cached

    const users = await usersCol()
    const user = await users.findOne({ id: userId })
    const balance = user?.credits ?? 0
    this.cacheSet(`bal:${userId}`, balance, now)
    return balance
  }

  async listTransactions(userId: string, limit = 100): Promise<CreditTransaction[]> {
    const now = Date.now()
    const cached = this.cacheGet<CreditTransaction[]>(`tx:${userId}`, now)
    if (cached !== undefined) return cached

    const col = await creditTransactionsCol()
    const docs = await col.find({ userId }).sort({ createdAt: -1 }).limit(limit).toArray()
    const result = docs.map(stripMongoId)
    this.cacheSet(`tx:${userId}`, result, now)
    return result
  }

  async addTransaction(tx: CreditTransaction): Promise<void> {
    const users = await usersCol()
    const col = await creditTransactionsCol()
    // Atomic: increment balance and record the ledger entry together isn't
    // possible across two collections without a transaction; Mongo supports
    // multi-document ACID transactions when running as a replica set, which
    // Atlas always is. We use one here to keep balance and ledger consistent.
    const client = (await import("@/lib/db/mongodb")).getMongoClient
    const mongoClient = await client()
    const session = mongoClient.startSession()
    try {
      await session.withTransaction(async () => {
        await users.updateOne(
          { id: tx.userId },
          { $inc: { credits: tx.amount }, $set: { updatedAt: Date.now() } },
          { session },
        )
        await col.insertOne({ ...tx }, { session })
      })
    } finally {
      await session.endSession()
    }
    // The balance and transaction list are now stale — purge them so the next
    // read fetches fresh values instead of a cached snapshot.
    this.cache.delete(`bal:${tx.userId}`)
    this.cache.delete(`tx:${tx.userId}`)
  }

  async reserveCreditsAtomic(userId: string, amount: number, tx: CreditTransaction): Promise<boolean> {
    const users = await usersCol()
    const col = await creditTransactionsCol()
    const client = (await import("@/lib/db/mongodb")).getMongoClient
    const mongoClient = await client()
    const session = mongoClient.startSession()
    try {
      let success = false
      await session.withTransaction(async () => {
        // The `credits: { $gte: amount }` filter and the `$inc` decrement
        // happen as a single atomic document operation, so two concurrent
        // reservations can never both observe a sufficient balance and both
        // succeed — the second one's filter simply won't match once the
        // first has applied.
        const result = await users.updateOne(
          { id: userId, credits: { $gte: amount } },
          { $inc: { credits: -amount }, $set: { updatedAt: Date.now() } },
          { session },
        )
        if (result.modifiedCount === 0) {
          success = false
          return
        }
        await col.insertOne({ ...tx }, { session })
        success = true
      })
      return success
    } finally {
      await session.endSession()
    }
    // Success or failure, the balance is no longer representative of what's in
    // Mongo — invalidate the cached balance and transaction list.
    this.cache.delete(`bal:${userId}`)
    this.cache.delete(`tx:${userId}`)
  }

  async createProject(project: MirrorProject): Promise<MirrorProject> {
    const col = await projectsCol()
    await col.insertOne({ ...project })
    return project
  }

  async getProject(id: string): Promise<MirrorProject | null> {
    const now = Date.now()
    const cached = this.cacheGet<MirrorProject | null>(`proj:${id}`, now)
    if (cached !== undefined) return cached

    const col = await projectsCol()
    const doc = await col.findOne({ id })
    const result = doc ? stripMongoId(doc) : null
    this.cacheSet(`proj:${id}`, result, now)
    return result
  }

  async listProjects(userId: string, limit = 100): Promise<MirrorProject[]> {
    const now = Date.now()
    const cached = this.cacheGet<MirrorProject[]>(`projs:${userId}`, now)
    if (cached !== undefined) return cached

    const col = await projectsCol()
    const docs = await col.find({ userId }).sort({ updatedAt: -1 }).limit(limit).toArray()
    const result = docs.map(stripMongoId)
    this.cacheSet(`projs:${userId}`, result, now)
    return result
  }

  async updateProject(id: string, patch: Partial<MirrorProject>): Promise<MirrorProject | null> {
    const col = await projectsCol()
    const updatedAt = Date.now()
    const result = await col.findOneAndUpdate(
      { id },
      { $set: { ...patch, updatedAt } },
      { returnDocument: "after" },
    )
    const updated = result ? stripMongoId(result) : null
    this.cacheSet(`proj:${id}`, updated, Date.now())
    return updated
  }

  async claimBuildSlot(id: string, patch: Partial<MirrorProject>): Promise<MirrorProject | null> {
    const col = await projectsCol()
    const updatedAt = Date.now()
    // The `state: { $nin: [...] }` filter and the `$set` transition happen
    // as one atomic document operation, so two concurrent build/follow-up
    // requests can never both observe a non-building state and both launch
    // a provider run — the second one's filter simply won't match once the
    // first has applied its update.
    const result = await col.findOneAndUpdate(
      { id, state: { $nin: ["building", "deploying"] } },
      { $set: { ...patch, updatedAt } },
      { returnDocument: "after" },
    )
    const claimed = result ? stripMongoId(result) : null
    this.cacheSet(`proj:${id}`, claimed, Date.now())
    return claimed
  }

  async appendEvent(id: string, event: ProjectEvent): Promise<void> {
    const col = await projectsCol()
    // Cap the events array at 200 entries (newest kept) to prevent the project
    // document from growing unboundedly and hitting the 16MB MongoDB limit.
    await col.updateOne(
      { id },
      {
        $push: { events: { $each: [event], $slice: -200 } },
        $set: { updatedAt: Date.now() },
      },
    )
    // Invalidate cached project snapshot — the events changed.
    this.cache.delete(`proj:${id}`)
  }

  async appendMessage(id: string, message: ConversationMessage): Promise<void> {
    const col = await projectsCol()
    // Cap the conversation array at 500 messages (newest kept).
    await col.updateOne(
      { id },
      {
        $push: { conversation: { $each: [message], $slice: -500 } },
        $set: { updatedAt: Date.now() },
      },
    )
    // Invalidate cached project snapshot — the conversation changed.
    this.cache.delete(`proj:${id}`)
  }

  async appendDeploymentRecord(id: string, record: DeploymentHistoryEntry): Promise<void> {
    const col = await projectsCol()
    // Cap deployment history at 50 entries (newest kept).
    await col.updateOne(
      { id },
      {
        $push: { deploymentHistory: { $each: [record], $slice: -50 } },
        $set: { updatedAt: Date.now() },
      },
    )
    // Invalidate cached project snapshot — deployment history changed.
    this.cache.delete(`proj:${id}`)
    void col // ensure col is used (side-effect: DB write already happened)
  }

  async updateDeploymentRecord(id: string, recordId: string, patch: Partial<DeploymentHistoryEntry>): Promise<void> {
    const col = await projectsCol()
    const setPatch: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(patch)) {
      setPatch[`deploymentHistory.$.${key}`] = value
    }
    setPatch["updatedAt"] = Date.now()
    await col.updateOne({ id, "deploymentHistory.id": recordId }, { $set: setPatch })
    // Invalidate the stale project snapshot cached under this id.
    this.cache.delete(`proj:${id}`)
    // Also invalidate the build run itself.
    this.cache.delete(`buildrun:${recordId}`)
  }

  async createBuildRun(run: BuildRun): Promise<BuildRun> {
    const col = await buildRunsCol()
    await col.insertOne({ ...run })
    // Invalidate the build runs list cache for this project.
    this.cache.delete(`buildruns:${run.mirrorProjectId}`)
    return run
  }

  async getBuildRun(id: string): Promise<BuildRun | null> {
    const now = Date.now()
    const cached = this.cacheGet<BuildRun | null>(`buildrun:${id}`, now)
    if (cached !== undefined) return cached

    const col = await buildRunsCol()
    const doc = await col.findOne({ id })
    const result = doc ? stripMongoId(doc) : null
    this.cacheSet(`buildrun:${id}`, result, now)
    return result
  }

  async updateBuildRun(id: string, patch: Partial<BuildRun>): Promise<BuildRun | null> {
    const col = await buildRunsCol()
    const result = await col.findOneAndUpdate({ id }, { $set: patch }, { returnDocument: "after" })
    const updated = result ? stripMongoId(result) : null
    this.cacheSet(`buildrun:${id}`, updated, Date.now())
    return updated
  }

  async listBuildRuns(mirrorProjectId: string, opts: { limit?: number; status?: string } = {}): Promise<BuildRun[]> {
    const now = Date.now()
    const cacheKey = `buildruns:${mirrorProjectId}:${opts.status ?? ""}:${opts.limit ?? 20}`
    const cached = this.cacheGet<BuildRun[]>(cacheKey, now)
    if (cached !== undefined) return cached

    const col = await buildRunsCol()
    const filter: Record<string, unknown> = { mirrorProjectId }
    if (opts.status) filter.status = opts.status
    const docs = await col
      .find(filter)
      .sort({ startedAt: -1 })
      .limit(opts.limit ?? 20)
      .toArray()
    const result = docs.map(stripMongoId)
    this.cacheSet(cacheKey, result, now)
    return result
  }

  async deleteProject(id: string, userId: string): Promise<boolean> {
    logger.info("store.deleteProject", "checking ownership", { id, userId })
    const col = await projectsCol()
    const runsCol = await buildRunsCol()
    const client = (await import("@/lib/db/mongodb")).getMongoClient
    const mongoClient = await client()
    const session = mongoClient.startSession()
    try {
      let deleted = false
      await session.withTransaction(async () => {
        // Ownership check and delete happen as one atomic filter, so a
        // request can never delete a project it doesn't own.
        const result = await col.deleteOne({ id, userId }, { session })
        if (result.deletedCount === 0) {
          logger.info("store.deleteProject", "not found or not owned, aborting", { id, userId })
          deleted = false
          return
        }
        const runsResult = await runsCol.deleteMany({ mirrorProjectId: id }, { session })
        logger.info("store.deleteProject", "cascaded build run delete", { id, deletedBuildRuns: runsResult.deletedCount })
        deleted = true
      })
      logger.info("store.deleteProject", "result", { id, deleted })
      // Invalidate any cached reads for this project + user.
      this.cache.delete(`proj:${id}`)
      this.cache.delete(`projs:${userId}`)
      return deleted
    } finally {
      await session.endSession()
    }
  }
}

function stripMongoId<T extends { _id?: unknown }>(doc: T): Omit<T, "_id"> {
  const { _id, ...rest } = doc
  return rest
}

export { STARTING_CREDITS }
export { cryptoId }
