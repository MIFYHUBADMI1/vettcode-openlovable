# 💳 Credit System

**Complete reference for how credits work, flow, and are charged**

---

## Overview

Atai bills users in **credits** — an internal currency. Users buy credits (or get them free/via subscription), then spend them on operations. This is intentional:

- Decouples pricing from API costs (we can adjust without changing user-facing prices)
- Allows flexible pricing tiers
- Enables subscriptions + one-time purchases together
- Common pattern in SaaS tools (like OpenAI tokens)

**Main file**: `lib/credits/credits.ts`  
**DB collection**: `credit_ledger` (every transaction recorded)  
**User balance**: Stored in `users.credits` (fast read) + `users.creditBuckets` (detailed)

---

## Credit Costs (Current)

### Analysis Operations

| Operation | Mode | Cost |
|-----------|------|------|
| Website Scrape (Smart Crawl) | Legacy | **5 credits** |
| Website Scrape (Smart Crawl) | Heavy | **100 credits** |
| Plan Generation | Legacy | **5 credits** |
| Plan Generation | Heavy | **100 credits** |
| Deep Crawl (full site) | Legacy | **500 credits** |
| Deep Crawl (full site) | Heavy | **1,000 credits** |

**So for a full deep crawl + plan in heavy mode**:
- Deep crawl: 1,000 credits
- (Plan is included in heavy mode cost)
- Total: **1,000 credits**

**For smart crawl (legacy)**:
- Scrape: 5 credits
- Plan: 5 credits
- Total: **10 credits**

### Build Operations (Tier-Based)

After analysis, building the actual code costs more and depends on complexity:

| Complexity | Legacy Build | Heavy Build |
|-----------|-------------|-------------|
| Simple    | 25,000 cr   | 50,000 cr   |
| Medium    | 50,000 cr   | 75,000 cr   |
| Complex   | 75,000 cr   | 100,000 cr  |

**Complexity is auto-classified** by the system based on:
- Number of enabled features (×2 weight each)
- Number of data entities (×1 weight each)
- Number of integrations (×3 weight each — hardest to build)
- Number of core user flows (×1 each)
- Number of backend requirements (×1 each)

Score ≤ 6 = simple, ≤ 14 = medium, > 14 = complex

---

## Credit Types

### 1. Subscription Credits
- Granted monthly with a paid subscription plan
- **Expire at the end of the billing period**
- Consumed first (before permanent credits)

### 2. Permanent Credits
- Purchased as credit packs (one-time payment)
- **Never expire**
- Consumed after subscription credits are exhausted

### Consumption Order
```
User has:
  - 500 subscription credits (expire Jan 31)
  - 2,000 permanent credits (never expire)

User spends 300 credits:
  → 300 taken from subscription credits first
  → Subscription: 200 remaining
  → Permanent: 2,000 (untouched)

User spends 400 more credits:
  → 200 taken from subscription credits (now empty)
  → 200 taken from permanent credits
  → Subscription: 0
  → Permanent: 1,800 remaining
```

This is "oldest-first" or "use-it-or-lose-it" — subscription credits drain first so users don't waste their monthly allocation.

---

## The Credit Flow Pattern

Every operation that costs credits follows this exact pattern:

```
1. RESERVE  → Deduct credits atomically BEFORE the operation starts
2. EXECUTE  → Run the actual operation (crawl, AI call, etc.)
3. CHARGE   → Confirm the charge (already deducted in step 1)
   OR
   REFUND   → Return credits if operation failed
```

### Why Reserve First?

If you check the balance and then deduct, two concurrent requests can both pass the balance check with the same balance and both succeed — even if the user only has enough for one. This is a **race condition**.

The reservation is **atomic** — it checks AND deducts in a single database operation. Only one can succeed if credits are tight.

```typescript
// From credits.ts
export async function reserveCredits(
  userId: string, 
  amount: number, 
  buildRunId: string, 
  reason: string
): Promise<boolean> {
  // Single atomic DB operation — no race condition possible
  const reserved = await store.reserveCreditsAtomic(userId, amount, {
    id: cryptoId(),
    userId,
    type: "reserve",
    amount: -amount,
    reason,
    buildRunId,
    createdAt: Date.now(),
  })
  if (!reserved) return false  // Not enough credits
  return true
}
```

### Reconciliation

For operations where actual cost might differ from estimated (like AI token usage), there's a reconcile function:

```typescript
// If actual cost < reserved → refund the difference
// If actual cost > reserved → charge the extra
await reconcileCredits(userId, reserved, actual, buildRunId)
```

---

## Credit Transaction Types

Every credit movement is recorded in `credit_ledger` with one of these types:

| Type | Meaning |
|------|---------|
| `grant` | Credits added (signup bonus, subscription renewal, admin gift) |
| `reserve` | Credits held before an operation (temporary hold) |
| `consume` | Credits charged for a completed operation |
| `refund` | Credits returned (operation failed, or partial refund) |

---

## Admin Credit Operations

Admins can:
- **Grant credits** to any user (free credits, compensation, etc.)
- **Deduct credits** from any user (abuse, correction)
- **View credit history** for any user
- **View full ledger** across all users

**Admin panel**: `/admin/billing` and `/admin/ledger`

---

## Subscription Plans (Current Pricing)

Configured in Stripe, reflected here for reference:

| Plan | Price | Monthly Credits | Features |
|------|-------|-----------------|---------|
| Free | $0 | 100 (one-time signup) | Basic access |
| Starter | $29/mo | 1,000 | Email support |
| Pro | $79/mo | 3,000 | Priority support, custom domains |
| Business | $199/mo | 10,000 | Teams, white label |
| Enterprise | Custom | Custom | SLA, SSO, dedicated support |

**Credits renew monthly.** Unused subscription credits expire at period end. Permanent credits never expire.

---

## Credit Packs (One-Time Purchase)

| Pack | Price | Credits | Per Credit |
|------|-------|---------|-----------|
| Starter Pack | $10 | 500 | $0.02 |
| Value Pack | $35 | 2,000 | $0.0175 |
| Pro Pack | $80 | 5,000 | $0.016 |
| Power Pack | $150 | 10,000 | $0.015 |

Larger packs = better rate. All credits are permanent (never expire).

---

## Free Credits

- **Signup bonus**: 100 credits (every new user)
- **Referral**: Referrer gets bonus credits when referred user signs up and pays
- **Admin gift**: Admin can manually grant credits

---

## Checking Balance

### In Code
```typescript
// Get current balance
const balance = await getBalance(userId)

// Check before operation
const canAfford = await hasSufficientCredits(userId, 500)
if (!canAfford) {
  // Show "insufficient credits" error to user
}
```

### In Admin Panel
- Go to `/admin/users`
- Click any user
- See credit balance + full ledger history

---

## Idempotency

Every ledger entry has an `idempotencyKey` that prevents double-charging.

If a charge operation is retried (due to network error, server crash), the idempotency key ensures the credit is only deducted once.

**Format**: `{operation}:{entityId}` (e.g., `"project:proj_abc123:crawl"`)

This is production-critical. Without it, a server crash mid-operation could result in credits being charged twice.

---

## Common Credit Issues

### "Not enough credits" error but user has credits
**Cause**: Race condition OR subscription credits expired  
**Fix**: Check `users.creditBuckets` — look for expired buckets  
**Admin fix**: Grant credits manually, investigate ledger

### Credits deducted but operation failed
**Cause**: Refund transaction didn't fire  
**Fix**: Admin manually grants credits as compensation  
**Prevention**: Always wrap in try/catch with `refundReservation()` in catch

### Credits showing wrong balance
**Cause**: `users.credits` out of sync with ledger  
**Fix**: Recalculate from ledger and update user record  
**Admin**: Use admin panel to investigate discrepancy

---

## Key Files

```
lib/credits/credits.ts          ← All credit functions (reserve, charge, refund)
lib/db/collections.ts           ← creditLedgerCol(), usersCol()
lib/billing/billing-types.ts    ← TypeScript interfaces
app/api/admin/billing/          ← Admin billing API endpoints
app/api/admin/ledger/           ← Admin ledger API
```

---

**Related**: `DATABASE_SCHEMA.md` → `credit_ledger` and `users` collections
