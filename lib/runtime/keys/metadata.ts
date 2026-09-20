import "server-only"
import { apiKeysCol } from "@/lib/db/runtime-collections"
import type { ApiKeyPublic } from "@/runtime/contracts/capabilities"
import type { ApiKeyDoc } from "../types"

/**
 * Atai Runtime — key metadata retrieval & expiration helpers (server-only).
 *
 * All reads are metadata-only: the Mongo projection excludes keyHash so no
 * hash can ever cross a trust boundary, and ApiKeyPublic has no secret field.
 * Ownership is enforced IN the query filter (never fetch-then-check).
 *
 * @module lib/runtime/keys/metadata
 */

const PUBLIC_PROJECTION = { keyHash: 0, _id: 0 } as const

function toPublic(doc: ApiKeyDoc): ApiKeyPublic {
  return {
    id: doc.id,
    projectId: doc.projectId,
    environment: doc.environment,
    name: doc.name,
    keyPrefix: doc.keyPrefix,
    scopes: doc.scopes,
    status: doc.status,
    createdAt: doc.createdAt,
    lastUsedAt: doc.lastUsedAt,
    expiresAt: doc.expiresAt,
    revokedAt: doc.revokedAt,
    revokedReason: doc.revokedReason,
    rotatedFromId: doc.rotatedFromId,
    rotatedToId: doc.rotatedToId,
  }
}

/**
 * Get one key's metadata. Accessible only when the key belongs to `userId`
 * (and, when given, the expected project) — otherwise null. No plaintext
 * secret exists to return; there is no "retrieve secret later" operation.
 */
export async function getApiKeyMetadata(
  userId: string,
  keyId: string,
  projectId?: string,
): Promise<ApiKeyPublic | null> {
  const col = await apiKeysCol()
  const filter: Record<string, unknown> = { id: keyId, userId }
  if (projectId) filter.projectId = projectId
  const doc = await col.findOne(filter, { projection: PUBLIC_PROJECTION })
  return doc ? toPublic(doc as unknown as ApiKeyDoc) : null
}

/**
 * List keys with full lifecycle metadata (revocation/rotation included).
 * Same ownership rules as listApiKeys; optional environment filter.
 */
export async function listKeysWithLifecycle(
  userId: string,
  projectId: string,
  opts: { environment?: "development" | "production" } = {},
): Promise<ApiKeyPublic[]> {
  const col = await apiKeysCol()
  const filter: Record<string, unknown> = { userId, projectId }
  if (opts.environment) filter.environment = opts.environment
  const docs = await col
    .find(filter, { projection: PUBLIC_PROJECTION })
    .sort({ createdAt: -1 })
    .toArray()
  return docs as unknown as ApiKeyPublic[]
}
