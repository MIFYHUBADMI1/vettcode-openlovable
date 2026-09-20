/**
 * Atai Runtime — provisioning barrel (server-only).
 *
 * @module lib/runtime/provisioning
 */

export {
  ensureRuntimeProvisioned,
  getProvisioningStatus,
  environmentForLifecycle,
  runtimeBaseUrl,
  provisionedKeyName,
  ATAI_RUNTIME_SECRET_NAME,
  PROVISIONED_KEY_SCOPES,
  RuntimeProvisioningError,
} from "./service"
export type {
  EnsureProvisionedResult,
  ProvisioningFailureReason,
} from "./service"
export type {
  RuntimeProvisioningStatus,
  RuntimeProvisioningRecord,
  RuntimeProvisioningMap,
} from "./types"
