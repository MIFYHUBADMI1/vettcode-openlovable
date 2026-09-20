import { getDb } from "./mongodb"
import type { Db } from "mongodb"
import type { ApiKeyDoc, RuntimeUsageDoc } from "@/lib/runtime/types"
import type { ProjectRuntimeConfig } from "@/lib/runtime/control/types"

/**
 * Atai Runtime — collection registration & indexes (Phase 2).
 *
 * Uses the same shared Mongo client (lib/db/mongodb.ts — no second client)
 * and the same idempotent-index pattern as lib/db/collections.ts. Two
 * collections only:
 *
 *   api_keys      — runtime credentials (hash-only secret storage)
 *   runtime_usage — per-request attribution/metering
 *
 * Deliberately NOT created: runtime_environments (environment is a property
 * of the key), runtime_requests (deferred richer log).
 *
 * RETENTION: no TTL index is created on runtime_usage — a retention policy
 * must be explicitly approved before automatic deletion is enabled (Phase 2
 * verification directive). Until then usage events are retained indefinitely
 * like the credit_ledger audit trail.
 *
 * @module lib/db/runtime-collections
 */

/** Cached Db reference following the collections.ts hot-reload pattern. */
const globalForRuntimeDb = globalThis as unknown as { __ataiRuntimeDb?: Db }

async function getRuntimeDb(): Promise<Db> {
  if (!globalForRuntimeDb.__ataiRuntimeDb) {
    globalForRuntimeDb.__ataiRuntimeDb = await getDb()
  }
  return globalForRuntimeDb.__ataiRuntimeDb
}

export async function apiKeysCol() {
  return (await getRuntimeDb()).collection<ApiKeyDoc>("api_keys")
}

export async function runtimeUsageCol() {
  return (await getRuntimeDb()).collection<RuntimeUsageDoc>("runtime_usage")
}

/** Optional per-project Control Center config. Missing doc = platform defaults. */
export async function projectRuntimeConfigCol() {
  return (await getRuntimeDb()).collection<ProjectRuntimeConfig & { _id?: unknown; userId?: string }>(
    "project_runtime_config",
  )
}

let indexesEnsured = false

/**
 * Idempotent index creation for runtime collections (safe to call
 * repeatedly; Mongo no-ops equivalent indexes).
 *
 * runtime_usage indexes are chosen for the eventual reporting/reconciliation
 * queries: by requestId (request → provider-call tracing, NON-unique — one
 * request may fan out to multiple provider calls), by user and by project
 * time-series for dashboards and billing reconciliation.
 */
export async function ensureRuntimeIndexes(): Promise<void> {
  if (indexesEnsured) return
  const db = await getRuntimeDb()

  const apiKeys = db.collection<ApiKeyDoc>("api_keys")
  const runtimeUsage = db.collection<RuntimeUsageDoc>("runtime_usage")

  await Promise.all([
    // API keys — unique hash for O(1) secret lookup (for a high-entropy
    // secret the indexed lookup IS the comparison; see key-crypto.ts).
    apiKeys.createIndex({ keyHash: 1 }, { unique: true, name: "api_keys_keyhash_unique" }),
    apiKeys.createIndex({ userId: 1, createdAt: -1 }, { name: "api_keys_user_created" }),
    apiKeys.createIndex(
      { projectId: 1, environment: 1, status: 1 },
      { name: "api_keys_project_env_status" },
    ),
    // Runtime usage — attribution/reporting/reconciliation. No TTL (retention
    // policy pending explicit approval — see module docblock).
    runtimeUsage.createIndex({ requestId: 1 }, { name: "runtime_usage_request" }),
    runtimeUsage.createIndex({ userId: 1, createdAt: -1 }, { name: "runtime_usage_user_created" }),
    runtimeUsage.createIndex(
      { projectId: 1, createdAt: -1 },
      { name: "runtime_usage_project_created" },
    ),
    // Phase 9.5 admin analytics: time-range scans for the financial summary
    // (all /financials queries sort/filter on createdAt first). Justified by
    // that single query pattern — no speculative compound indexes (§55/§56).
    runtimeUsage.createIndex({ createdAt: -1 }, { name: "runtime_usage_created" }),
    runtimeUsage.createIndex(
      { projectId: 1, environment: 1, createdAt: -1 },
      { name: "runtime_usage_project_env_created" },
    ),
    db.collection("project_runtime_config").createIndex(
      { projectId: 1 },
      { unique: true, name: "project_runtime_config_project" },
    ),
  ])

  indexesEnsured = true
}
