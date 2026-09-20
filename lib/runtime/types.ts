import type { ObjectId } from "mongodb"
import type {
  CapabilityScope,
  RuntimeEnvironment,
  RuntimeUsageEvent,
  RuntimeUsageStatus,
  ApiKeyStatus,
} from "@/runtime/contracts/capabilities"
import type { RuntimeErrorCode } from "@/runtime/contracts/errors"

/**
 * Atai Runtime — server-side document types (server-only context).
 *
 * Persists the shared contracts with MongoDB concerns added. Ownership model:
 *
 *   api_key → userId (Atai user, ownership root) → projectId (Atai project)
 *
 * No Account/Organization collection exists or is created — `users` stays the
 * single identity source (approved Phase 1/2 decision).
 *
 * @module lib/runtime/types
 */

/** MongoDB document for `api_keys`. Contract: runtime/contracts/capabilities. */
export interface ApiKeyDoc {
  _id: ObjectId
  id: string // "rkey_..." — non-secret reference
  userId: string // Atai user id (ownership root) — REQUIRED
  projectId: string // Atai project id — REQUIRED
  environment: RuntimeEnvironment
  name?: string
  /** SHA-256 hex of the full plaintext secret. UNIQUE index. */
  keyHash: string
  /** Non-secret display prefix, e.g. "atai_production_a81f…". */
  keyPrefix: string
  /** Empty array = all capabilities granted. */
  scopes: CapabilityScope[]
  status: ApiKeyStatus
  createdAt: number
  /** Throttled (≥60s between writes) — see touchLastUsed. */
  lastUsedAt?: number
  expiresAt?: number
  revokedAt?: number
  revokedReason?: string
  /** Rotation lineage. */
  rotatedFromId?: string
  rotatedToId?: string
  /** Grace-deactivation timestamp during rotation overlap. */
  deactivateAt?: number
}

/**
 * MongoDB document for `runtime_usage`. The persisted twin of the shared
 * RuntimeUsageEvent contract. Sensitive request content (API keys, provider
 * credentials, authorization headers, full bodies/prompts/responses, uploaded
 * documents, private content) is NEVER stored here — attribution, usage,
 * cost, latency, provider, model, and error category only.
 */
export interface RuntimeUsageDoc extends RuntimeUsageEvent {
  _id: ObjectId
}

/** Re-exports so server modules can import document+helper types in one place. */
export type {
  CapabilityScope,
  RuntimeEnvironment,
  RuntimeUsageStatus,
  ApiKeyStatus,
  RuntimeErrorCode,
  RuntimeUsageEvent,
}
