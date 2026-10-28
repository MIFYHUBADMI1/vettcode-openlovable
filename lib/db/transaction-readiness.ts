import type { MongoClient } from "mongodb"
import { AppError } from "@/lib/errors"

export async function assertTransactionSupport(client: MongoClient): Promise<void> {
  try {
    const hello = await client.db().admin().command({ hello: 1 })
    const isSharded = hello.msg === "isdbgrid"
    const isReplicaSet = typeof hello.setName === "string" && hello.setName.length > 0
    if ((!isSharded && !isReplicaSet) || !Number.isFinite(hello.logicalSessionTimeoutMinutes) || hello.logicalSessionTimeoutMinutes <= 0 || !Number.isInteger(hello.maxWireVersion) || hello.maxWireVersion < (isSharded ? 8 : 7)) {
      throw new Error()
    }
  } catch {
    throw new AppError("DATABASE_UNAVAILABLE", "Transactional database readiness check failed.", 503)
  }
}
