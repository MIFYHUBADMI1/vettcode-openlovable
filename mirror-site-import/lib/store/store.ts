import type {
  MirrorProject,
  BuildRun,
  CreditTransaction,
  ProjectEvent,
  ConversationMessage,
} from "@/lib/types/project"
import { MongoStore } from "@/lib/store/mongo-store"

export { cryptoId } from "@/lib/store/id"

/**
 * Data store interface. `MongoStore` (lib/store/mongo-store.ts) is the real,
 * persistent implementation backed by MongoDB. Every method is keyed so the
 * Firecrawl/Totalum orchestration code never needs to change when the
 * persistence layer underneath it changes (spec sections 20 & 41).
 */
export interface DataStore {
  ensureUser(userId: string): Promise<void>
  getBalance(userId: string): Promise<number>
  listTransactions(userId: string): Promise<CreditTransaction[]>
  addTransaction(tx: CreditTransaction): Promise<void>
  /** Atomically checks the user's balance and debits it in one operation so
   * concurrent requests can never both pass a stale balance check
   * (check-then-act race). Returns false — without writing anything — when
   * the balance is insufficient. */
  reserveCreditsAtomic(userId: string, amount: number, tx: CreditTransaction): Promise<boolean>

  createProject(project: MirrorProject): Promise<MirrorProject>
  getProject(id: string): Promise<MirrorProject | null>
  listProjects(userId: string): Promise<MirrorProject[]>
  updateProject(id: string, patch: Partial<MirrorProject>): Promise<MirrorProject | null>
  /** Atomically transitions a project into `building` only if it is not
   * already in an active build/deploy state, preventing a duplicate build
   * or follow-up prompt from double-launching a provider run
   * (check-then-act race). Returns null if the project could not be
   * claimed (already active, or not found). */
  claimBuildSlot(id: string, patch: Partial<MirrorProject>): Promise<MirrorProject | null>
  appendEvent(id: string, event: ProjectEvent): Promise<void>
  appendMessage(id: string, message: ConversationMessage): Promise<void>

  createBuildRun(run: BuildRun): Promise<BuildRun>
  getBuildRun(id: string): Promise<BuildRun | null>
  updateBuildRun(id: string, patch: Partial<BuildRun>): Promise<BuildRun | null>
  listBuildRuns(mirrorProjectId: string): Promise<BuildRun[]>
}

// Persist a single instance across hot reloads in dev.
const globalForStore = globalThis as unknown as { __mirrorStore?: DataStore }
export const store: DataStore = globalForStore.__mirrorStore ?? new MongoStore()
if (!globalForStore.__mirrorStore) globalForStore.__mirrorStore = store
