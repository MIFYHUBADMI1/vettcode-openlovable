import "server-only"
import { ObjectId } from "mongodb"
import { getMongoClient } from "@/lib/db/mongodb"
import { apiKeysCol } from "@/lib/db/runtime-collections"
import { cryptoId } from "@/lib/store/id"
import { logger } from "@/lib/logging/logger"
import { generateApiKey } from "../key-crypto"
import type { ApiKeyPublic, ApiKeyCreated } from "@/runtime/contracts/capabilities"
import type { ApiKeyDoc } from "../types"

/**
 * Atai Runtime — atomic key rotation (server-only).
 *
 * SEMANTICS DECISION (documented per Phase 3 §22): rotation REPLACES the old
 * key immediately — create new → retire old, inside ONE transaction. No
 * overlap/grace period is invented: the brief says not to introduce one now,
 * and "two production credentials active indefinitely" is exactly what
 * immediate replacement avoids. Old records are preserved (never deleted) for
 * audit/usage attribution; only their status changes.
 *
 * CONCURRENCY (§23): the old key is retired with a conditional update
 * (`status: "active"` in the filter). Only ONE concurrent rotation can win
 * that transition; the loser's transaction aborts and throws
 * runtime_key_revoked, so conflicting rotation relationships cannot exist.
 *
 * @module lib/runtime/keys/rotate
 */

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
 * Rotate an owned, still-active key: create a replacement with a freshly
 * generated secret, link lineage in both directions, and retire the old key
 * — atomically. Ownership is enforced in the retire filter; a caller who
 * doesn't own the key affects nothing.
 *
 * Returns the new key's public metadata + plaintext secret (exactly once).
 */
export async function rotateApiKey(params: {
  userId: string
  keyId: string
  /** Sanitized reason recorded on the old key (e.g. "scheduled_rotation"). */
  reason?: string
}): Promise<ApiKeyCreated> {
  const { userId, keyId, reason } = params
  const mongoClient = await getMongoClient()
  const session = mongoClient.startSession()

  try {
    return await session.withTransaction(async (): Promise<ApiKeyCreated> => {
      const db = mongoClient.db()
      const keys = db.collection<ApiKeyDoc>("api_keys")

      // Load the old key inside the transaction (for scopes/environment copy).
      const oldKey = await keys.findOne({ id: keyId, userId }, { session })
      if (!oldKey) {
        // Same generic failure whether missing or not-owned — no existence leak.
        throw new Error("RUNTIME_KEY_NOT_ACCESSIBLE")
      }
      if (oldKey.status !== "active") {
        throw new Error("RUNTIME_KEY_NOT_ACTIVE")
      }

      // 1. Create the replacement key (fresh secret — never derived from old).
      const generated = generateApiKey(oldKey.environment)
      const now = Date.now()
      const newDoc: ApiKeyDoc = {
        _id: new ObjectId(),
        id: `rkey_${cryptoId()}`,
        userId: oldKey.userId,
        projectId: oldKey.projectId,
        environment: oldKey.environment,
        name: oldKey.name,
        keyHash: generated.keyHash,
        keyPrefix: generated.keyPrefix,
        scopes: oldKey.scopes,
        status: "active",
        createdAt: now,
        ...(oldKey.expiresAt !== undefined ? { expiresAt: oldKey.expiresAt } : {}),
        rotatedFromId: oldKey.id,
      }
      await keys.insertOne(newDoc, { session })

      // 2. Retire the old key with a conditional transition — the concurrency
      //    guard. If another request already revoked/rotated it, this matches
      //    nothing and the transaction aborts (rolled back insert above).
      const retired = await keys.updateOne(
        { id: oldKey.id, userId, status: "active" },
        {
          $set: {
            status: "revoked" as const,
            revokedAt: now,
            revokedReason: reason ?? "rotated",
            rotatedToId: newDoc.id,
          },
        },
        { session },
      )
      if (retired.modifiedCount === 0) {
        throw new Error("RUNTIME_KEY_CONCURRENT_MODIFICATION")
      }

      logger.info("runtime.keys", "API key rotated", {
        oldKeyId: oldKey.id,
        newKeyId: newDoc.id,
        userId,
        projectId: oldKey.projectId,
        environment: oldKey.environment,
      })

      return { ...toPublic(newDoc), secret: generated.secret }
    })
  } finally {
    await session.endSession()
  }
}
