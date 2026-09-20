import "server-only"
import { store } from "@/lib/store/store"
import { logger } from "@/lib/logging/logger"
import { createApiKey } from "./service"
import type {
  ApiKeyCreated,
  RuntimeEnvironment,
  CapabilityScope,
} from "@/runtime/contracts/capabilities"

/**
 * Atai Runtime — provisioning-ready key creation (server-only).
 *
 * PHASE 3 BOUNDARY: this helper makes the lifecycle service callable
 * **programmatically** for an authorized project — nothing more. Automatic
 * provisioning during application generation, Totalum secret injection, and
 * build-pipeline hooks are explicitly LATER phases (Generated Application
 * Integration); none of that is invoked here.
 *
 * Ownership is derived SERVER-SIDE from the project record (`project.userId`)
 * — never from a client-supplied userId. Because Atai's own code invokes
 * this path, the Atai project record is the trust anchor.
 *
 * MULTI-KEY MODEL (addendum): no uniqueness is enforced on
 * (userId, projectId, environment) — a project may hold any number of keys
 * (development, production, rotation, separate instances). Only keyHash is
 * unique, and only because two identical secrets would be the same key.
 *
 * @module lib/runtime/keys/provisioning
 */

export interface ProvisionKeyInput {
  projectId: string
  environment: RuntimeEnvironment
  /** Explicit scopes REQUIRED — the service never silently grants "all" (§13: prefer explicit scopes). */
  scopes: CapabilityScope[]
  name?: string
  expiresAt?: number
}

/**
 * Create an API key for a project, deriving the owning userId from the
 * existing project record. For future automatic provisioning of generated
 * applications; usable today by internal automation.
 *
 * Throws Error("RUNTIME_PROJECT_NOT_FOUND") when the project does not exist.
 */
export async function provisionApiKeyForProject(input: ProvisionKeyInput): Promise<ApiKeyCreated> {
  const project = await store.getProject(input.projectId)
  if (!project) {
    throw new Error("RUNTIME_PROJECT_NOT_FOUND")
  }

  const created = await createApiKey(project.userId, {
    projectId: input.projectId,
    environment: input.environment,
    scopes: input.scopes,
    name: input.name,
    expiresAt: input.expiresAt,
  })

  logger.info("runtime.keys", "API key provisioned for project", {
    keyId: created.id,
    projectId: input.projectId,
    environment: input.environment,
    scopes: input.scopes,
  })

  return created
}
