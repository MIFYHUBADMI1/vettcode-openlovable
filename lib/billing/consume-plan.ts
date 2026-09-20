/**
 * Pure oldest-first credit consumption planner.
 *
 * Used inside the Mongo transaction so concurrent consumeCredits calls
 * re-read the user and re-plan against the latest snapshot. The $gte
 * filter remains the overspend gate; this planner must not run on a
 * stale pre-transaction document.
 */

export interface ConsumePlanUser {
  credits?: number
  subscriptionCredits?: number
  permanentCredits?: number
  creditBuckets?: Array<{ subscriptionId: string; amount: number; expiresAt: number }>
}

export interface CreditConsumePlan {
  ok: true
  subConsumed: number
  permConsumed: number
  bucketDeductions: Array<{ subscriptionId: string; deduct: number; newAmount: number }>
  balance: { total: number; subscription: number; permanent: number }
}

export interface CreditConsumeDenied {
  ok: false
  available: number
}

export type CreditConsumeDecision = CreditConsumePlan | CreditConsumeDenied

export function balanceFromUser(user: ConsumePlanUser): {
  total: number
  subscription: number
  permanent: number
} {
  const subscription = user.subscriptionCredits ?? 0
  const permanent = user.permanentCredits ?? 0
  const newTotal = subscription + permanent
  const legacyCredits = user.credits ?? 0
  const total = newTotal > 0 ? newTotal : legacyCredits
  return { total, subscription, permanent }
}

export function planCreditConsumption(
  user: ConsumePlanUser,
  amount: number,
  now: number,
): CreditConsumeDecision {
  const balance = balanceFromUser(user)
  if (amount <= 0) {
    return {
      ok: true,
      subConsumed: 0,
      permConsumed: 0,
      bucketDeductions: [],
      balance,
    }
  }
  if (balance.total < amount) {
    return { ok: false, available: balance.total }
  }

  const rawBuckets = user.creditBuckets ?? []
  const nonExpiredBuckets = rawBuckets.filter((b) => b.expiresAt > now)
  const expiredBuckets = rawBuckets.filter((b) => b.expiresAt <= now)
  nonExpiredBuckets.sort((a, b) => a.expiresAt - b.expiresAt)
  expiredBuckets.sort((a, b) => a.expiresAt - b.expiresAt)
  const sortedBuckets = [...nonExpiredBuckets, ...expiredBuckets]

  let remaining = amount
  let subConsumed = 0
  let permConsumed = 0
  const bucketDeductions: Array<{ subscriptionId: string; deduct: number; newAmount: number }> = []

  for (const bucket of sortedBuckets) {
    if (remaining <= 0) break
    const toConsume = Math.min(remaining, bucket.amount)
    if (toConsume > 0) {
      subConsumed += toConsume
      remaining -= toConsume
      bucketDeductions.push({
        subscriptionId: bucket.subscriptionId,
        deduct: toConsume,
        newAmount: bucket.amount - toConsume,
      })
    }
  }

  if (remaining > 0 && balance.permanent > 0) {
    const toConsume = Math.min(remaining, balance.permanent)
    permConsumed += toConsume
    remaining -= toConsume
  }

  if (remaining > 0 && rawBuckets.length === 0 && balance.subscription > 0) {
    const toConsume = Math.min(remaining, balance.subscription)
    subConsumed += toConsume
    remaining -= toConsume
  }

  if (remaining > 0) {
    return { ok: false, available: balance.total - (amount - remaining) }
  }

  return { ok: true, subConsumed, permConsumed, bucketDeductions, balance }
}

/** Sequential application used to prove N concurrent plans cannot overspend. */
export function applyConsumePlan(
  user: ConsumePlanUser,
  plan: CreditConsumePlan,
): ConsumePlanUser {
  const credits = Math.max(0, (user.credits ?? 0) - (plan.subConsumed + plan.permConsumed))
  const subscriptionCredits = Math.max(0, (user.subscriptionCredits ?? 0) - plan.subConsumed)
  const permanentCredits = Math.max(0, (user.permanentCredits ?? 0) - plan.permConsumed)
  let buckets = [...(user.creditBuckets ?? [])]
  for (const d of plan.bucketDeductions) {
    buckets = buckets
      .map((b) =>
        b.subscriptionId === d.subscriptionId ? { ...b, amount: d.newAmount } : b,
      )
      .filter((b) => b.amount > 0)
  }
  return { credits, subscriptionCredits, permanentCredits, creditBuckets: buckets }
}
