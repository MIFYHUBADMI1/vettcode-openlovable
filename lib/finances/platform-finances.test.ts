import { describe, expect, it, vi } from "vitest"
import type { EarningsResult, ProjectPayment } from "./dodo-earnings"
import {
  collapseExpenseRows,
  combineEarningsStatus,
  mergeRecentPayments,
  portfolioProjectRows,
  spendTrend,
  MAX_EARNINGS_PROJECTS,
  type ExpenseDayProjectRow,
  type PortfolioEntry,
} from "./platform-finances"

// Pure-contract suite: the DB/server-only concerns the module touches are
// mocked with the same stubs project-finances.test.ts uses — only the roll-up
// math and honesty rules are under test.
vi.mock("server-only", () => ({}))
vi.mock("@/lib/logging/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock("@/lib/db/runtime-collections", () => ({
  runtimeUsageCol: vi.fn(),
  ensureRuntimeIndexes: vi.fn(),
}))
vi.mock("@/lib/store/store", () => ({
  store: { listProjects: vi.fn(async () => []) },
}))
vi.mock("@/lib/runtime/router/adapters/dodo/config", () => ({
  dodoHeaders: () => ({}),
  getDodoApiKey: () => "test-key",
  getDodoBaseUrl: () => "https://dodo.test/v1",
  getDodoTimeoutMs: () => 5000,
}))
vi.mock("@/lib/runtime/router/adapters/dodo/adapter", () => ({
  ATTRIBUTION_METADATA_KEYS: {
    projectId: "_ataiProjectId",
    apiKeyId: "_ataiApiKeyId",
    environment: "_ataiEnvironment",
  },
}))

// Same pure-contract style as project-finances.test.ts: the roll-up math and
// honesty rules are the contract under test — DB-touching assembly is not.

function payment(over: Partial<ProjectPayment> = {}): ProjectPayment {
  return {
    paymentId: over.paymentId ?? `pay_${Math.random().toString(36).slice(2)}`,
    amountMinor: over.amountMinor ?? 1000,
    currency: over.currency ?? "USD",
    status: over.status ?? "succeeded",
    createdAt: over.createdAt ?? Date.now(),
    subscriptionId: over.subscriptionId ?? null,
    customerEmail: over.customerEmail ?? null,
    checkoutId: over.checkoutId ?? null,
  }
}

function okFeed(payments: ProjectPayment[]): EarningsResult {
  return { status: "ok", payments, fetchedAt: 1, pages: 1 }
}
function unavailableFeed(note = "missing DODO_PAYMENTS_API_KEY"): EarningsResult {
  return { status: "unavailable", payments: [], fetchedAt: null, note }
}
function errorFeed(note = "provider returned 500"): EarningsResult {
  return { status: "error", payments: [], fetchedAt: null, note }
}

function expenseRow(over: Partial<ExpenseDayProjectRow> = {}): ExpenseDayProjectRow {
  return {
    date: over.date ?? "2026-10-01",
    projectId: over.projectId ?? "p1",
    requests: over.requests ?? 10,
    succeeded: over.succeeded ?? 9,
    failed: over.failed ?? 1,
    creditsCharged: over.creditsCharged ?? 40,
    providerCostUsd: over.providerCostUsd ?? 0.5,
    providerCostUnavailableCount: over.providerCostUnavailableCount ?? 2,
  }
}

function entry(over: Partial<PortfolioEntry> = {}): PortfolioEntry {
  return {
    projectId: over.projectId ?? "p1",
    projectName: over.projectName ?? "Project One",
    expense:
      over.expense ??
      { requests: 10, creditsCharged: 40, providerCostUsd: 0.5, providerCostUnavailableCount: 2 },
    earnings: over.earnings ?? okFeed([]),
  }
}

describe("collapseExpenseRows — day + project roll-up of the shared aggregation", () => {
  it("sums per-day rows to day totals that match the sum of rows", () => {
    const out = collapseExpenseRows([
      expenseRow({ date: "2026-10-01", projectId: "p1", requests: 10, creditsCharged: 40, providerCostUsd: 1 }),
      expenseRow({ date: "2026-10-01", projectId: "p2", requests: 5, creditsCharged: 10, providerCostUsd: 0.25 }),
      expenseRow({ date: "2026-10-02", projectId: "p1", requests: 3, creditsCharged: 6, providerCostUsd: 0.5 }),
    ])
    expect(out.daily).toHaveLength(2)
    expect(out.daily[0]).toMatchObject({ date: "2026-10-01", requests: 15, succeeded: 18, creditsCharged: 50 })
    expect(out.daily[0].providerCostUsd).toBeCloseTo(1.25)
    expect(out.totals.requests).toBe(18)
    expect(out.totals.creditsCharged).toBe(56)
    // checkoutAttempts is deliberately untracked at portfolio level.
    expect(out.totals.checkoutAttempts).toBe(0)
  })

  it("keeps per-project expense sums keyed by project and sorts days ascending", () => {
    const out = collapseExpenseRows([
      expenseRow({ date: "2026-10-02", projectId: "p1", requests: 3, creditsCharged: 6 }),
      expenseRow({ date: "2026-10-01", projectId: "p2", requests: 10, creditsCharged: 40 }),
      expenseRow({ date: "2026-10-01", projectId: "p1", requests: 10, creditsCharged: 40 }),
    ])
    expect(out.daily.map((d) => d.date)).toEqual(["2026-10-01", "2026-10-02"])
    expect(out.byProject.get("p1")).toMatchObject({ requests: 13, creditsCharged: 46 })
    expect(out.byProject.get("p2")).toMatchObject({ requests: 10, creditsCharged: 40 })
  })

  it("collapses empty input to honest zero totals with no projects", () => {
    const out = collapseExpenseRows([])
    expect(out.daily).toEqual([])
    expect(out.totals).toMatchObject({ requests: 0, creditsCharged: 0, checkoutAttempts: 0 })
    expect(out.byProject.size).toBe(0)
  })

  it("carries provider-cost unavailability without rewriting it to zero", () => {
    const out = collapseExpenseRows([
      expenseRow({ providerCostUnavailableCount: 10, providerCostUsd: 0 }),
      expenseRow({ requests: 4, providerCostUnavailableCount: 4, providerCostUsd: 0 }),
    ])
    expect(out.totals.providerCostUnavailableCount).toBe(14)
    expect(out.totals.providerCostUsd).toBe(0)
  })
})

describe("combineEarningsStatus — honest combination of the same feed state", () => {
  it("any ok wins — regardless of other unavailable/error feeds", () => {
    expect(combineEarningsStatus([{ status: "ok" }, { status: "unavailable" }, { status: "error" }])).toEqual({
      status: "ok",
      note: null,
    })
  })

  it("no ok + any error → error, carrying its note", () => {
    const out = combineEarningsStatus([{ status: "unavailable" }, errorFeed()])
    expect(out.status).toBe("error")
    expect(out.note).toContain("500")
  })

  it("all unavailable → unavailable with the shared setup note", () => {
    const out = combineEarningsStatus([
      { status: "unavailable", note: "missing key" },
      { status: "unavailable", note: "missing key" },
    ])
    expect(out).toEqual({ status: "unavailable", note: "missing key" })
  })

  it("no entries → unavailable with no note (zero projects swept)", () => {
    expect(combineEarningsStatus([])).toEqual({ status: "unavailable", note: null })
  })
})

describe("portfolioProjectRows — one honest row per project", () => {
  it("sums only succeeded amounts and reports earnings null when unavailable", () => {
    const rows = portfolioProjectRows([
      entry({ projectId: "p1", earnings: okFeed([
        payment({ amountMinor: 1000, status: "succeeded" }),
        payment({ amountMinor: 500, status: "pending" }),
        payment({ amountMinor: 999, status: "failed" }),
      ]) }),
      entry({ projectId: "p2", earnings: unavailableFeed() }),
    ])
    const p1 = rows.find((r) => r.projectId === "p1")
    expect(p1?.earningsMinor).toBe(1000)
    expect(p1?.succeededPayments).toBe(1)
    const p2 = rows.find((r) => r.projectId === "p2")
    // Unavailable ≠ 0: the row honestly reports the feed state.
    expect(p2?.earningsMinor).toBeNull()
    expect(rows.length).toBe(2)
  })

  it("sorts rows by credit spend, descending", () => {
    const rows = portfolioProjectRows([
      entry({ projectId: "small", expense: { requests: 1, creditsCharged: 1, providerCostUsd: 0, providerCostUnavailableCount: 0 } }),
      entry({ projectId: "big", expense: { requests: 9, creditsCharged: 90, providerCostUsd: 0, providerCostUnavailableCount: 0 } }),
    ])
    expect(rows.map((r) => r.projectId)).toEqual(["big", "small"])
  })

  it("provider cost stays null when every call missed its numeric cost", () => {
    const rows = portfolioProjectRows([
      entry({ expense: { requests: 4, creditsCharged: 12, providerCostUsd: 0, providerCostUnavailableCount: 4 } }),
    ])
    expect(rows[0]?.providerCostUsd).toBeNull()
    const rich = portfolioProjectRows([
      entry({ expense: { requests: 4, creditsCharged: 12, providerCostUsd: 1.5, providerCostUnavailableCount: 4 } }),
    ])
    expect(rich[0]?.providerCostUsd).toBeCloseTo(1.5)
  })

  it("picks the first sorted currency and the newest payment date", () => {
    const t = Date.parse("2026-10-01T00:00:00Z")
    const rows = portfolioProjectRows([
      entry({
        earnings: okFeed([
          payment({ amountMinor: 200, status: "succeeded", createdAt: t, currency: "USD" }),
          payment({ amountMinor: 300, status: "succeeded", createdAt: t + 50_000, currency: "EUR" }),
        ]),
      }),
    ])
    expect(rows[0]?.currency).toBe("EUR")
    expect(rows[0]?.lastPaymentAt).toBe(t + 50_000)
  })
})

describe("mergeRecentPayments — cross-project payments, newest first, tagged", () => {
  const t = Date.parse("2026-10-01T00:00:00Z")

  it("tags each payment with its project and sorts newest first, limiting", () => {
    const rows = mergeRecentPayments(
      [
        entry({ projectId: "p1", projectName: "One", earnings: okFeed([payment({ paymentId: "p1pay", createdAt: t })]) }),
        entry({ projectId: "p2", projectName: "Two", earnings: okFeed([payment({ paymentId: "p2pay", createdAt: t + 100_000 })]) }),
        entry({ projectId: "p3", projectName: "Three", earnings: errorFeed() }),
      ],
      2,
    )
    expect(rows.map((r) => r.paymentId)).toEqual(["p2pay", "p1pay"])
    expect(rows[0]).toMatchObject({ projectId: "p2", projectName: "Two" })
  })

  it("payments without a parseable date never claim recency", () => {
    const rows = mergeRecentPayments([
      entry({ earnings: okFeed([payment({ paymentId: "dated", createdAt: t }), payment({ paymentId: "undated", createdAt: null })]) }),
    ])
    expect(rows.map((r) => r.paymentId)).toEqual(["undated", "dated"])
  })
})

describe("MAX_EARNINGS_PROJECTS — the documented sweep bound", () => {
  it("caps the per-load earnings sweep at a bounded 25 projects", () => {
    expect(MAX_EARNINGS_PROJECTS).toBe(25)
  })
})

describe("spendTrend — the dashboard mini-card's honest direction", () => {
  const day = (creditsCharged: number) => ({ date: "", creditsCharged })

  it("compares the last 14 days against the prior 14", () => {
    const out = spendTrend([...Array(14).fill(day(10)), ...Array(14).fill(day(20))])
    expect(out).toEqual({ creditsTotal14d: 280, creditsPrior14d: 140, changePct: 100 })
  })

  it("rejects a percentage when the prior window saw zero spend", () => {
    const out = spendTrend([...Array(14).fill(day(0)), ...Array(14).fill(day(5))])
    expect(out.creditsPrior14d).toBe(0)
    expect(out.creditsTotal14d).toBe(70)
    expect(out.changePct).toBeNull()
  })

  it("no spend at all stays zero with no fabricated percentage", () => {
    expect(spendTrend(Array(28).fill(day(0)))).toEqual({
      creditsTotal14d: 0,
      creditsPrior14d: 0,
      changePct: null,
    })
  })

  it("short series never goes negative-index (slice floors at the start)", () => {
    const out = spendTrend([day(5), day(10), day(15)])
    expect(out).toEqual({ creditsTotal14d: 30, creditsPrior14d: 0, changePct: null })
  })
})
