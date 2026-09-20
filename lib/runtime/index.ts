/**
 * Atai Runtime — server module barrel (server-only entry).
 *
 * The runtime layer is isolated from the build pipeline: nothing under
 * lib/runtime is imported by planning/collaboration/Totalum code, and nothing
 * here mutates existing billing or auth behavior. Shared, SDK-safe contracts
 * live separately in runtime/contracts (no server-only imports).
 *
 * @module lib/runtime
 */

export * from "./types"
export {
  generateApiKey,
  generateApiKeySecret,
  hashApiKey,
  apiKeyDisplayPrefix,
  hashesEqual,
} from "./key-crypto"
export type { GeneratedApiKey, ApiKeyHashedSecret } from "./key-crypto"
export * from "./keys"
export * from "./auth"
export * from "./router"
export { checkProjectOwnership, keyBelongsToProject, keyBelongsToUser } from "./ownership"
export {
  recordUsage,
  findUsageByRequestId,
  listUsageByProject,
  listUsageByUser,
  makeUsageEvent,
} from "./usage"
