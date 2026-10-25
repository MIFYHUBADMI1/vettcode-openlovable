import { requireAdmin } from "@/lib/auth/session"
import { ok, handleRouteError } from "@/lib/api/respond"
import {
  usersCol,
  creditLedgerCol,
  projectsCol,
  buildRunsCol,
  paymentRecordsCol,
  subscriptionRecordsCol,
} from "@/lib/db/collections"
import { CREDIT_BACK_REVERSAL_TRANSACTION_TYPES } from "@/lib/billing/reversal-types"
import {
  COLLECTED_STATUSES,
  MINOR_UNITS_PER_MAJOR,
  type MoneyFigure,
  type MoneyGroupRow,
  moneyFiguresFromGroups,
  moneyPipeline,
  splitCurrencyFigures,
} from "@/lib/finances/revenue-accounting"

export async function GET() {
  try {
    await requireAdmin()

    const [usersCol_, ledgerCol_, projectsCol_, buildRunsCol_, payCol_, subCol_] = await Promise.all([
      usersCol(),
      creditLedgerCol(),
      projectsCol(),
      buildRunsCol(),
      paymentRecordsCol(),
      subscriptionRecordsCol(),
    ])

    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000

    // Run all counts in parallel
    const [
      totalUsers,
      totalProjects,
      totalBuilds,
      successfulBuilds,
      failedBuilds,
    ] = await Promise.all([
      usersCol_.countDocuments({ deletedAt: { $exists: false } }),
      projectsCol_.countDocuments({}),
      buildRunsCol_.countDocuments({}),
      buildRunsCol_.countDocuments({ status: "succeeded" }),
      buildRunsCol_.countDocuments({ status: "failed" }),
    ])

    // ── Dodo money summary (Phase 3 — Workstream D) ──────────────────────────
    //
    // All of the accounting rules live in lib/finances/revenue-accounting.ts
    // (gross vs refunds vs net, minor→major conversion, currency separation,
    // and "missing amount is reported, never summed as zero"). Read that
    // module before changing anything here — the same predicates drive the
    // reconciliation service, so this report and its findings cannot disagree.
    async function moneyByCurrency(sinceMs?: number): Promise<MoneyGroupRow[]> {
      return payCol_.aggregate<MoneyGroupRow>(moneyPipeline(sinceMs)).toArray()
    }

    const [moneyAll, moneyToday, moneyWeek, moneyMonth] = await Promise.all([
      moneyByCurrency(),
      moneyByCurrency(oneDayAgo),
      moneyByCurrency(oneWeekAgo),
      moneyByCurrency(oneMonthAgo),
    ])
    const figsAll = moneyFiguresFromGroups(moneyAll)
    const figsToday = moneyFiguresFromGroups(moneyToday)
    const figsWeek = moneyFiguresFromGroups(moneyWeek)
    const figsMonth = moneyFiguresFromGroups(moneyMonth)
    const ZERO: MoneyFigure = {
      gross: 0, refunds: 0, net: 0, rows: 0, collectionRows: 0, refundRows: 0, unknownAmountRows: 0,
    }
    // USD is the headline; every other currency stays in its own row because
    // no approved FX conversion policy exists (brief §6 / §10).
    const { headline: usdAll, otherCurrencies: nonUsdByCurrency } = splitCurrencyFigures(figsAll)

    // ── Payment counts ──
    const [totalPayments, successfulPayments, failedPayments, refundEvents, awaitingConfirmation] = await Promise.all([
      payCol_.countDocuments({}),
      payCol_.countDocuments({ status: "succeeded", paymentType: { $ne: "refund" } }),
      payCol_.countDocuments({ status: "failed" }),
      // Confirmed refund EVENTS (their own rows) — not the original payments,
      // so a refund is counted exactly once.
      payCol_.countDocuments({ paymentType: "refund" }),
      // Records the provider has not settled yet (Workstream G).
      payCol_.countDocuments({ status: { $in: ["pending", "processing"] } }),
    ])

    // ── Subscription counts ──
    const [totalSubscriptions, activeSubscriptions, cancelledSubscriptions] = await Promise.all([
      subCol_.countDocuments({}),
      subCol_.countDocuments({ status: "active" }),
      subCol_.countDocuments({ status: "cancelled" }),
    ])

    // ── Credit statistics from ledger (use direction instead of amount sign) ──
    const [grantAgg, chargeAgg, refundAgg] = await Promise.all([
      ledgerCol_.aggregate([
        { $match: { direction: "credit" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).toArray(),
      ledgerCol_.aggregate([
        { $match: { direction: "debit" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).toArray(),
      // Credits handed BACK to users, whatever the reason (see
      // lib/billing/reversal-types). Phase 3 fixes, in order:
      //  1. the previous filter looked for a transactionType no code path ever
      //     writes ("refund"), so genuine clawbacks were invisible;
      //  2. only CREDIT-direction reversal rows count here. A `refund_reversal`
      //     is a DEBIT clawback (credits taken away after a Dodo refund) —
      //     summing it into "refunded" would invert the movement and net the
      //     same money twice. It is already represented in `totalCharged`.
      ledgerCol_.aggregate([
        { $match: { direction: "credit", transactionType: { $in: [...CREDIT_BACK_REVERSAL_TRANSACTION_TYPES] } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).toArray(),
    ])

    // Total credits held
    const creditAgg = await usersCol_.aggregate([
      { $match: { deletedAt: { $exists: false } } },
      { $group: { _id: null, total: { $sum: "$credits" } } },
    ]).toArray()

    // ── Subscription credit breakdown ──
    const [subCreditAgg, permCreditAgg] = await Promise.all([
      usersCol_.aggregate([
        { $match: { deletedAt: { $exists: false } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$subscriptionCredits", 0] } } } },
      ]).toArray(),
      usersCol_.aggregate([
        { $match: { deletedAt: { $exists: false } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$permanentCredits", 0] } } } },
      ]).toArray(),
    ])

    // ── Payment by product type (GROSS collections only, per currency, major
    // units — `totalRevenue` below means gross cash collected, not net and not
    // recognized revenue; refund rows are excluded by construction) ──
    const paymentTypeDistribution = await payCol_.aggregate([
      { $match: { paymentType: { $ne: "refund" }, status: { $in: [...COLLECTED_STATUSES] } } },
      {
        $group: {
          _id: { paymentType: { $ifNull: ["$paymentType", "unknown"] }, currency: { $toUpper: { $ifNull: ["$currency", "UNKNOWN"] } } },
          count: { $sum: 1 },
          totalRevenue: { $sum: { $ifNull: ["$amount", 0] } },
          unknownAmountRows: { $sum: { $cond: [{ $eq: ["$amount", null] }, 1, 0] } },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]).toArray()

    // ── Revenue by day (last 30 days, USD gross collections only — see the
    // currency rule in lib/finances/revenue-accounting.ts) ──
    const revenueByDay = await payCol_.aggregate([
      {
        $match: {
          createdAt: { $gte: oneMonthAgo },
          paymentType: { $ne: "refund" },
          status: { $in: [...COLLECTED_STATUSES] },
          currency: { $in: ["USD", "usd"] },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$createdAt" } } },
          count: { $sum: 1 },
          revenue: { $sum: { $ifNull: ["$amount", 0] } },
          credits: { $sum: { $ifNull: ["$creditsGranted", 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray()

    // ── Top users by credits ──
    const topUsers = await usersCol_.find({ deletedAt: { $exists: false } })
      .sort({ credits: -1 })
      .limit(10)
      .project({ id: 1, name: 1, email: 1, credits: 1, subscriptionCredits: 1, permanentCredits: 1 })
      .toArray()

    // ── Transaction type distribution from ledger ──
    const transactionTypes = await ledgerCol_.aggregate([
      { $group: { _id: "$transactionType", count: { $sum: 1 }, totalAmount: { $sum: "$amount" } } },
      { $sort: { count: -1 } },
    ]).toArray()

    // ── Build cost analysis from ledger ──
    const buildCosts = await ledgerCol_.aggregate([
      { $match: { transactionType: { $in: ["build_finalization", "build_reservation"] } } },
      { $group: { _id: "$metadata.reason", count: { $sum: 1 }, totalCredits: { $sum: "$amount" } } },
      { $sort: { totalCredits: -1 } },
      { $limit: 10 },
    ]).toArray()

    const overview = {
      summary: {
        totalUsers,
        totalProjects,
        totalBuilds,
        successfulBuilds,
        failedBuilds,
        buildSuccessRate: totalBuilds > 0 ? Math.round((successfulBuilds / totalBuilds) * 100) : 0,
      },
      credits: {
        totalHeld: creditAgg[0]?.total ?? 0,
        totalSubscriptionCredits: subCreditAgg[0]?.total ?? 0,
        totalPermanentCredits: permCreditAgg[0]?.total ?? 0,
        totalGranted: grantAgg[0]?.total ?? 0,
        totalCharged: chargeAgg[0]?.total ?? 0,
        totalRefunded: refundAgg[0]?.total ?? 0,
        netCredits: (grantAgg[0]?.total ?? 0) - (chargeAgg[0]?.total ?? 0),
      },
      revenue: {
        // MAJOR units (cents/100), USD only. See the basis note above:
        // `total` is GROSS cash collected; `refundsTotal` is confirmed Dodo
        // refunds; `netTotal` = gross − refunds. Not recognized revenue — no
        // revenue-recognition policy or provider-fee ledger exists here, and
        // profit/margin is explicitly out of scope.
        basis: "gross_usd_collections_minor_units_converted",
        currency: "USD",
        total: usdAll.gross,
        today: (figsToday.USD ?? ZERO).gross,
        thisWeek: (figsWeek.USD ?? ZERO).gross,
        thisMonth: (figsMonth.USD ?? ZERO).gross,
        refundsTotal: usdAll.refunds,
        netTotal: usdAll.net,
        netToday: (figsToday.USD ?? ZERO).net,
        netThisWeek: (figsWeek.USD ?? ZERO).net,
        netThisMonth: (figsMonth.USD ?? ZERO).net,
        // Collection rows the provider never gave an amount for — reported,
        // never summed as zero.
        unknownAmountRows: usdAll.unknownAmountRows,
        // Non-USD activity kept strictly separate (no FX policy exists).
        otherCurrencies: nonUsdByCurrency,
      },
      payments: {
        total: totalPayments,
        successful: successfulPayments,
        failed: failedPayments,
        refunded: refundEvents,
        awaitingConfirmation,
      },
      subscriptions: {
        total: totalSubscriptions,
        active: activeSubscriptions,
        cancelled: cancelledSubscriptions,
      },
      paymentTypeDistribution: paymentTypeDistribution.map((p) => ({
        type: (p._id as { paymentType: string }).paymentType ?? "unknown",
        currency: (p._id as { currency: string }).currency ?? "UNKNOWN",
        count: p.count,
        // Major units (converted from the provider's minor units); GROSS
        // collections in this paymentType/currency — refunds are excluded.
        totalRevenue: (p.totalRevenue ?? 0) / MINOR_UNITS_PER_MAJOR,
        unknownAmountRows: p.unknownAmountRows ?? 0,
      })),
      topUsers: topUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        credits: u.credits,
        subscriptionCredits: u.subscriptionCredits ?? 0,
        permanentCredits: u.permanentCredits ?? 0,
      })),
      revenueByDay: revenueByDay.map((d) => ({
        date: d._id,
        count: d.count,
        // Major units, USD gross collections only (see the currency rule).
        revenue: (d.revenue ?? 0) / MINOR_UNITS_PER_MAJOR,
        credits: d.credits,
      })),
      transactionTypes: transactionTypes.map((t) => ({
        type: t._id ?? "unknown",
        count: t.count,
        totalAmount: t.totalAmount,
      })),
      buildCosts: buildCosts.map((b) => ({
        reason: b._id ?? "unknown",
        count: b.count,
        totalCredits: b.totalCredits,
      })),
    }

    return ok(overview)
  } catch (e) {
    return handleRouteError("api.admin.billing.overview", e)
  }
}
