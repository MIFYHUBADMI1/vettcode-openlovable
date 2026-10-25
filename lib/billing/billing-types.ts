/**
 * Atai — Billing System Types
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
  /**
   * First-class project attribution (Phase 1). Present whenever a trusted
   * server-side project context existed for the operation; absent for
   * account-level transactions (grants, purchases, expirations), which stay
   * fully valid without it. Historical entries pre-dating Phase 1 simply do
   * not carry the field — never fabricate it retroactively.
   */
  projectId?: string
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
  /**
   * Transaction amount as reported by Dodo. Absent when the provider did
   * not supply an authoritative amount (e.g. some payment.failed events) —
   * never fabricated as a confirmed zero.
   */
  amount?: number
  /** ISO payment currency recorded from the Dodo transaction; absent when unknown. */
  currency?: string
  status: PaymentStatus
  /** "subscription" | "permanent_credit_pack" | "one_time" */
  paymentType: string
  /** The product that was purchased */
  productId?: string
  productName?: string
  /** Atai Credits granted by this payment */
  creditsGranted?: number
  /** Credit type granted */
  creditType?: CreditType
  /** Associated subscription ID if subscription payment */
  subscriptionId?: string
  /** Package ID for permanent credit packs */
  packageId?: string
  /**
   * Phase 3 refund accounting: the ORIGINAL payment a refund row reverses
   * (set on `paymentType: "refund"` rows written from refund.succeeded).
   * Historical refund rows may predate the field — reconciliation treats a
   * missing link as "incomplete record", distinct from a confirmed error.
   */
  originalPaymentId?: string
  /** Refund identifier (Dodo refund_id) — mirrors dodoPaymentId on refund rows. */
  refundId?: string
  /**
   * Cumulative confirmed-refunded amount in the payment's ORIGINAL currency
   * minor units, maintained on the original payment row as refund rows land.
   * Absent = no refund recorded against this payment (never a fabricated 0).
   */
  refundedAmountMinor?: number
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

/** Every discrepancy type the reconciliation service can emit. */
export type ReconciliationIssueType =
  | "missing_credit_grant"
  | "duplicate_credit_grant"
  | "subscription_mismatch"
  | "renewal_mismatch"
  | "refund_without_reversal"
  | "ledger_balance_mismatch"
  | "payment_without_grant"
  | "grant_without_payment"
  | "duplicate_payment_records"
  | "refund_without_payment"
  | "reversal_without_refund"
  | "duplicate_refund_records"
  | "unexpected_ledger_entry"
  | "webhook_unresolved"
  | "webhook_failed_recovery"
  | "webhook_manual_review"
  | "payment_attribution_missing"
  | "subscription_period_mismatch"
  | "incomplete_record"

export interface ReconciliationIssue {
  id: string
  type: ReconciliationIssueType
  severity: "critical" | "warning" | "info"
  /** Review priority — maps from severity by default; operators re-rank manually. */
  priority?: number
  userId?: string
  referenceId?: string
  /** Related webhook / ledger / refund identifiers where the join is authoritative. */
  relatedIds?: string[]
  /** What the authoritative records say SHOULD be true. */
  expected?: string
  /** What was actually observed. */
  observed?: string
  description: string
  detectedAt: number
  /** "open" is the default for new findings; `resolved` kept for the
   * historical admin-route consumers. Findings are computed live — this field
   * is metadata for operator notes, never a trigger to rewrite records. */
  resolution?: "open" | "under_review" | "resolved" | "needs_business_decision"
  resolved?: boolean
  resolvedAt?: number
  resolvedBy?: string
}
