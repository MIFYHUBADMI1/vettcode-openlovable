import type { ObjectId } from "mongodb"

// ─── Credit Packages ────────────────────────────────────────────────────────

export interface CreditPackage {
  id: string
  credits: number
  priceUGX: number
  label: string
  popular?: boolean
}

// ─── Top-Up Status Lifecycle ────────────────────────────────────────────────

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

// ─── Payment Network ────────────────────────────────────────────────────────

export type PaymentNetwork = "mtn" | "airtel"

// ─── Top-Up Document (MongoDB) ─────────────────────────────────────────────

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
  // Evidence
  evidenceFileIds: string[]
  evidenceHashes: string[]
  // AI Analysis
  aiAnalysis?: AIAnalysisResult
  // Verification
  verifiedAt?: number
  verifiedBy?: string // admin userId or "system"
  rejectionReason?: string
  // Metadata
  createdAt: number
  updatedAt: number
  expiresAt: number
}

// ─── AI Analysis Result ─────────────────────────────────────────────────────

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
  confidence: number // 0-100
  recommendation: "MATCH" | "REVIEW" | "MISMATCH"
  rawResponse?: string
}

// ─── Verification Result ────────────────────────────────────────────────────

export interface VerificationResult {
  approved: boolean
  status: TopUpStatus
  reasons: string[]
}

// ─── Top-Up API Request Types ───────────────────────────────────────────────

export interface CreateTopUpRequest {
  packageId: string
  paymentNetwork: PaymentNetwork
  payerPhone: string
}

export interface TopUpResponse {
  topUp: {
    id: string
    packageId: string
    credits: number
    expectedAmount: number
    paymentReference: string
    payerPhone: string
    paymentNetwork: PaymentNetwork
    status: TopUpStatus
    createdAt: number
    expiresAt: number
  }
}

// ─── User-facing credit history entry ──────────────────────────────────────

export interface CreditHistoryEntry {
  id: string
  type: string
  amount: number
  reason: string
  createdAt: number
}

// ─── Admin top-up view ─────────────────────────────────────────────────────

export interface AdminTopUpView {
  id: string
  userId: string
  userEmail?: string
  userName?: string
  packageId: string
  credits: number
  expectedAmount: number
  paymentReference: string
  payerPhone: string
  paymentNetwork: PaymentNetwork
  status: TopUpStatus
  evidenceFileIds: string[]
  aiAnalysis?: AIAnalysisResult
  verifiedAt?: number
  verifiedBy?: string
  rejectionReason?: string
  createdAt: number
  updatedAt: number
}
