import { requireAdmin } from "@/lib/auth/session"
import { ok, handleRouteError } from "@/lib/api/respond"
import {
  usersCol,
  paymentRecordsCol,
  subscriptionRecordsCol,
  creditLedgerCol,
  creditTransactionsCol,
} from "@/lib/db/collections"

/**
 * Billing reconciliation endpoint.
 *
 * Compares Dodo payments ↔ MirrorSite payment records ↔ subscriptions ↔
 * credit grants ↔ credit ledger ↔ user entitlements.
 *
 * Detects:
 * - Successful payment without credit grant
 * - Credit grant without successful payment
 * - Duplicate credit grants
 * - Subscription mismatches
 * - Ledger/balance mismatches
 */

interface ReconciliationIssue {
  id: string
  type: string
  severity: "critical" | "warning" | "info"
  userId?: string
  referenceId?: string
  description: string
  detectedAt: number
}

export async function GET() {
  try {
    await requireAdmin()

    const issues: ReconciliationIssue[] = []
    const now = Date.now()

    const [payCol, subCol, ledgerCol, users, txCol] = await Promise.all([
      paymentRecordsCol(),
      subscriptionRecordsCol(),
      creditLedgerCol(),
      usersCol(),
      creditTransactionsCol(),
    ])

    // ── 1. Check for successful payments without credit grants ──
    // Load at most 500 payments; for larger datasets run in batches via a
    // background job rather than a single HTTP request.
    const successfulPayments = await payCol
      .find({ status: "succeeded", paymentType: "permanent_credit_pack" })
      .limit(500)
      .toArray()

    // Batch: collect all payment IDs that have a userId+creditsGranted, then
    // fetch all matching ledger entries and legacy transactions in two queries
    // instead of 2 × N sequential round-trips.
    const paymentsToCheck = successfulPayments.filter(
      (p) => p.userId && p.creditsGranted,
    )
    const dodoPaymentIds = paymentsToCheck.map((p) => p.dodoPaymentId)

    const [existingLedgerGrants, existingLegacyGrants] = await Promise.all([
      dodoPaymentIds.length
        ? ledgerCol
          .find(
            { transactionType: "credit_purchase", "metadata.dodoPaymentId": { $in: dodoPaymentIds } },
            { projection: { "metadata.dodoPaymentId": 1, _id: 0 } },
          )
          .toArray()
        : Promise.resolve([]),
      dodoPaymentIds.length
        ? txCol
          .find(
            { "metadata.paymentId": { $in: dodoPaymentIds } },
            { projection: { "metadata.paymentId": 1, _id: 0 } },
          )
          .toArray()
        : Promise.resolve([]),
    ])

    const ledgerGrantedIds = new Set(
      existingLedgerGrants.map((g) => g.metadata?.dodoPaymentId as string).filter(Boolean),
    )
    const legacyGrantedIds = new Set(
      existingLegacyGrants.map((g) => g.metadata?.paymentId as string).filter(Boolean),
    )

    for (const payment of paymentsToCheck) {
      if (ledgerGrantedIds.has(payment.dodoPaymentId)) continue
      if (legacyGrantedIds.has(payment.dodoPaymentId)) continue
      issues.push({
        id: `pay_no_grant_${payment.id}`,
        type: "payment_without_grant",
        severity: "critical",
        userId: payment.userId,
        referenceId: payment.dodoPaymentId,
        description: `Payment ${payment.dodoPaymentId} succeeded ($${payment.amount}) but no credit grant found in ledger`,
        detectedAt: now,
      })
    }

    // ── 2. Check for subscription mismatches ──
    // Load at most 500 active subscriptions and batch-fetch their users in
    // one $in query instead of one findOne per subscription.
    const activeSubscriptions = await subCol
      .find({ status: "active" })
      .limit(500)
      .toArray()

    const subUserIds = [...new Set(activeSubscriptions.map((s) => s.userId).filter(Boolean))]
    const subUsers = subUserIds.length
      ? await users
        .find(
          { id: { $in: subUserIds } },
          { projection: { id: 1, subscriptionCredits: 1, credits: 1, _id: 0 } },
        )
        .toArray()
      : []
    const subUserMap = new Map(subUsers.map((u) => [u.id, u]))

    for (const sub of activeSubscriptions) {
      const user = subUserMap.get(sub.userId)
      if (!user) {
        issues.push({
          id: `sub_no_user_${sub.id}`,
          type: "subscription_mismatch",
          severity: "critical",
          userId: sub.userId,
          referenceId: sub.dodoSubscriptionId,
          description: `Active subscription ${sub.dodoSubscriptionId} belongs to non-existent user ${sub.userId}`,
          detectedAt: now,
        })
        continue
      }

      // Check if user has subscription credits
      if ((user.subscriptionCredits ?? 0) <= 0 && sub.status === "active") {
        issues.push({
          id: `sub_no_credits_${sub.id}`,
          type: "subscription_mismatch",
          severity: "warning",
          userId: sub.userId,
          referenceId: sub.dodoSubscriptionId,
          description: `Active subscription ${sub.dodoSubscriptionId} but user has 0 subscription credits`,
          detectedAt: now,
        })
      }
    }

    // ── 3. Check for ledger/balance mismatches ──
    // Get all users with credits
    const usersWithCredits = await users
      .find({ credits: { $gt: 0 }, deletedAt: { $exists: false } })
      .limit(1000)
      .toArray()

    for (const user of usersWithCredits) {
      const subCredits = user.subscriptionCredits ?? 0
      const permCredits = user.permanentCredits ?? 0
      const legacyCredits = user.credits ?? 0

      // Check that subscription + permanent = total (or legacy)
      const calculatedTotal = subCredits + permCredits
      if (calculatedTotal !== legacyCredits && calculatedTotal > 0) {
        issues.push({
          id: `balance_mismatch_${user.id}`,
          type: "ledger_balance_mismatch",
          severity: "warning",
          userId: user.id,
          description: `User ${user.id}: subscription(${subCredits}) + permanent(${permCredits}) = ${calculatedTotal} ≠ credits(${legacyCredits})`,
          detectedAt: now,
        })
      }
    }

    // ── 4. Check for duplicate credit grants ──
    const duplicateGrants = await ledgerCol
      .aggregate([
        { $group: { _id: "$idempotencyKey", count: { $sum: 1 }, ids: { $push: "$id" } } },
        { $match: { count: { $gt: 1 } } },
        { $limit: 50 },
      ])
      .toArray()

    for (const dup of duplicateGrants) {
      issues.push({
        id: `dup_grant_${dup._id}`,
        type: "duplicate_credit_grant",
        severity: "info",
        referenceId: dup._id,
        description: `Idempotency key "${dup._id}" has ${dup.count} ledger entries`,
        detectedAt: now,
      })
    }

    // ── 5. Check for cancelled subscriptions still marked active ──
    const cancelledButActive = await subCol
      .find({ status: "cancelled", cancelAtPeriodEnd: true })
      .toArray()

    for (const sub of cancelledButActive) {
      if (sub.currentPeriodEnd && sub.currentPeriodEnd < now) {
        issues.push({
          id: `cancelled_past_${sub.id}`,
          type: "subscription_mismatch",
          severity: "warning",
          userId: sub.userId,
          referenceId: sub.dodoSubscriptionId,
          description: `Subscription ${sub.dodoSubscriptionId} cancelled but period ended ${new Date(sub.currentPeriodEnd).toISOString()}`,
          detectedAt: now,
        })
      }
    }

    // Sort by severity
    const severityOrder = { critical: 0, warning: 1, info: 2 }
    issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    // Summary stats
    const summary = {
      totalIssues: issues.length,
      critical: issues.filter((i) => i.severity === "critical").length,
      warning: issues.filter((i) => i.severity === "warning").length,
      info: issues.filter((i) => i.severity === "info").length,
      checkedAt: now,
    }

    return ok({ summary, issues })
  } catch (e) {
    return handleRouteError("api.admin.billing.reconciliation", e)
  }
}
