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

export interface UserOnboarding {
  source?: string
  role?: string
  signalType?: "url" | "idea"
  completedAt: number
}

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
  isAdmin?: boolean
  onboarding?: UserOnboarding
  suspended?: boolean
  suspendedAt?: number
  suspendedReason?: string
  banned?: boolean
  bannedAt?: number
  bannedReason?: string
  createdAt: number
  updatedAt: number
  lastLoginAt?: number
  deletedAt?: number
  /** Unique referral code for this user (e.g. MSA-X7K29P). Generated on first access. */
  referralCode?: string
  /** User ID of the person who referred this user (set once at registration). */
  referredBy?: string
}

// ─── Referral Document ─────────────────────────────────────────────────────

export type ReferralStatus =
  | "registered"
  | "verified"
  | "active"
  | "milestone_reached"
  | "blocked"

export interface ReferralDoc {
  _id: ObjectId
  id: string
  /** The user who referred (referrer). */
  referrerUserId: string
  /** The user who was referred. */
  referredUserId: string
  /** The referral code that was used. */
  referralCode: string
  /** Current status of this referral relationship. */
  status: ReferralStatus
  /** Whether the 500-credit verification reward has been issued. */
  verificationRewardIssued: boolean
  /** Whether the 1,500-credit usage milestone reward has been issued. */
  milestoneRewardIssued: boolean
  /** Cumulative eligible application-generation usage by the referred user (credits consumed on successful builds only). */
  eligibleUsage: number
  /** Risk/fraud flags for admin review. */
  fraudFlags?: string[]
  createdAt: number
  updatedAt: number
}

export interface SessionDoc {
  _id: ObjectId
  userId: string
  tokenHash: string
  userAgent?: string
  createdAt: number
  expiresAt: Date
}

export type VerificationPurpose = "email_verify" | "password_reset" | "email_change"

export interface VerificationTokenDoc {
  _id: ObjectId
  userId: string
  purpose: VerificationPurpose
  tokenHash: string
  metadata?: Record<string, unknown>
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

// ─── Top-Up Document ───────────────────────────────────────────────────────

export type TopUpStatus =
  | "pending"
  | "awaiting_payment"
  | "payment_submitted"
  | "analyzing"
  | "manual_review"
  | "approved"
  | "rejected"
  | "amount_mismatch"
  | "duplicate"
  | "expired"
  | "cancelled"

export type PaymentNetwork = "mtn" | "airtel"

export interface AIAnalysisResult {
  extractedAmount?: number | null
  extractedCurrency?: string | null
  extractedRecipientName?: string | null
  extractedRecipientPhone?: string | null
  extractedSenderName?: string | null
  extractedSenderPhone?: string | null
  extractedTransactionId?: string | null
  extractedPaymentReference?: string | null
  extractedDate?: string | null
  extractedTime?: string | null
  extractedNetwork?: string | null
  extractedTransactionFee?: string | null
  extractedBalance?: string | null
  otherVisibleInformation?: string | null
  confidence: number
  recommendation: "MATCH" | "REVIEW" | "MISMATCH"
  rawResponse?: string
}

export interface TopUpDoc {
  _id: ObjectId
  id: string
  userId: string
  packageId: string
  credits: number
  expectedAmount: number
  paymentReference: string
  payerPhone: string
  paymentNetwork: PaymentNetwork
  status: TopUpStatus
  evidenceFileIds: string[]
  evidenceHashes: string[]
  aiAnalysis?: AIAnalysisResult
  transactionIdUsed?: string
  verifiedAt?: number
  verifiedBy?: string
  rejectionReason?: string
  createdAt: number
  updatedAt: number
  expiresAt: number
}

// ─── Publish Event Document ──────────────────────────────────────────────────

export type PublishEventStatus = "started" | "success" | "failed"
export type PublishEventType = "subdomain" | "custom_domain"

export interface PublishEventDoc {
  _id: ObjectId
  id: string
  userId: string
  projectId: string
  projectName: string
  eventType: PublishEventType
  status: PublishEventStatus
  creditsCharged: number
  productionUrl?: string
  customDomain?: string
  error?: string
  durationMs?: number
  createdAt: number
}

// Re-exported for convenience so Mongo-aware modules can import model +
// persistence types from a single place.
export type { MirrorProject, BuildRun, CreditTransaction }
