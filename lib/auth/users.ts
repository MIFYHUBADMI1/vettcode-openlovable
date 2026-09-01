import { ObjectId } from "mongodb"
import { usersCol, creditTransactionsCol, ensureIndexes } from "@/lib/db/collections"
import type { UserDoc } from "@/lib/types/db"
import { cryptoId, store } from "@/lib/store/store"

const STARTING_CREDITS = 500

export interface PublicUser {
  id: string
  email: string
  name: string
  authProvider: "password" | "google"
  emailVerified: boolean
  imageUrl?: string
  credits: number
  isAdmin?: boolean
  onboarding?: { source?: string; role?: string; signalType?: string; completedAt: number }
  suspended?: boolean
  banned?: boolean
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
    isAdmin: doc.isAdmin,
    onboarding: doc.onboarding,
    suspended: doc.suspended,
    banned: doc.banned,
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
    // Password users start with 0 credits — credits are granted on email
    // verification (see markEmailVerified). Google-auth users are pre-verified
    // by Google and receive STARTING_CREDITS immediately.
    credits: 0,
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
 * same email (spec's account-linking-by-email algorithm).
 *
 * Google already verified the email as part of OAuth, so we also mark it
 * verified and grant welcome credits if this is the first time. */
export async function linkGoogleToUser(userId: string, googleId: string, imageUrl?: string): Promise<void> {
  const col = await usersCol()
  const user = await col.findOne({ id: userId, deletedAt: { $exists: false } })
  const wasVerified = user?.emailVerified ?? false

  if (!wasVerified) {
    // Google verified the email — mark it and grant welcome credits in one go.
    await col.updateOne(
      { id: userId },
      {
        $set: { googleId, imageUrl: imageUrl ?? undefined, emailVerified: true, updatedAt: Date.now() },
        $inc: { credits: STARTING_CREDITS },
      },
    )
    const txCol = await creditTransactionsCol()
    await txCol.insertOne({
      _id: new ObjectId(),
      id: cryptoId(),
      userId,
      type: "grant",
      amount: STARTING_CREDITS,
      reason: "Google account linked — welcome credits",
      createdAt: Date.now(),
    })
  } else {
    await col.updateOne(
      { id: userId },
      { $set: { googleId, imageUrl: imageUrl ?? undefined, updatedAt: Date.now() } },
    )
  }
}

export async function markEmailVerified(userId: string): Promise<void> {
  const col = await usersCol()
  const user = await col.findOne({ id: userId, deletedAt: { $exists: false } })
  const wasVerified = user?.emailVerified ?? false

  if (!wasVerified) {
    // Grant starting credits on first email verification for password-auth users.
    // Google-auth users are pre-verified and already receive credits at creation.
    // We $inc credits directly on the user document rather than going through
    // store.addTransaction (which uses session transactions requiring a replica
    // set) so credit granting works on standalone MongoDB instances too.
    await col.updateOne(
      { id: userId },
      { $set: { emailVerified: true, updatedAt: Date.now() }, $inc: { credits: STARTING_CREDITS } },
    )
    const txCol = await creditTransactionsCol()
    await txCol.insertOne({
      _id: new ObjectId(),
      id: cryptoId(),
      userId,
      type: "grant",
      amount: STARTING_CREDITS,
      reason: "Email verified — welcome credits",
      createdAt: Date.now(),
    })
  } else {
    await col.updateOne({ id: userId }, { $set: { emailVerified: true, updatedAt: Date.now() } })
  }
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
