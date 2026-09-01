import { MongoClient, type Db } from "mongodb"
import { getMongoUri } from "@/lib/env"

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

function connect(): Promise<MongoClient> {
  const uri = getMongoUri()
  const client = new MongoClient(uri, {
    maxPoolSize: 10,
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
