/**
 * MongoDB document shapes for every persisted collection (spec sections 3–9,
 * 20). These mirror the existing in-app model types (`MirrorProject`,
 * `BuildRun`, `CreditTransaction`) plus everything net-new for this phase:
 * users, sessions, verification/reset tokens, rate-limit buckets, provider
 * usage, and project assets.
 */
import type { ObjectId } from "mongodb"
import type { MirrorProject, BuildRun, CreditTransaction } from "@/lib/types/project"

export type AuthProvider = "password" | "google"

export interface UserDoc {
  _id: ObjectId
  id: string // string mirror of _id for callers that expect a string id
  email: string
  name: string
  passwordHash?: string
  authProvider: AuthProvider
  googleId?: string
  emailVerified: boolean
  imageUrl?: string
  imageFileId?: string
  credits: number
  createdAt: number
  updatedAt: number
  lastLoginAt?: number
  deletedAt?: number
}

export interface SessionDoc {
  _id: ObjectId
  userId: string
  tokenHash: string
  userAgent?: string
  createdAt: number
  expiresAt: Date
}

export type VerificationPurpose = "email_verify" | "password_reset"

export interface VerificationTokenDoc {
  _id: ObjectId
  userId: string
  purpose: VerificationPurpose
  tokenHash: string
  createdAt: number
  expiresAt: Date
  usedAt?: number
}

export interface RateLimitDoc {
  _id: ObjectId
  key: string // `${action}:${identifier}`
  count: number
  windowStart: number
  expiresAt: Date
}

export interface ProjectAssetDoc {
  _id: ObjectId
  id: string
  userId: string
  projectId?: string
  kind: "avatar" | "screenshot" | "asset" | "upload"
  fileId: string
  filePath: string
  fileName: string
  url: string
  mimeType: string
  size: number
  width?: number
  height?: number
  createdAt: number
}

export interface ProviderUsageDoc {
  _id: ObjectId
  id: string
  provider: "firecrawl" | "totalum" | "imagekit" | "email"
  operation: string
  userId?: string
  projectId?: string
  succeeded: boolean
  costEstimate?: number
  metadata?: Record<string, unknown>
  createdAt: number
}

// Re-exported for convenience so Mongo-aware modules can import model +
// persistence types from a single place.
export type { MirrorProject, BuildRun, CreditTransaction }
