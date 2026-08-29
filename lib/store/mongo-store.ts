import type { DataStore } from "@/lib/store/store"
import { cryptoId } from "@/lib/store/id"
import { projectsCol, buildRunsCol, creditTransactionsCol, ensureIndexes } from "@/lib/db/collections"
import type { MirrorProject, BuildRun, CreditTransaction, ProjectEvent, ConversationMessage } from "@/lib/types/project"

const STARTING_CREDITS = 500

/**
 * MongoDB-backed implementation of the same `DataStore` interface the
 * in-memory store implements — the Firecrawl/Totalum orchestration code
 * never changes, only the persistence layer underneath it (spec section 20).
 * User balance now lives on the `users` collection (see lib/auth/users.ts);
 * `ensureUser`/`getBalance` here delegate to it so callers keep one surface.
 */
export class MongoStore implements DataStore {
  async ensureUser(userId: string): Promise<void> {
    const { usersCol } = await import("@/lib/db/collections")
    const users = await usersCol()
    const existing = await users.findOne({ id: userId })
    if (!existing) return // Real users are created at registration/OAuth time.
  }

  async getBalance(userId: string): Promise<number> {
    const { usersCol } = await import("@/lib/db/collections")
    const users = await usersCol()
    const user = await users.findOne({ id: userId })
    return user?.credits ?? 0
  }

  async listTransactions(userId: string): Promise<CreditTransaction[]> {
    await ensureIndexes()
    const col = await creditTransactionsCol()
    const docs = await col.find({ userId }).sort({ createdAt: -1 }).toArray()
    return docs.map(stripMongoId)
  }

  async addTransaction(tx: CreditTransaction): Promise<void> {
    await ensureIndexes()
    const { usersCol } = await import("@/lib/db/collections")
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
  }

  async reserveCreditsAtomic(userId: string, amount: number, tx: CreditTransaction): Promise<boolean> {
    await ensureIndexes()
    const { usersCol } = await import("@/lib/db/collections")
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
  }

  async createProject(project: MirrorProject): Promise<MirrorProject> {
    await ensureIndexes()
    const col = await projectsCol()
    await col.insertOne({ ...project })
    return project
  }

  async getProject(id: string): Promise<MirrorProject | null> {
    const col = await projectsCol()
    const doc = await col.findOne({ id })
    return doc ? stripMongoId(doc) : null
  }

  async listProjects(userId: string): Promise<MirrorProject[]> {
    const col = await projectsCol()
    const docs = await col.find({ userId }).sort({ updatedAt: -1 }).toArray()
    return docs.map(stripMongoId)
  }

  async updateProject(id: string, patch: Partial<MirrorProject>): Promise<MirrorProject | null> {
    const col = await projectsCol()
    const updatedAt = Date.now()
    const result = await col.findOneAndUpdate(
      { id },
      { $set: { ...patch, updatedAt } },
      { returnDocument: "after" },
    )
    return result ? stripMongoId(result) : null
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
    return result ? stripMongoId(result) : null
  }

  async appendEvent(id: string, event: ProjectEvent): Promise<void> {
    const col = await projectsCol()
    await col.updateOne({ id }, { $push: { events: event }, $set: { updatedAt: Date.now() } })
  }

  async appendMessage(id: string, message: ConversationMessage): Promise<void> {
    const col = await projectsCol()
    await col.updateOne({ id }, { $push: { conversation: message }, $set: { updatedAt: Date.now() } })
  }

  async createBuildRun(run: BuildRun): Promise<BuildRun> {
    await ensureIndexes()
    const col = await buildRunsCol()
    await col.insertOne({ ...run })
    return run
  }

  async getBuildRun(id: string): Promise<BuildRun | null> {
    const col = await buildRunsCol()
    const doc = await col.findOne({ id })
    return doc ? stripMongoId(doc) : null
  }

  async updateBuildRun(id: string, patch: Partial<BuildRun>): Promise<BuildRun | null> {
    const col = await buildRunsCol()
    const result = await col.findOneAndUpdate({ id }, { $set: patch }, { returnDocument: "after" })
    return result ? stripMongoId(result) : null
  }

  async listBuildRuns(mirrorProjectId: string): Promise<BuildRun[]> {
    const col = await buildRunsCol()
    const docs = await col.find({ mirrorProjectId }).sort({ startedAt: -1 }).toArray()
    return docs.map(stripMongoId)
  }

  async deleteProject(id: string, userId: string): Promise<boolean> {
    console.log("[v0] store.deleteProject: checking ownership", { id, userId })
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
          console.log("[v0] store.deleteProject: not found or not owned, aborting", { id, userId })
          deleted = false
          return
        }
        const runsResult = await runsCol.deleteMany({ mirrorProjectId: id }, { session })
        console.log("[v0] store.deleteProject: cascaded build run delete", {
          id,
          deletedBuildRuns: runsResult.deletedCount,
        })
        deleted = true
      })
      console.log("[v0] store.deleteProject: result", { id, deleted })
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
