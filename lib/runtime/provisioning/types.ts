/**
 * Atai Runtime — provisioning types (server-side).
 *
 * The provisioning record is SAFE METADATA ONLY: statuses, non-secret key
 * references, and timestamps. By construction it cannot carry a plaintext
 * secret or a key hash — there are no fields for them (Phase 8 §41/§84).
 * The `api_keys` collection remains the single source of truth for credential
 * lifecycle.
 *
 * @module lib/runtime/provisioning/types
 */

import type { RuntimeEnvironment } from "@/runtime/contracts/capabilities"

/**
 * Provisioning state machine (Phase 8 §38). Deliberately minimal — it tracks
 * ONLY the credential+delivery workflow; the project lifecycle
 * (building/ready/deploying/deployed) remains the existing ProjectState.
 *
 *   NOT_PROVISIONED → PROVISIONING → KEY_CREATED → READY
 *                          ↓              ↓
 *                        FAILED ←── (secret injection / key creation failure)
 *
 * FAILED is always safe to retry: the retry either reuses a valid key (fast
 * path) or revokes-and-replaces the undeliverable one.
 */
export type RuntimeProvisioningStatus =
  | "NOT_PROVISIONED"
  | "PROVISIONING"
  | "KEY_CREATED"
  | "READY"
  | "FAILED"

/**
 * Per-(projectId, environment) provisioning metadata persisted inside the
 * project document (`runtimeProvisioning[environment]`). NEVER contains the
 * plaintext secret or the key hash — enforced by the type's field set.
 */
export interface RuntimeProvisioningRecord {
  status: RuntimeProvisioningStatus
  /** Non-secret reference to the provisioned key (rkey_...). */
  apiKeyId?: string
  /** Non-secret display prefix (atai_<env>_xxxx…) for safe rendering. */
  keyPrefix?: string
  /** Epoch ms when the credential was delivered to the generated app. */
  provisionedAt?: number
  /** Epoch ms when the current PROVISIONING claim was taken (lease). */
  claimedAt?: number
  /** Stable failure reason string when status === "FAILED". */
  error?: string
}

/** Where provisioning records live on a MirrorProject, keyed by environment. */
export type RuntimeProvisioningMap = Partial<
  Record<RuntimeEnvironment, RuntimeProvisioningRecord>
>
