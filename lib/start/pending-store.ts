import { cookies } from "next/headers"
import { ObjectId } from "mongodb"
import { getDb } from "@/lib/db/mongodb"
import { generateToken } from "@/lib/auth/crypto"
import type { PendingStart } from "@/lib/auth/client-intent"

export const PENDING_TOKEN_COOKIE = "Atai_pending_start"
const MAX_AGE_SEC = 60 * 10

export type PendingStartDoc = {
  _id?: ObjectId
  token: string
  payload: PendingStart
  userId?: string
  createdAt: number
  expiresAt: Date
}

async function col() {
  const db = await getDb()
  const collection = db.collection<PendingStartDoc>("pending_starts")
  await collection.createIndex({ token: 1 }, { unique: true }).catch(() => undefined)
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => undefined)
  return collection
}

function isPending(value: unknown): value is PendingStart {
  if (!value || typeof value !== "object") return false
  const p = value as PendingStart
  return typeof p.prompt === "string" && p.prompt.trim().length > 0 && typeof p.href === "string"
}

export async function savePendingStartServer(payload: PendingStart, userId?: string | null) {
  if (!isPending(payload)) return
  const jar = await cookies()
  const existingToken = jar.get(PENDING_TOKEN_COOKIE)?.value
  const token = existingToken || generateToken()
  const now = Date.now()
  const collection = await col()
  await collection.updateOne(
    { token },
    {
      $set: {
        token,
        payload: {
          ...payload,
          prompt: payload.prompt.trim().slice(0, 8000),
          href: payload.href.startsWith("/") ? payload.href : "/start",
        },
        ...(userId ? { userId } : {}),
        createdAt: now,
        expiresAt: new Date(now + MAX_AGE_SEC * 1000),
      },
    },
    { upsert: true },
  )
  jar.set(PENDING_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: MAX_AGE_SEC,
  })
}

export async function readPendingStartServer(userId?: string | null): Promise<PendingStart | null> {
  const jar = await cookies()
  const token = jar.get(PENDING_TOKEN_COOKIE)?.value
  if (!token) return null
  const collection = await col()
  const doc = await collection.findOne({ token, expiresAt: { $gt: new Date() } })
  if (!doc || !isPending(doc.payload)) return null
  if (doc.userId && userId && doc.userId !== userId) return null
  if (userId && !doc.userId) {
    await collection.updateOne({ token }, { $set: { userId } })
  }
  return doc.payload
}

export async function clearPendingStartServer() {
  const jar = await cookies()
  const token = jar.get(PENDING_TOKEN_COOKIE)?.value
  jar.delete(PENDING_TOKEN_COOKIE)
  if (!token) return
  const collection = await col()
  await collection.deleteOne({ token })
}

export type CreateIdempotencyDoc = {
  userId: string
  key: string
  projectId: string
  createdAt: number
  expiresAt: Date
}

async function idempotencyCol() {
  const db = await getDb()
  const collection = db.collection<CreateIdempotencyDoc>("project_create_idempotency")
  await collection.createIndex({ userId: 1, key: 1 }, { unique: true }).catch(() => undefined)
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => undefined)
  return collection
}

export async function findCreateIdempotency(userId: string, key: string) {
  const collection = await idempotencyCol()
  return collection.findOne({ userId, key })
}

export async function saveCreateIdempotency(userId: string, key: string, projectId: string) {
  const collection = await idempotencyCol()
  try {
    await collection.insertOne({
      userId,
      key,
      projectId,
      createdAt: Date.now(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
    return true
  } catch {
    return false
  }
}
