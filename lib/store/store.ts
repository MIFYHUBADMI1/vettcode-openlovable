import type {
  MirrorProject,
  BuildRun,
  CreditTransaction,
  ProjectEvent,
  ConversationMessage,
  DeploymentHistoryEntry,
} from "@/lib/types/project"
import type {
  RuntimeEnvironment,
} from "@/runtime/contracts/capabilities"
import type { RuntimeProvisioningRecord } from "@/lib/runtime/provisioning/types"
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
  listTransactions(userId: string, limit?: number): Promise<CreditTransaction[]>
  addTransaction(tx: CreditTransaction): Promise<void>
  /** Atomically checks the user's balance and debits it in one operation so
   * concurrent requests can never both pass a stale balance check
   * (check-then-act race). Returns false — without writing anything — when
   * the balance is insufficient. */
  reserveCreditsAtomic(userId: string, amount: number, tx: CreditTransaction): Promise<boolean>

  createProject(project: MirrorProject): Promise<MirrorProject>
  getProject(id: string): Promise<MirrorProject | null>
  listProjects(userId: string, limit?: number): Promise<MirrorProject[]>
  updateProject(id: string, patch: Partial<MirrorProject>): Promise<MirrorProject | null>
  /** Atomically transitions a project into `building` only if it is not
   * already in an active build/deploy state, preventing a duplicate build
   * or follow-up prompt from double-launching a provider run
   * (check-then-act race). Returns null if the project could not be
   * claimed (already active, or not found). */
  claimBuildSlot(id: string, patch: Partial<MirrorProject>): Promise<MirrorProject | null>
  appendEvent(id: string, event: ProjectEvent): Promise<void>
  appendMessage(id: string, message: ConversationMessage): Promise<void>
  appendDeploymentRecord(id: string, record: DeploymentHistoryEntry): Promise<void>
  updateDeploymentRecord(id: string, recordId: string, patch: Partial<DeploymentHistoryEntry>): Promise<void>

  createBuildRun(run: BuildRun): Promise<BuildRun>
  getBuildRun(id: string): Promise<BuildRun | null>
  updateBuildRun(id: string, patch: Partial<BuildRun>): Promise<BuildRun | null>
  listBuildRuns(mirrorProjectId: string, opts?: { limit?: number; status?: string }): Promise<BuildRun[]>

  /** Permanently deletes a project owned by `userId`, cascading to remove
   * all of its build runs in the same transaction. Returns false — without
   * deleting anything — if the project doesn't exist or isn't owned by
   * `userId`. */
  deleteProject(id: string, userId: string): Promise<boolean>

  // ─── Runtime provisioning (Phase 8) — safe metadata only, no secrets ───

  /** Read the provisioning record for one (project, environment). */
  getRuntimeProvisioning(
    projectId: string,
    environment: RuntimeEnvironment,
  ): Promise<RuntimeProvisioningRecord | null>
  /** Merge a patch into the provisioning record for one environment.
   * `undefined` values REMOVE the field (crash-repair semantics). */
  updateRuntimeProvisioning(
    projectId: string,
    environment: RuntimeEnvironment,
    patch: Partial<RuntimeProvisioningRecord>,
  ): Promise<void>
  /** Atomically claim the provisioning slot for one (project, environment):
   * flips the record to PROVISIONING only from a non-PROVISIONING state — or
   * from a stale claim older than `staleClaimMs` (crash recovery) — in ONE
   * document transition. Returns null when another live worker holds the
   * claim or the project vanished — callers must not race it. */
  claimRuntimeProvisioning(
    projectId: string,
    environment: RuntimeEnvironment,
    staleClaimMs?: number,
  ): Promise<RuntimeProvisioningRecord | null>
  /** Non-secret credential metadata lookup used to validate provisioning
   * records against live api_keys state (reuse/repair decisions). */
  findApiKeyMeta(
    apiKeyId: string,
  ): Promise<{ id: string; projectId: string; environment: RuntimeEnvironment; status: string; keyPrefix: string } | null>
}

// Persist a single instance across hot reloads in dev.
const globalForStore = globalThis as unknown as { __mirrorStore?: DataStore }
export const store: DataStore = globalForStore.__mirrorStore ?? new MongoStore()
if (!globalForStore.__mirrorStore) globalForStore.__mirrorStore = store
