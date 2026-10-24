import { describe, expect, it, vi } from "vitest"
import {
  mergeDailySeries,
  projectNext30d,
  estimateArr,
  linearSlope,
  type DailyFinancePoint,
} from "./project-finances"
import { filterProjectPayments } from "./dodo-earnings"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/logging/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock("@/lib/db/runtime-collections", () => ({
  runtimeUsageCol: vi.fn(),
  ensureRuntimeIndexes: vi.fn(),
}))
vi.mock("@/lib/runtime/control/breakdown", () => ({
  breakdownByCapability: vi.fn(async () => []),
}))
vi.mock("@/lib/runtime/router/adapters/dodo/adapter", () => ({
  ATTRIBUTION_METADATA_KEYS: {
    projectId: "_ataiProjectId",
    apiKeyId: "_ataiApiKeyId",
    environment: "_ataiEnvironment",
  },
}))
vi.mock("@/lib/runtime/router/adapters/dodo/config", () => ({
  dodoHeaders: () => ({}),
  getDodoApiKey: () => "test-key",
  getDodoBaseUrl: () => "https://dodo.test/v1",
  getDodoTimeoutMs: () => 5000,
}))

function day(date: string, overrides: Partial<DailyFinancePoint> = {}): DailyFinancePoint {
  return {
    date,
    requests: 10,
    creditsCharged: 20,
    providerCostUsd: null,
    providerCostUnavailableCount: 0,
    earningsMinor: 0,
    paymentsCount: 0,
    ...overrides,
  }
}

describe("mergeDailySeries", () => {
  it("zero-fills payment-only days and attributes only succeeded amounts", () => {
    const merged = mergeDailySeries(
      [{ date: "2026-10-01", creditsCharged: 10, providerCostUsd: 0.5, providerCostUnavailableCount: 2, requests: 4 }],
      [
        {
          paymentId: "p1",
          amountMinor: 2990,
          currency: "USD",
          status: "succeeded",
          createdAt: Date.parse("2026-10-02T10:00:00Z"),
          subscriptionId: null,
          customerEmail: null,
          checkoutId: null,
        },
        {
          paymentId: "p2",
          amountMinor: 9999,
          currency: "USD",
          status: "processing",
          createdAt: Date.parse("2026-10-02T11:00:00Z"),
          subscriptionId: null,
          customerEmail: null,
          checkoutId: null,
        },
        {
          paymentId: "p3",
          amountMinor: 500,
          currency: "USD",
          status: "succeeded",
          createdAt: null,
          subscriptionId: null,
          customerEmail: null,
          checkoutId: null,
        },
      ],
    )
    expect(merged.map((d) => d.date)).toEqual(["2026-10-01", "2026-10-02"])
    expect(merged[0]).toMatchObject({ creditsCharged: 10, earningsMinor: 0, paymentsCount: 0 })
    // Only the succeeded payment contributes to earnings; pending does not.
    expect(merged[1]).toMatchObject({ earningsMinor: 2990, paymentsCount: 2 })
  })

  it("drops payments whose date cannot be day-bucketed", () => {
    const merged = mergeDailySeries([], [
      {
        paymentId: "p1",
        amountMinor: 1000,
        currency: "USD",
        status: "succeeded",
        createdAt: null,
        subscriptionId: null,
        customerEmail: null,
        checkoutId: null,
      },
    ])
    expect(merged).toEqual([])
  })

  it("keeps the series sorted by date", () => {
    const merged = mergeDailySeries(
      [
        { date: "2026-10-03", creditsCharged: 1, providerCostUsd: null, providerCostUnavailableCount: 1, requests: 1 },
        { date: "2026-10-01", creditsCharged: 1, providerCostUsd: null, providerCostUnavailableCount: 0, requests: 1 },
      ],
      [],
    )
    expect(merged.map((d) => d.date)).toEqual(["2026-10-01", "2026-10-03"])
  })
})

describe("linearSlope", () => {
  it("finds the exact slope of a linear series", () => {
    expect(linearSlope([3, 7], [9, 19])).toBeCloseTo(2.5)
    expect(linearSlope([0, 1, 2], [0, 2, 4])).toBeCloseTo(2)
  })
  it("returns 0 for degenerate input", () => {
    expect(linearSlope([1], [1])).toBe(0)
    expect(linearSlope([1, 1, 1], [2, 2, 2])).toBe(0)
  })
})

describe("projectNext30d", () => {
  it("declares insufficient data for short series", () => {
    const result = projectNext30d([day("2026-10-01"), day("2026-10-02"), day("2026-10-03")])
    expect(result.insufficientData).toBe(true)
    expect(result.projected30dCredits).toBeNull()
  })

  it("projects credits and earnings along the observed trend", () => {
    // Steady growth: 20 credits/day extra each day; 1000 minor earnings/day.
    const daily: DailyFinancePoint[] = []
    for (let i = 0; i < 10; i++) {
      daily.push(
        day(`2026-10-${String(i + 1).padStart(2, "0")}`, {
          creditsCharged: 100 + 20 * i,
          earningsMinor: 1000 + 1000 * i,
          paymentsCount: 1,
        }),
      )
    }
    const result = projectNext30d(daily)
    expect(result.insufficientData).toBe(false)
    expect(result.projected30dCredits).not.toBeNull()
    expect(result.projected30dEarningsMinor).not.toBeNull()
    // OLS fit: credits slope 20/day with intercept 100 — the fitted daily
    // rate over the next 30 days (x = 10…39) sums to 30·100 + 20·735 = 17,700.
    expect(result.projected30dCredits).toBe(17700)
    // Earnings slope 1,000/day with intercept 1,000 → 30·1,000 + 1,000·735 = 765,000.
    expect(result.projected30dEarningsMinor).toBe(765000)
  })

  it("never projects below zero", () => {
    const points = [
      day("2026-10-01", { creditsCharged: 1 }),
      day("2026-10-02", { creditsCharged: 0 }),
      day("2026-10-03", { creditsCharged: 0 }),
      day("2026-10-04", { creditsCharged: 0 }),
      day("2026-10-05", { creditsCharged: 0 }),
      day("2026-10-06", { creditsCharged: 0 }),
      day("2026-10-07", { creditsCharged: 0 }),
    ]
    const result = projectNext30d(points)
    expect(result.projected30dCredits).toBe(0)
  })

  it("reports no earnings projection when earnings were flat zero", () => {
    const points = Array.from({ length: 8 }, (_, i) =>
      day(`2026-10-0${i + 1}`, { paymentsCount: 0 }),
    )
    const result = projectNext30d(points)
    expect(result.insufficientData).toBe(false)
    expect(result.projected30dEarningsMinor).toBeNull()
  })
})

describe("estimateArr", () => {
  const payment = (overrides: Partial<Parameters<typeof estimateArr>[0][number]> = {}) => ({
    paymentId: `p_${-Math.random()}`,
    amountMinor: 1990,
    currency: "USD",
    status: "succeeded",
    createdAt: Date.now() - 1000,
    subscriptionId: "sub_1",
    customerEmail: null,
    checkoutId: null,
    ...overrides,
  })

  it("is empty without attributed subscriptions", () => {
    const result = estimateArr([
      payment({ subscriptionId: null }),
      payment({ status: "processing" }),
      payment({ createdAt: Date.now() - 40 * 24 * 60 * 60 * 1000 }),
    ])
    expect(result.mrrMinor).toBeNull()
    expect(result.recurringPaymentsObserved).toBe(0)
  })

  it("computes MRR, ARR and the labeled valuation", () => {
    const result = estimateArr([payment(), payment(), payment({ amountMinor: 990, subscriptionId: "sub_2" })])
    expect(result.mrrMinor).toBe(4970)
    expect(result.mrrCurrency).toBe("USD")
    expect(result.arrMinor).toBe(4970 * 12)
    expect(result.valuationMinor).toBe(Math.round(4970 * 12 * 2.5))
    expect(result.mixedCurrency).toBe(false)
  })

  it("flags mixed currencies and sums only the dominant one", () => {
    const result = estimateArr([
      payment({ currency: "USD" }),
      payment({ currency: "USD" }),
      payment({ currency: "EUR", amountMinor: 990 }),
    ])
    expect(result.mixedCurrency).toBe(true)
    expect(result.mrrMinor).toBe(3980)
    expect(result.mrrCurrency).toBe("USD")
    expect(result.basis).toContain("mixed currencies")
  })

  it("ignores failed and non-subscription payments even when recent", () => {
    const result = estimateArr([
      payment({ status: "failed" }),
      payment({ subscriptionId: null }),
    ])
    expect(result.mrrMinor).toBeNull()
  })
})

describe("filterProjectPayments (earnings attribution)", () => {
  it("keeps only payments stamped for THIS project", () => {
    const items = [
      { payment_id: "p1", metadata: { _ataiProjectId: "proj_a" }, total_amount: 2990 },
      { payment_id: "p2", metadata: { _ataiProjectId: "proj_b" }, total_amount: 1 },
      { payment_id: "p3", metadata: {}, total_amount: 1 },
      { no_id: true, metadata: { _ataiProjectId: "proj_a" } },
    ]
    const kept = filterProjectPayments(items, "proj_a")
    expect(kept.map((p) => p.paymentId)).toEqual(["p1"])
    expect(kept[0]?.amountMinor).toBe(2990)
    expect(kept[0]?.status).toBe("unknown")
  })

  it("passes through subscription and customer fields when present", () => {
    const kept = filterProjectPayments(
      [
        {
          payment_id: "p1",
          metadata: { _ataiProjectId: "proj_a" },
          total_amount: 1000,
          currency: "USD",
          status: "succeeded",
          created_at: "2026-10-10T00:00:00Z",
          subscription_id: "sub_9",
          customer: { email: "x@y.z" },
        },
      ],
      "proj_a",
    )
    expect(kept[0]?.subscriptionId).toBe("sub_9")
    expect(kept[0]?.customerEmail).toBe("x@y.z")
    expect(kept[0]?.createdAt).toBe(Date.parse("2026-10-10T00:00:00Z"))
  })
})
