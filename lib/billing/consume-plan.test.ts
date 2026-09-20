import { describe, it, expect } from "vitest"
import {
  planCreditConsumption,
  applyConsumePlan,
  balanceFromUser,
  type ConsumePlanUser,
} from "./consume-plan"

const now = 1_700_000_000_000

function user(overrides: ConsumePlanUser = {}): ConsumePlanUser {
  return {
    credits: 500,
    subscriptionCredits: 300,
    permanentCredits: 200,
    creditBuckets: [{ subscriptionId: "sub_1", amount: 300, expiresAt: now + 86_400_000 }],
    ...overrides,
  }
}

describe("planCreditConsumption", () => {
  it("denies when balance is below the operation price", () => {
    const decision = planCreditConsumption(user({ credits: 50, subscriptionCredits: 50, permanentCredits: 0 }), 200, now)
    expect(decision.ok).toBe(false)
  })

  it("exact-balance consume succeeds and leaves zero", () => {
    const start = user({ credits: 200, subscriptionCredits: 200, permanentCredits: 0 })
    const decision = planCreditConsumption(start, 200, now)
    expect(decision.ok).toBe(true)
    if (!decision.ok) return
    const next = applyConsumePlan(start, decision)
    expect(balanceFromUser(next).total).toBe(0)
  })

  it("zero amount is a no-op success", () => {
    const decision = planCreditConsumption(user(), 0, now)
    expect(decision).toMatchObject({ ok: true, subConsumed: 0, permConsumed: 0 })
  })

  it("sequential 200+200+200 against 500 cannot spend 600", () => {
    let state = user()
    const results: boolean[] = []
    for (let i = 0; i < 3; i++) {
      const plan = planCreditConsumption(state, 200, now)
      if (!plan.ok) {
        results.push(false)
        continue
      }
      state = applyConsumePlan(state, plan)
      results.push(true)
    }
    expect(results).toEqual([true, true, false])
    expect(balanceFromUser(state).total).toBe(100)
  })
})
