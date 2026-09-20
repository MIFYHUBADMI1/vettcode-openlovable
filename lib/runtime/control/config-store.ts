import "server-only"
import { ObjectId, type WithId } from "mongodb"
import {
  projectRuntimeConfigCol,
  ensureRuntimeIndexes,
} from "@/lib/db/runtime-collections"
import { logger } from "@/lib/logging/logger"
import { isValidModelId } from "./models"
import { ProjectRuntimeConfigPatchSchema } from "./schema"
import type { ProjectRuntimeConfig, ProjectRuntimeLimits } from "./types"
import { DEFAULT_PROJECT_RUNTIME_CONFIG } from "./types"

/**
 * Project-owned runtime config (Control Center). Optional fields + safe
 * defaults: missing documents MUST NOT change existing runtime behavior.
 */

interface ProjectRuntimeConfigDoc {
  _id: ObjectId
  projectId: string
  userId: string
  defaultModel?: string
  allowedModels: string[]
  fallbackModels: string[]
  allowEndUserModelSelection: boolean
  limits: ProjectRuntimeLimits
  createdAt: number
  updatedAt: number
}

const cache = new Map<string, { at: number; value: ProjectRuntimeConfig }>()
const CACHE_TTL_MS = 5_000

export function clearProjectRuntimeConfigCache(projectId?: string): void {
  if (projectId) cache.delete(projectId)
  else cache.clear()
}

function toPublic(doc: ProjectRuntimeConfigDoc): ProjectRuntimeConfig {
  return {
    projectId: doc.projectId,
    ...(doc.defaultModel ? { defaultModel: doc.defaultModel } : {}),
    allowedModels: doc.allowedModels ?? [],
    fallbackModels: doc.fallbackModels ?? [],
    allowEndUserModelSelection: doc.allowEndUserModelSelection !== false,
    limits: doc.limits ?? {},
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

function defaultsFor(projectId: string): ProjectRuntimeConfig {
  const now = Date.now()
  return {
    projectId,
    ...DEFAULT_PROJECT_RUNTIME_CONFIG,
    createdAt: now,
    updatedAt: now,
  }
}

export async function getProjectRuntimeConfig(projectId: string): Promise<ProjectRuntimeConfig> {
  await ensureRuntimeIndexes()
  const col = await projectRuntimeConfigCol()
  const doc = (await col.findOne({ projectId })) as WithId<Partial<ProjectRuntimeConfigDoc>> | null
  if (!doc) return defaultsFor(projectId)
  return toPublic(doc as ProjectRuntimeConfigDoc)
}

/** Hot-path read with a short TTL so chat requests are not a Mongo round-trip each time. */
export async function getCachedProjectRuntimeConfig(projectId: string): Promise<ProjectRuntimeConfig> {
  const hit = cache.get(projectId)
  const now = Date.now()
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.value
  try {
    const value = await getProjectRuntimeConfig(projectId)
    cache.set(projectId, { at: now, value })
    return value
  } catch (e) {
    logger.warn("runtime.control", "config read failed; using platform defaults", {
      projectId,
      message: e instanceof Error ? e.message : String(e),
    })
    return defaultsFor(projectId)
  }
}

export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ConfigValidationError"
  }
}

export async function patchProjectRuntimeConfig(
  userId: string,
  projectId: string,
  patch: unknown,
): Promise<ProjectRuntimeConfig> {
  const parsed = ProjectRuntimeConfigPatchSchema.safeParse(patch)
  if (!parsed.success) {
    throw new ConfigValidationError("Invalid runtime configuration.")
  }
  const data = parsed.data

  const current = await getProjectRuntimeConfig(projectId)

  const nextAllowed = data.allowedModels ?? current.allowedModels
  const nextFallback = data.fallbackModels ?? current.fallbackModels
  let nextDefault: string | undefined =
    data.defaultModel === ""
      ? undefined
      : data.defaultModel !== undefined
        ? data.defaultModel
        : current.defaultModel

  if (nextDefault && !isValidModelId(nextDefault)) {
    throw new ConfigValidationError("Invalid default model.")
  }

  if (nextAllowed.length > 0) {
    if (nextDefault && !nextAllowed.includes(nextDefault)) {
      throw new ConfigValidationError("Default model must be in the allowed list.")
    }
    for (const id of nextFallback) {
      if (!nextAllowed.includes(id)) {
        throw new ConfigValidationError("Fallback models must be in the allowed list.")
      }
    }
  }

  const nextLimits: ProjectRuntimeLimits = { ...current.limits }
  if (data.limits) {
    if (data.limits.requestsPerMinute === null) delete nextLimits.requestsPerMinute
    else if (data.limits.requestsPerMinute !== undefined) {
      nextLimits.requestsPerMinute = data.limits.requestsPerMinute
    }
    if (data.limits.requestsPerDay === null) delete nextLimits.requestsPerDay
    else if (data.limits.requestsPerDay !== undefined) {
      nextLimits.requestsPerDay = data.limits.requestsPerDay
    }
  }

  const now = Date.now()
  const doc: Omit<ProjectRuntimeConfigDoc, "_id"> = {
    projectId,
    userId,
    ...(nextDefault ? { defaultModel: nextDefault } : {}),
    allowedModels: nextAllowed,
    fallbackModels: nextFallback,
    allowEndUserModelSelection:
      data.allowEndUserModelSelection ?? current.allowEndUserModelSelection,
    limits: nextLimits,
    createdAt: current.createdAt,
    updatedAt: now,
  }

  await ensureRuntimeIndexes()
  const col = await projectRuntimeConfigCol()
  await col.updateOne(
    { projectId },
    {
      $set: doc,
      $setOnInsert: { _id: new ObjectId() },
    },
    { upsert: true },
  )

  clearProjectRuntimeConfigCache(projectId)
  const saved = await getProjectRuntimeConfig(projectId)
  cache.set(projectId, { at: Date.now(), value: saved })

  logger.info("runtime.control", "project runtime config updated", {
    projectId,
    userId,
    hasDefaultModel: Boolean(saved.defaultModel),
    allowedCount: saved.allowedModels.length,
    hasRpm: saved.limits.requestsPerMinute !== undefined,
    hasRpd: saved.limits.requestsPerDay !== undefined,
  })

  return saved
}
