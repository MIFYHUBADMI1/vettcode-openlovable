import { MongoClient, type Db } from "mongodb"
import { getMongoUri } from "@/lib/env"
import { isBenignDisconnect } from "@/lib/server/benign-disconnect"
import { logger } from "@/lib/logging/logger"
import { assertTransactionSupport } from "@/lib/db/transaction-readiness"

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

const DEFAULT_POOL = 100
const MIN_POOL = 10
const MAX_POOL = 200
const DEFAULT_WAIT_QUEUE_MS = 20_000
/** Keep a handful of sockets warm: re-dialing this cluster costs seconds per
 * attempt (DNS + TCP + TLS + auth). A higher floor prevents cold-start storms
 * when a burst of requests hits an idle container. */
const MIN_IDLE_POOL = 5
const DEFAULT_SOCKET_TIMEOUT_MS = 120_000
/** Atlas dials (DNS + TCP + TLS + auth) can take several seconds here. */
const DEFAULT_CONNECT_TIMEOUT_MS = 20_000

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
    minPoolSize: MIN_IDLE_POOL,
    waitQueueTimeoutMS: pool.waitQueueTimeoutMS,
    maxIdleTimeMS: 60_000,
    serverSelectionTimeoutMS: DEFAULT_CONNECT_TIMEOUT_MS,
    connectTimeoutMS: DEFAULT_CONNECT_TIMEOUT_MS,
    // Long enough for the slowest report aggregation / index build. The driver
    // reconnects a dead socket on its own; timing out a healthy-but-slow op
    // only tears down the pool in the middle of legitimate work.
    socketTimeoutMS: DEFAULT_SOCKET_TIMEOUT_MS,
  })
  // Without an error listener, socket resets become process-level uncaughtException.
  client.on("error", (error) => {
    if (isBenignDisconnect(error)) return
    logger.warn("mongo", error instanceof Error ? error.message : "Mongo client error")
  })
  // NOTE: never discard `__mirrorMongoClientPromise` from a socket event. The
  // driver already replaces a failed socket inside this client; dropping the
  // cached promise instead builds a SECOND client (with its own pool) whose
  // predecessor is never closed. Repeated socket timeouts leaked clients and
  // connections until the cluster refused new ones, and every checkout then
  // died with MongoWaitQueueTimeoutError.
  return client.connect().then(async (connected) => {
    try {
      await assertTransactionSupport(connected)
      return connected
    } catch (error) {
      await connected.close()
      throw error
    }
  })
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
