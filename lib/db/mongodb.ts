import { MongoClient, type Db } from "mongodb"
import { getMongoUri } from "@/lib/env"
import { isBenignDisconnect } from "@/lib/server/benign-disconnect"
import { logger } from "@/lib/logging/logger"

/**
 * Cached MongoDB client/connection (spec section 20). Connects lazily on
 * first use — never at module load — so routes that don't touch the DB never
 * crash when MONGODB_URI is unset. A globalThis singleton survives dev HMR
 * reloads and is reused across serverless invocations within the same
 * container.
 */
const globalForMongo = globalThis as unknown as {
  __mirrorMongoClientPromise?: Promise<MongoClient>
}

const DEFAULT_POOL = 50
const MIN_POOL = 10
const MAX_POOL = 200
const DEFAULT_WAIT_QUEUE_MS = 10_000

function boundedInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = raw ? Number(raw) : NaN
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}

export function getMongoPoolOptions(): { maxPoolSize: number; waitQueueTimeoutMS: number } {
  return {
    maxPoolSize: boundedInt(process.env.MONGODB_MAX_POOL_SIZE, DEFAULT_POOL, MIN_POOL, MAX_POOL),
    waitQueueTimeoutMS: boundedInt(
      process.env.MONGODB_WAIT_QUEUE_TIMEOUT_MS,
      DEFAULT_WAIT_QUEUE_MS,
      1_000,
      30_000,
    ),
  }
}

function connect(): Promise<MongoClient> {
  const uri = getMongoUri()
  const pool = getMongoPoolOptions()
  const client = new MongoClient(uri, {
    maxPoolSize: pool.maxPoolSize,
    waitQueueTimeoutMS: pool.waitQueueTimeoutMS,
    maxIdleTimeMS: 30_000,
    serverSelectionTimeoutMS: 8000,
  })
  // Without an error listener, socket resets become process-level uncaughtException.
  client.on("error", (error) => {
    if (isBenignDisconnect(error)) return
    logger.warn("mongo", error instanceof Error ? error.message : "Mongo client error")
  })
  return client.connect()
}

export async function getMongoClient(): Promise<MongoClient> {
  if (!globalForMongo.__mirrorMongoClientPromise) {
    globalForMongo.__mirrorMongoClientPromise = connect()
  }
  try {
    return await globalForMongo.__mirrorMongoClientPromise
  } catch (e) {
    // Reset so the next call retries the connection instead of caching a
    // permanently-rejected promise.
    globalForMongo.__mirrorMongoClientPromise = undefined
    throw e
  }
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient()
  return client.db()
}
