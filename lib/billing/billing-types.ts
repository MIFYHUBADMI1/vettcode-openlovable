/**
 * MirrorSite AI — Billing System Types
 *
 * Types for the unified billing system: credit ledger, build authorization,
 * payment records, subscription records, and reconciliation.
 *
 * @module lib/billing/billing-types
 */

import type { ObjectId } from "mongodb"
import type {
  CreditType,
  LedgerTransactionType,
  BuildAuthorizationStatus,
  PaymentStatus,
  SubscriptionStatus,
} from "./config"

// ─── Credit Ledger Entry ─────────────────────────────────────────────────────

export interface CreditLedgerEntry {
  _id?: ObjectId
  id: string
  userId: string
  creditType: CreditType
  amount: number
  direction: "credit" | "debit"
  transactionType: LedgerTransactionType
  referenceType?: string
  referenceId?: string
  balanceBefore: number
  balanceAfter: number
  idempotencyKey: string
  pricingModelVersion: string
  costModelVersion: string
  metadata?: Record<string, unknown>
  createdAt: number
}

// ─── Build Authorization ─────────────────────────────────────────────────────

export interface BuildAuthorization {
  _id?: ObjectId
  id: string
  userId: string
  projectId: string
  buildId: string
  complexity: "simple" | "medium" | "complex"
  creditCost: number
  baselineUnits: number
  pricingModelVersion: string
  costModelVersion: string
  availableSubscriptionCredits: number
  availablePermanentCredits: number
  reservationId?: string
  status: BuildAuthorizationStatus
  subscriptionCreditsUsed: number
  permanentCreditsUsed: number
  createdAt: number
  expiresAt: number
  finalizedAt?: number
}

// ─── Payment Record ──────────────────────────────────────────────────────────

export interface PaymentRecord {
  _id?: ObjectId
  id: string
  userId: string
  /** External payment ID from Dodo */
  dodoPaymentId: string
  /** Dodo customer ID */
  dodoCustomerId?: string
  amount: number
  currency: string
  status: PaymentStatus
  /** "subscription" | "permanent_credit_pack" | "one_time" */
  paymentType: string
  /** The product that was purchased */
  productId?: string
  productName?: string
  /** MirrorSite credits granted by this payment */
  creditsGranted?: number
  /** Credit type granted */
  creditType?: CreditType
  /** Associated subscription ID if subscription payment */
  subscriptionId?: string
  /** Package ID for permanent credit packs */
  packageId?: string
  metadata?: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

// ─── Subscription Record ─────────────────────────────────────────────────────

export interface SubscriptionRecord {
  _id?: ObjectId
  id: string
  userId: string
  /** External subscription ID from Dodo */
  dodoSubscriptionId: string
  dodoCustomerId?: string
  planId: string
  planName: string
  priceUSD: number
  mirrorCredits: number
  status: SubscriptionStatus
  /** Current billing period start */
  currentPeriodStart: number
  /** Current billing period end */
  currentPeriodEnd: number
  /** Next renewal date */
  nextBillingDate?: number
  /** Whether cancellation is scheduled at period end */
  cancelAtPeriodEnd: boolean
  /** When cancellation was requested */
  cancelledAt?: number
  /** When the subscription actually expired */
  expiredAt?: number
  metadata?: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

// ─── User Billing Profile (Extended) ─────────────────────────────────────────

export interface UserBillingProfile {
  /** Current total available credits */
  totalCredits: number
  /** Subscription credits available */
  subscriptionCredits: number
  /** Permanent credits available */
  permanentCredits: number
  /** Active subscription ID */
  activeSubscriptionId?: string
  /** Active plan ID */
  activePlanId?: string
}

// ─── Reconciliation Entry ────────────────────────────────────────────────────

export interface ReconciliationIssue {
  id: string
  type: "missing_credit_grant" | "duplicate_credit_grant" | "subscription_mismatch" | "renewal_mismatch" | "refund_without_reversal" | "ledger_balance_mismatch" | "payment_without_grant"
  severity: "critical" | "warning" | "info"
  userId?: string
  referenceId?: string
  description: string
  detectedAt: number
  resolved?: boolean
  resolvedAt?: number
  resolvedBy?: string
}
