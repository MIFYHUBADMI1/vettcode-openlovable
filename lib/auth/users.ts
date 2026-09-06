import { ObjectId } from "mongodb"
import { usersCol, ensureIndexes } from "@/lib/db/collections"
import type { UserDoc } from "@/lib/types/db"
import { cryptoId, store } from "@/lib/store/store"
import { grantCredits } from "@/lib/billing/credit-service"

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
    subscriptionCredits: 0,
    permanentCredits: 0,
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
  const userId = `user_${cryptoId()}`
  const doc: UserDoc = {
    _id: new ObjectId(),
    id: userId,
    email: normalizeEmail(params.email),
    name: params.name,
    authProvider: "google",
    googleId: params.googleId,
    emailVerified: true,
    imageUrl: params.imageUrl,
    credits: 0, // Credits granted via credit-service below
    subscriptionCredits: 0,
    permanentCredits: 0,
    createdAt: now,
    updatedAt: now,
  }
  await col.insertOne(doc)

  // Grant welcome credits via credit-service
  await grantCredits({
    userId,
    creditType: "permanent",
    amount: STARTING_CREDITS,
    transactionType: "signup_bonus",
    idempotencyKey: `signup_${userId}_google`,
    metadata: {
      reason: "Google signup — welcome credits",
      authProvider: "google",
    },
  })

  // Fetch updated user with new balance
  const updatedUser = await col.findOne({ id: userId })
  return updatedUser!
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
    // Google verified the email — mark it verified
    await col.updateOne(
      { id: userId },
      {
        $set: { googleId, imageUrl: imageUrl ?? undefined, emailVerified: true, updatedAt: Date.now() },
      },
    )
    // Grant welcome credits via credit-service
    await grantCredits({
      userId,
      creditType: "permanent",
      amount: STARTING_CREDITS,
      transactionType: "signup_bonus",
      idempotencyKey: `signup_${userId}_google_link`,
      metadata: {
        reason: "Google account linked — welcome credits",
        authProvider: "google",
      },
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
    await col.updateOne(
      { id: userId },
      { $set: { emailVerified: true, updatedAt: Date.now() } },
    )
    // Grant welcome credits via credit-service
    await grantCredits({
      userId,
      creditType: "permanent",
      amount: STARTING_CREDITS,
      transactionType: "signup_bonus",
      idempotencyKey: `signup_${userId}_email_verified`,
      metadata: {
        reason: "Email verified — welcome credits",
        authProvider: "password",
      },
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
