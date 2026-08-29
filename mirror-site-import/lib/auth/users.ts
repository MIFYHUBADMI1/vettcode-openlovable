import { ObjectId } from "mongodb"
import { usersCol, ensureIndexes } from "@/lib/db/collections"
import type { UserDoc } from "@/lib/types/db"
import { cryptoId } from "@/lib/store/store"

const STARTING_CREDITS = 500

export interface PublicUser {
  id: string
  email: string
  name: string
  authProvider: "password" | "google"
  emailVerified: boolean
  imageUrl?: string
  credits: number
  createdAt: number
}

function toPublicUser(doc: UserDoc): PublicUser {
  return {
    id: doc.id,
    email: doc.email,
    name: doc.name,
    authProvider: doc.authProvider,
    emailVerified: doc.emailVerified,
    imageUrl: doc.imageUrl,
    credits: doc.credits,
    createdAt: doc.createdAt,
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function findUserByEmail(email: string): Promise<UserDoc | null> {
  await ensureIndexes()
  const col = await usersCol()
  return col.findOne({ email: normalizeEmail(email), deletedAt: { $exists: false } })
}

export async function findUserById(id: string): Promise<UserDoc | null> {
  const col = await usersCol()
  return col.findOne({ id, deletedAt: { $exists: false } })
}

export async function findUserByGoogleId(googleId: string): Promise<UserDoc | null> {
  const col = await usersCol()
  return col.findOne({ googleId, deletedAt: { $exists: false } })
}

/** Create a brand-new password-auth user. Callers must have already checked
 * for an existing email (spec section 3). */
export async function createPasswordUser(params: {
  email: string
  name: string
  passwordHash: string
}): Promise<UserDoc> {
  await ensureIndexes()
  const col = await usersCol()
  const now = Date.now()
  const doc: UserDoc = {
    _id: new ObjectId(),
    id: `user_${cryptoId()}`,
    email: normalizeEmail(params.email),
    name: params.name,
    passwordHash: params.passwordHash,
    authProvider: "password",
    emailVerified: false,
    credits: STARTING_CREDITS,
    createdAt: now,
    updatedAt: now,
  }
  await col.insertOne(doc)
  return doc
}

/** Create a Google-auth user (already verified — Google verified the email). */
export async function createGoogleUser(params: {
  email: string
  name: string
  googleId: string
  imageUrl?: string
}): Promise<UserDoc> {
  await ensureIndexes()
  const col = await usersCol()
  const now = Date.now()
  const doc: UserDoc = {
    _id: new ObjectId(),
    id: `user_${cryptoId()}`,
    email: normalizeEmail(params.email),
    name: params.name,
    authProvider: "google",
    googleId: params.googleId,
    emailVerified: true,
    imageUrl: params.imageUrl,
    credits: STARTING_CREDITS,
    createdAt: now,
    updatedAt: now,
  }
  await col.insertOne(doc)
  return doc
}

/** Link a Google identity onto an existing password-auth account with the
 * same email (spec's account-linking-by-email algorithm). */
export async function linkGoogleToUser(userId: string, googleId: string, imageUrl?: string): Promise<void> {
  const col = await usersCol()
  await col.updateOne(
    { id: userId },
    { $set: { googleId, imageUrl: imageUrl ?? undefined, updatedAt: Date.now() } },
  )
}

export async function markEmailVerified(userId: string): Promise<void> {
  const col = await usersCol()
  await col.updateOne({ id: userId }, { $set: { emailVerified: true, updatedAt: Date.now() } })
}

export async function setPasswordHash(userId: string, passwordHash: string): Promise<void> {
  const col = await usersCol()
  await col.updateOne({ id: userId }, { $set: { passwordHash, updatedAt: Date.now() } })
}

export async function touchLastLogin(userId: string): Promise<void> {
  const col = await usersCol()
  await col.updateOne({ id: userId }, { $set: { lastLoginAt: Date.now() } })
}

export async function setUserImage(userId: string, imageUrl: string, imageFileId: string): Promise<void> {
  const col = await usersCol()
  await col.updateOne({ id: userId }, { $set: { imageUrl, imageFileId, updatedAt: Date.now() } })
}

/** Soft-delete: keeps historical projects/build runs intact but removes the
 * account from login and strips PII (spec's account deletion flow). */
export async function softDeleteUser(userId: string): Promise<void> {
  const col = await usersCol()
  await col.updateOne(
    { id: userId },
    {
      $set: {
        deletedAt: Date.now(),
        email: `deleted_${userId}@deleted.mirrorsite.invalid`,
        name: "Deleted user",
        passwordHash: undefined,
        googleId: undefined,
        imageUrl: undefined,
      },
    },
  )
}

export { toPublicUser, STARTING_CREDITS }
export type { UserDoc }
