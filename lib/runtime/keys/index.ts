/**
 * Atai Runtime — key lifecycle barrel (server-only).
 *
 * @module lib/runtime/keys
 */

export {
  createApiKey,
  findActiveApiKeyBySecret,
  findApiKeyById,
  listApiKeys,
  revokeApiKey,
  touchLastUsed,
  sweepExpiredKeys,
  authenticationError,
  authorizationError,
} from "./service"
export { rotateApiKey } from "./rotate"
export { getApiKeyMetadata, listKeysWithLifecycle } from "./metadata"
export { isApiKeyExpired, effectiveKeyStatus } from "./expiration"
export { classifyApiKeyByHash } from "./classify"
export type { ApiKeyClassification } from "./classify"
export { provisionApiKeyForProject } from "./provisioning"
export type { ProvisionKeyInput } from "./provisioning"
