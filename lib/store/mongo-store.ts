import type { DataStore } from "@/lib/store/store"
import { cryptoId } from "@/lib/store/id"
import { usersCol, projectsCol, buildRunsCol } from "@/lib/db/collections"
import { apiKeysCol } from "@/lib/db/runtime-collections"
import { logger } from "@/lib/logging/logger"
import type { MirrorProject, BuildRun, CreditTransaction, ProjectEvent, ConversationMessage, DeploymentHistoryEntry, ProjectState } from "@/lib/types/project"
import type { RuntimeEnvironment } from "@/runtime/contracts/capabilities"
import type { RuntimeProvisioningRecord } from "@/lib/runtime/provisioning/types"
import { AppError } from "@/lib/errors"
import {
  getAvailableCredits,
  getCreditHistory,
  grantCredits,
  consumeCredits,
  reserveCredits
} from "@/lib/billing/credit-service"
import type { CreditLedgerEntry } from "@/lib/billing/billing-types"

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

    // Delegate to credit-service
    const balance = await getAvailableCredits(userId)
    this.cacheSet(`bal:${userId}`, balance, now)
    return balance
  }

  async listTransactions(userId: string, limit = 100): Promise<CreditTransaction[]> {
    const now = Date.now()
    const cached = this.cacheGet<CreditTransaction[]>(`tx:${userId}`, now)
    if (cached !== undefined) return cached

    // Delegate to credit-service, which returns a simplified format
    // We need to fetch the full ledger entries to get metadata for proper mapping
    const col = await (await import("@/lib/db/collections")).creditLedgerCol()
    const entries = await col.find({ userId }).sort({ createdAt: -1 }).limit(limit).toArray()
    const result = entries.map(mapLedgerToLegacyTransaction)
    this.cacheSet(`tx:${userId}`, result, now)
    return result
  }

  async addTransaction(tx: CreditTransaction): Promise<void> {
    // Delegate to credit-service based on transaction type
    // The credit-service handles the double-entry ledger and balance updates

    const isCredit = tx.amount > 0
    const absoluteAmount = Math.abs(tx.amount)

    if (isCredit) {
      // Grant credits through credit-service
      await grantCredits({
        userId: tx.userId,
        amount: absoluteAmount,
        creditType: 'permanent', // Default for legacy addTransaction calls
        transactionType: tx.type === 'grant' ? 'promotional_grant' : 'admin_adjustment',
        idempotencyKey: tx.id, // Use transaction ID as idempotency key
        // First-class project attribution (Phase 1) — only when the caller
        // supplied trusted server-side project context.
        ...(typeof tx.metadata?.projectId === 'string' ? { projectId: tx.metadata.projectId } : {}),
        metadata: {
          reason: tx.reason,
          legacyMigration: true,
          buildRunId: tx.buildRunId,
          ...tx.metadata
        }
      })
    } else {
      // Consume credits through credit-service
      const result = await consumeCredits({
        userId: tx.userId,
        amount: absoluteAmount,
        transactionType: tx.type === 'consume' ? 'build_finalization' : 'admin_adjustment',
        idempotencyKey: tx.id,
        // First-class project attribution (Phase 1) — only when the caller
        // supplied trusted server-side project context.
        ...(typeof tx.metadata?.projectId === 'string' ? { projectId: tx.metadata.projectId } : {}),
        metadata: {
          reason: tx.reason,
          legacyMigration: true,
          buildRunId: tx.buildRunId,
          ...tx.metadata
        }
      })

      // A denied debit must NOT be swallowed: consumeCredits returns
      // { success: false } (no ledger entry, no balance change) when the
      // balance is insufficient. Silently returning here made every
      // post-hoc charge (scrape / plan / deep crawl / reconciliation) a
      // no-op for an underfunded account — the provider work was delivered
      // for free and the ledger showed no charge at all.
      if (!result.success) {
        throw new AppError(
          "INSUFFICIENT_CREDITS",
          `Insufficient credits: ${absoluteAmount.toLocaleString()} required.`,
        )
      }
    }

    // Cache invalidation still handled locally
    this.cache.delete(`bal:${tx.userId}`)
    this.cache.delete(`tx:${tx.userId}`)
  }

  async reserveCreditsAtomic(userId: string, amount: number, tx: CreditTransaction): Promise<boolean> {
    // Delegate to credit-service reservation logic
    try {
      // credit-service.reserveCredits returns FALSE (it does not throw) when
      // the balance is insufficient. That boolean is the whole contract of
      // this method — dropping it made every caller believe the reservation
      // succeeded, so the "insufficient credits" guards in the build and
      // planning pipelines could never fire.
      const reserved = await reserveCredits({
        userId,
        amount,
        buildId: tx.buildRunId || 'unknown',
        reason: tx.reason || 'Build reservation',
        // First-class project attribution (Phase 1).
        ...(typeof tx.metadata?.projectId === 'string' ? { projectId: tx.metadata.projectId } : {}),
        metadata: {
          projectId: tx.metadata?.projectId,
          complexity: tx.metadata?.complexity,
          ...tx.metadata
        }
      })

      // Cache invalidation
      this.cache.delete(`bal:${userId}`)
      this.cache.delete(`tx:${userId}`)

      return reserved
    } catch (error) {
      // If reservation fails due to insufficient balance, return false
      if (error instanceof Error && error.message?.includes('Insufficient credits')) {
        return false
      }
      // For other errors, propagate
      throw error
    }
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
    // `undefined` patch values REMOVE the field, so a recovered project does
    // not keep a stale `error` or recovery marker from an earlier failure.
    const set: Record<string, unknown> = { updatedAt }
    const unset: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) unset[key] = ""
      else set[key] = value
    }
    const update: Record<string, unknown> = { $set: set }
    if (Object.keys(unset).length > 0) update.$unset = unset
    const result = await col.findOneAndUpdate({ id }, update, { returnDocument: "after" })
    const updated = result ? stripMongoId(result) : null
    this.cacheSet(`proj:${id}`, updated, Date.now())
    return updated
  }

  /** Records a build-status poll without marking the project itself changed:
   * `updatedAt` is deliberately untouched so the projects list keeps showing
   * when the founder last acted, not the last time we polled the builder.
   * Best-effort — a failed timestamp write must never fail the poll. */
  async touchBuildPoll(id: string, at: number): Promise<void> {
    try {
      const col = await projectsCol()
      await col.updateOne({ id }, { $set: { lastPolledAt: at } })
      const cached = this.cache.get(`proj:${id}`)
      if (cached?.v) {
        this.cache.set(`proj:${id}`, { v: { ...(cached.v as object), lastPolledAt: at }, t: cached.t })
      }
    } catch (e) {
      logger.warn("store.mongo", "touchBuildPoll failed (non-fatal)", { id, error: (e as Error).message })
    }
  }

  async isRequestedProjectIdAvailable(requestedProjectId: string, excludeProjectId?: string): Promise<boolean> {
    const col = await projectsCol()
    const filter: Record<string, unknown> = { requestedProjectId }
    if (excludeProjectId) filter.id = { $ne: excludeProjectId }
    return (await col.countDocuments(filter, { limit: 1 })) === 0
  }

  async claimRequestedProjectId(id: string, requestedProjectId: string): Promise<MirrorProject | null> {
    const col = await projectsCol()
    try {
      const result = await col.findOneAndUpdate(
        { id, totalumProjectId: { $exists: false } },
        { $set: { requestedProjectId, updatedAt: Date.now() } },
        { returnDocument: "after" },
      )
      const updated = result ? stripMongoId(result) : null
      if (updated) this.cacheSet(`proj:${id}`, updated, Date.now())
      return updated
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === 11000) return null
      throw error
    }
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

  async claimPipelineSlot(
    id: string,
    fromStates: ProjectState[],
    expectUpdatedAt?: number,
  ): Promise<MirrorProject | null> {
    if (!fromStates.length) return null
    const col = await projectsCol()
    const updatedAt = Date.now()
    // One atomic transition: the state filter and the $set happen together, so
    // two pollers (or a poller and a manual retry) can never both start a
    // pipeline for the same project. `expectUpdatedAt` pins the claim to the
    // exact record the caller judged stale, which is the only way to tell two
    // concurrent runs apart while the state is still `analyzing`.
    const filter: Record<string, unknown> = { id, state: { $in: fromStates } }
    if (expectUpdatedAt !== undefined) filter.updatedAt = expectUpdatedAt
    const result = await col.findOneAndUpdate(
      filter,
      { $set: { state: "analyzing", updatedAt }, $unset: { error: "" } },
      { returnDocument: "after" },
    )
    const claimed = result ? stripMongoId(result) : null
    if (claimed) this.cacheSet(`proj:${id}`, claimed, Date.now())
    else this.cache.delete(`proj:${id}`)
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

  // ─── Runtime provisioning (Phase 8) — safe metadata only, no secrets ───

  async getRuntimeProvisioning(
    projectId: string,
    environment: RuntimeEnvironment,
  ): Promise<RuntimeProvisioningRecord | null> {
    const col = await projectsCol()
    const doc = await col.findOne(
      { id: projectId },
      { projection: { runtimeProvisioning: 1 } },
    )
    return doc?.runtimeProvisioning?.[environment] ?? null
  }

  async updateRuntimeProvisioning(
    projectId: string,
    environment: RuntimeEnvironment,
    patch: Partial<RuntimeProvisioningRecord>,
  ): Promise<void> {
    const col = await projectsCol()
    // $set / $unset per field: `undefined` patch values REMOVE the field so a
    // repaired record never keeps stale apiKeyId/keyPrefix/error entries.
    const set: Record<string, unknown> = { updatedAt: Date.now() }
    const unset: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) unset[`runtimeProvisioning.${environment}.${key}`] = ""
      else set[`runtimeProvisioning.${environment}.${key}`] = value
    }
    const update: Record<string, unknown> = { $set: set }
    if (Object.keys(unset).length > 0) update.$unset = unset
    await col.updateOne({ id: projectId }, update)
    // Invalidate the cached project snapshot — provisioning metadata changed.
    this.cache.delete(`proj:${projectId}`)
  }

  async claimRuntimeProvisioning(
    projectId: string,
    environment: RuntimeEnvironment,
    staleClaimMs = 120_000,
  ): Promise<RuntimeProvisioningRecord | null> {
    const col = await projectsCol()
    // ONE atomic document transition: the claim only succeeds from a state
    // where this environment is not already being provisioned (and the
    // project still exists). Two concurrent callers — or a retried request —
    // cannot both hold the slot; the loser's filter matches nothing.
    //
    // Crash recovery: a PROVISIONING claim older than staleClaimMs is stale
    // (its worker died mid-flight) and is safely taken over — the freshest
    // claim wins the takeover race.
    const claimFilter: Record<string, unknown> = {
      id: projectId,
      $or: [
        { [`runtimeProvisioning.${environment}.status`]: { $ne: "PROVISIONING" } },
        { [`runtimeProvisioning.${environment}.claimedAt`]: { $lt: Date.now() - staleClaimMs } },
        { [`runtimeProvisioning.${environment}.claimedAt`]: { $exists: false } },
      ],
    }
    let result = await col.findOneAndUpdate(
      claimFilter,
      {
        $set: {
          [`runtimeProvisioning.${environment}.status`]: "PROVISIONING",
          [`runtimeProvisioning.${environment}.claimedAt`]: Date.now(),
          updatedAt: Date.now(),
        },
      },
      { returnDocument: "after" },
    )
    if (!result) {
      // Legacy record from before claimedAt existed — allow a takeover if the
      // only blocker is a PROVISIONING status without a claim timestamp.
      result = await col.findOneAndUpdate(
        {
          id: projectId,
          [`runtimeProvisioning.${environment}.status`]: "PROVISIONING",
          [`runtimeProvisioning.${environment}.claimedAt`]: { $exists: false },
        },
        {
          $set: {
            [`runtimeProvisioning.${environment}.claimedAt`]: Date.now(),
            updatedAt: Date.now(),
          },
        },
        { returnDocument: "after" },
      )
    }
    if (!result) return null
    this.cache.delete(`proj:${projectId}`)
    return result.runtimeProvisioning?.[environment] ?? { status: "PROVISIONING" }
  }

  async findApiKeyMeta(
    apiKeyId: string,
  ): Promise<{ id: string; projectId: string; environment: RuntimeEnvironment; status: string; keyPrefix: string } | null> {
    const col = await apiKeysCol()
    // Projection excludes keyHash — non-secret metadata only crosses here.
    const doc = await col.findOne(
      { id: apiKeyId },
      { projection: { id: 1, projectId: 1, environment: 1, status: 1, keyPrefix: 1 } },
    )
    if (!doc) return null
    return {
      id: doc.id,
      projectId: doc.projectId,
      environment: doc.environment,
      status: doc.status,
      keyPrefix: doc.keyPrefix,
    }
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

/**
 * Helper function to map ledger entries to legacy CreditTransaction format.
 * Converts the double-entry ledger structure to the single-entry format
 * expected by legacy code that still uses the CreditTransaction interface.
 */
function mapLedgerToLegacyTransaction(entry: CreditLedgerEntry): CreditTransaction {
  const signedAmount = entry.direction === 'credit' ? entry.amount : -entry.amount

  // Map ledger transaction types to legacy types
  let legacyType: CreditTransaction['type'] = 'grant'
  if (entry.transactionType === 'build_reservation') {
    legacyType = 'reserve'
  } else if (entry.transactionType === 'build_finalization') {
    legacyType = 'consume'
  } else if (entry.transactionType === 'build_release' || entry.transactionType === 'build_refund') {
    legacyType = 'refund'
  } else if (entry.direction === 'debit') {
    legacyType = 'deduction'
  }

  return {
    id: entry.id,
    userId: entry.userId,
    type: legacyType,
    amount: signedAmount,
    reason: (entry.metadata?.reason as string) || entry.transactionType,
    buildRunId: entry.referenceType === 'build' ? entry.referenceId : undefined,
    createdAt: entry.createdAt,
    metadata: entry.metadata
  }
}

function stripMongoId<T extends { _id?: unknown }>(doc: T): Omit<T, "_id"> {
  const { _id, ...rest } = doc
  return rest
}

export { STARTING_CREDITS }
export { cryptoId }
