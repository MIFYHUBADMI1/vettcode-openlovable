# Credit Ledger Migration - Operator Guide

## Overview

This guide provides operational procedures for administrators and operators managing the credit ledger system after the migration from the legacy `credit_transactions` collection.

**Target Audience:** System administrators, DevOps engineers, operators

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Monitoring and Alerts](#monitoring-and-alerts)
3. [Ledger Viewer Usage](#ledger-viewer-usage)
4. [Common Operations](#common-operations)
5. [Troubleshooting](#troubleshooting)
6. [Performance Optimization](#performance-optimization)
7. [Disaster Recovery](#disaster-recovery)
8. [Security Considerations](#security-considerations)

---

## System Architecture

### Credit Ledger System Components

```
┌─────────────────────────────────────────────────────────┐
│                   Admin UI Layer                         │
│  • /admin/ledger - Ledger Viewer (new)                  │
│  • /admin/transactions - Legacy Transactions (updated)   │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    API Layer                             │
│  • /api/admin/ledger - Ledger query endpoint            │
│  • /api/admin/transactions - Updated to use ledger      │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Credit Service (lib/billing)                │
│  • getAvailableCredits() - Balance queries              │
│  • grantCredits() - Credit grants                       │
│  • consumeCredits() - Credit consumption                │
│  • reserveCredits() - Build reservations                │
│  • getCreditHistory() - Transaction history             │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  Database Layer                          │
│  • credit_ledger - Double-entry ledger (NEW)            │
│  • users - User balances (subscriptionCredits, permanentCredits) │
│  • ❌ credit_transactions - REMOVED after cleanup        │
└─────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Centralized Operations:** All credit operations go through `credit-service`
2. **Double-Entry Ledger:** Every transaction records balanceBefore and balanceAfter
3. **Idempotency:** All operations use idempotency keys to prevent duplicates
4. **Consumption Order:** Subscription credits (oldest first) → Permanent credits
5. **Transaction Safety:** MongoDB transactions ensure atomicity

---

## Monitoring and Alerts

### Key Metrics to Monitor

#### 1. Credit Operation Health

**Metrics:**
- Total credit grants per hour
- Total credit consumption per hour
- Failed credit operations (insufficient balance, errors)
- Average operation latency

**Queries:**
```javascript
// Count operations in last hour by type
db.credit_ledger.aggregate([
  { $match: { createdAt: { $gte: Date.now() - 3600000 } } },
  { $group: { 
      _id: "$transactionType", 
      count: { $sum: 1 },
      totalAmount: { $sum: "$amount" }
  } }
])

// Check for failed operations (if errors are logged separately)
db.error_logs.find({ 
  timestamp: { $gte: Date.now() - 3600000 },
  source: "credit-service"
})
```

#### 2. Balance Consistency

**Metrics:**
- Users with negative balances (should be 0)
- Users with divergent balance fields
- Ledger entries without matching balance updates

**Queries:**
```javascript
// Find users with negative balances (should never happen)
db.users.find({ 
  $or: [
    { subscriptionCredits: { $lt: 0 } },
    { permanentCredits: { $lt: 0 } },
    { credits: { $lt: 0 } }
  ]
})

// Find balance divergence
db.users.find({
  $expr: {
    $ne: [
      "$credits",
      { $add: ["$subscriptionCredits", "$permanentCredits"] }
    ]
  }
})
```

#### 3. Idempotency Violations

**Metrics:**
- Duplicate idempotency key errors (should be rare)
- Operations without idempotency keys (should be 0 after migration)

**Queries:**
```javascript
// Count duplicate idempotency key attempts (from logs)
// These are logged but don't cause errors - they're expected on retries

// Find entries with missing idempotency keys (should be 0)
db.credit_ledger.countDocuments({ 
  idempotencyKey: { $exists: false } 
})
```

### Recommended Alerts

1. **Critical:**
   - Any user with negative balance
   - Credit operation failure rate > 5%
   - Ledger write failures

2. **Warning:**
   - Idempotency key collision rate > 1%
   - Average operation latency > 500ms
   - Balance divergence detected

3. **Info:**
   - Unusual credit consumption patterns
   - Large credit grants (> 100,000 credits)

---

## Ledger Viewer Usage

### Accessing the Ledger Viewer

**URL:** `https://your-domain.com/admin/ledger`

**Requirements:** Admin authentication required

### Features

#### 1. Filter Panel

**Available Filters:**
- **User Search:** Search by user ID, name, or email
- **Credit Type:** Filter by subscription or permanent
- **Transaction Type:** Filter by operation type (signup_bonus, referral_bonus, topup_grant, build_consumption, etc.)
- **Direction:** Filter by credit (positive) or debit (negative)
- **Date Range:** Filter by start and end date

#### 2. Data Table

**Columns:**
- Timestamp - When the operation occurred
- User - User name and email
- Credit Type - Subscription or Permanent (color-coded)
- Direction - Credit (↑, green) or Debit (↓, red)
- Amount - Number of credits
- Transaction Type - Operation type
- Balance Before - Balance before operation
- Balance After - Balance after operation
- Reference - Reference type and ID (e.g., build, payment)
- Idempotency Key - Unique operation identifier

**Sorting:** Click column headers to sort (timestamp, amount, user)

#### 3. Summary Statistics

Displays for current filter:
- Total entries
- Total credits granted
- Total debits charged

#### 4. CSV Export

**Button:** "Export to CSV"

**Output:** Downloads a CSV file with all visible columns, respecting active filters

**Filename Format:** `credit-ledger-[timestamp].csv`

#### 5. Auto-Refresh

- Automatically refreshes every 15 seconds
- Manual refresh button available
- Maintains active filters during refresh

### Common Use Cases

#### Investigate User Credit Issues

1. Enter user ID or email in search field
2. Review complete credit history
3. Check for:
   - Duplicate operations (same idempotency key)
   - Balance inconsistencies (balanceAfter ≠ balanceBefore ± amount)
   - Failed operations

#### Audit Credit Grants

1. Filter by direction: "credit"
2. Filter by transaction type: "topup_grant", "admin_adjustment", etc.
3. Sort by amount (descending) to find large grants
4. Export to CSV for external analysis

#### Monitor Build Credit Usage

1. Filter by transaction type: "build_consumption"
2. Set date range to desired period
3. Review summary statistics
4. Export for billing analysis

#### Verify Subscription Grants

1. Filter by credit type: "subscription"
2. Filter by transaction type: "subscription_grant"
3. Check that grants match subscription plans
4. Verify expiration logic is working

---

## Common Operations

### 1. Manual Credit Adjustment

**When to Use:**
- Refunding a user for a failed build
- Compensating for system errors
- Promotional credit grants

**Procedure:**
```typescript
// Use the admin self-credits endpoint or call credit-service directly
import { grantCredits } from "@/lib/billing/credit-service"

await grantCredits({
  userId: "user_123",
  creditType: "permanent", // or "subscription"
  amount: 1000,
  transactionType: "admin_adjustment",
  idempotencyKey: `admin_adjustment_${Date.now()}_${userId}`,
  metadata: {
    reason: "Compensation for failed build",
    adjustedBy: "admin@example.com",
    ticketId: "SUPPORT-123"
  }
})
```

**Verification:**
1. Check admin ledger viewer for new entry
2. Verify user balance increased
3. Document in support ticket

### 2. Investigate Balance Discrepancy

**Steps:**

1. **Check User Balance:**
   ```javascript
   db.users.findOne({ id: "user_123" }, { 
     credits: 1, 
     subscriptionCredits: 1, 
     permanentCredits: 1 
   })
   ```

2. **Calculate Expected Balance from Ledger:**
   ```javascript
   db.credit_ledger.aggregate([
     { $match: { userId: "user_123" } },
     { $sort: { createdAt: 1 } },
     { $group: {
         _id: null,
         finalBalance: { $last: "$balanceAfter" },
         totalCredits: { 
           $sum: { $cond: [{ $eq: ["$direction", "credit"] }, "$amount", 0] }
         },
         totalDebits: {
           $sum: { $cond: [{ $eq: ["$direction", "debit"] }, "$amount", 0] }
         }
     } }
   ])
   ```

3. **Compare Values:**
   - User balance should equal ledger finalBalance
   - If not, investigate missing/duplicate entries

4. **Fix Discrepancy (if needed):**
   - Use admin adjustment to correct balance
   - Document the correction
   - Investigate root cause

### 3. Verify Subscription Credit Expiration

**Steps:**

1. **Find Expired Subscription Credits:**
   ```javascript
   db.users.find({
     "creditBuckets.expiresAt": { $lt: Date.now() },
     "creditBuckets.balance": { $gt: 0 }
   })
   ```

2. **Check Ledger for Expiration Entries:**
   ```javascript
   db.credit_ledger.find({
     transactionType: "subscription_expiration",
     createdAt: { $gte: Date.now() - 86400000 } // Last 24 hours
   })
   ```

3. **Verify Expiration Logic:**
   - Expired credits should have matching `subscription_expiration` ledger entries
   - User balance should be reduced accordingly

### 4. Reconcile Credit Packs

**Purpose:** Verify all credit pack purchases have corresponding ledger entries

**Steps:**

1. **Get All Top-ups:**
   ```javascript
   db.topups.find({ status: "completed" })
   ```

2. **Cross-reference with Ledger:**
   ```javascript
   // For each topup, verify ledger entry exists
   db.credit_ledger.find({
     transactionType: "topup_grant",
     referenceType: "topup",
     referenceId: "topup_xyz"
   })
   ```

3. **Identify Missing Entries:**
   - Any completed topup without a ledger entry needs investigation
   - Check for failed grant operations in logs

---

## Troubleshooting

### Issue: User Reports Missing Credits

**Symptoms:**
- User claims they should have more credits
- Credits not appearing after purchase or grant

**Diagnosis:**

1. **Check User Balance:**
   ```javascript
   db.users.findOne({ id: "user_123" }, { 
     credits: 1, 
     subscriptionCredits: 1, 
     permanentCredits: 1,
     creditBuckets: 1
   })
   ```

2. **Check Ledger History:**
   - Use Admin Ledger Viewer
   - Filter by user ID
   - Sort by timestamp (descending)
   - Look for the expected transaction

3. **Check Payment Records:**
   ```javascript
   db.payment_records.find({ userId: "user_123" }).sort({ createdAt: -1 })
   db.topups.find({ userId: "user_123" }).sort({ createdAt: -1 })
   ```

**Resolution:**

- **If ledger entry exists:** User has credits, may need to refresh
- **If ledger entry missing but payment completed:** Use admin adjustment to grant credits
- **If payment failed:** Resolve payment issue first, then grant credits

### Issue: Duplicate Credit Grant

**Symptoms:**
- User received credits twice for the same operation
- Multiple ledger entries with similar metadata

**Diagnosis:**

1. **Search Ledger by Idempotency Key:**
   ```javascript
   db.credit_ledger.find({ 
     userId: "user_123",
     transactionType: "topup_grant",
     createdAt: { $gte: Date.now() - 86400000 }
   })
   ```

2. **Check Idempotency Keys:**
   - Duplicate operations should have the same idempotency key
   - If keys are different, they're treated as separate operations

**Resolution:**

- **If same idempotency key:** Not a duplicate, system working correctly
- **If different keys:** Investigate why multiple keys were generated
- **To fix:** Use `reverseCredits` to debit incorrect grant

### Issue: Build Failed But Credits Deducted

**Symptoms:**
- User reports build failed but credits were charged
- Reservation not released

**Diagnosis:**

1. **Find Build Authorization:**
   ```javascript
   db.build_authorizations.findOne({ buildId: "build_xyz" })
   ```

2. **Check Ledger for Reservation:**
   ```javascript
   db.credit_ledger.find({
     transactionType: "build_reservation",
     referenceId: "build_xyz"
   })
   ```

3. **Check for Release:**
   ```javascript
   db.credit_ledger.find({
     transactionType: "build_release",
     referenceId: "build_xyz"
   })
   ```

**Resolution:**

- **If no release entry:** Call `releaseReservation` to refund
- **If release exists:** Credits were refunded, user should check balance
- **As fallback:** Use admin adjustment to credit user

### Issue: Negative Balance

**Symptoms:**
- User has negative credits (should be impossible)

**Diagnosis:**

1. **Find User:**
   ```javascript
   db.users.find({ 
     $or: [
       { subscriptionCredits: { $lt: 0 } },
       { permanentCredits: { $lt: 0 } }
     ]
   })
   ```

2. **Review Ledger History:**
   - Check for race conditions
   - Look for failed transaction rollbacks
   - Verify consumption order logic

**Resolution:**

- **Immediate:** Set balance to 0 using admin adjustment
- **Root Cause:** Investigate transaction logic, check for bugs
- **Prevention:** Review MongoDB transaction isolation levels

---

## Performance Optimization

### Index Usage

**Critical Indexes:**
```javascript
// User history - most common query
{ userId: 1, createdAt: -1 }

// Admin filters
{ transactionType: 1, createdAt: -1 }
{ creditType: 1, createdAt: -1 }

// Idempotency
{ idempotencyKey: 1 } // unique
```

**Monitor Index Usage:**
```javascript
db.credit_ledger.aggregate([
  { $indexStats: {} }
])
```

### Query Optimization

**Slow Query Example (DON'T DO THIS):**
```javascript
// Bad: No index usage
db.credit_ledger.find({ "metadata.reason": /bonus/ })
```

**Optimized Query:**
```javascript
// Good: Uses indexed fields
db.credit_ledger.find({ 
  transactionType: "signup_bonus",
  createdAt: { $gte: startDate, $lte: endDate }
})
```

### Pagination

Always use limit and skip for large result sets:
```javascript
const pageSize = 50
const page = 1
const skip = (page - 1) * pageSize

db.credit_ledger.find(filter)
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(pageSize)
```

---

## Disaster Recovery

### Backup Strategy

**Recommended:**
- Full database backup daily
- Incremental backup hourly
- Point-in-time recovery enabled

**Critical Collections:**
- `credit_ledger` - All credit operations
- `users` - User balances
- `payment_records` - Payment history
- `subscription_records` - Subscription data

### Recovery Scenarios

#### Scenario 1: Corrupted Ledger Entry

**Issue:** Single ledger entry has incorrect data

**Recovery:**
1. Identify the corrupted entry ID
2. Do NOT delete - ledger is append-only
3. Create compensating entry using admin adjustment
4. Document the correction in metadata

#### Scenario 2: Mass Data Loss

**Issue:** Multiple ledger entries lost or corrupted

**Recovery:**
1. Stop all credit operations immediately
2. Restore from latest backup
3. Calculate time window of data loss
4. Re-process any operations in the gap (use idempotency keys)
5. Verify all balances match ledger

#### Scenario 3: Balance Desync

**Issue:** User balances don't match ledger

**Recovery:**
1. Run balance reconciliation script
2. For each user, calculate expected balance from ledger
3. If mismatch found, create admin adjustment entry
4. Update user balance to match ledger
5. Log all corrections for audit

**Reconciliation Script:**
```typescript
async function reconcileBalances() {
  const users = await usersCol()
  const ledger = await creditLedgerCol()
  
  const cursor = users.find({})
  
  for await (const user of cursor) {
    // Calculate expected balance from ledger
    const lastEntry = await ledger
      .find({ userId: user.id })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray()
    
    if (lastEntry.length === 0) continue
    
    const expectedBalance = lastEntry[0].balanceAfter
    const actualBalance = user.credits
    
    if (expectedBalance !== actualBalance) {
      console.log(`Mismatch for user ${user.id}:`, {
        expected: expectedBalance,
        actual: actualBalance,
        difference: expectedBalance - actualBalance
      })
      
      // Create admin adjustment to fix
      // ... implementation
    }
  }
}
```

---

## Security Considerations

### Access Control

**Admin Ledger Viewer:**
- ✅ Requires admin authentication
- ✅ No direct database access
- ✅ Audit logged (via API logs)

**Credit Service:**
- ✅ Server-only module (cannot be called from client)
- ✅ All operations logged
- ✅ Idempotency prevents replay attacks

### Sensitive Data

**PII in Ledger:**
- User IDs are stored, not emails or names
- User enrichment happens at query time
- CSV exports contain user data - treat as confidential

**Idempotency Keys:**
- May contain sensitive operation details
- Not exposed in public APIs
- Logged for debugging purposes

### Audit Trail

**Required Logging:**
- All credit grants (who, when, how much, why)
- All credit consumption (user, amount, reference)
- All admin adjustments (admin ID, reason, ticket)
- All failed operations (error, context)

**Log Retention:**
- Keep logs for at least 90 days
- Archive indefinitely for audit purposes
- Comply with financial regulations if applicable

---

## Emergency Contacts

**For Critical Issues:**
- System Administrator: [contact info]
- Database Administrator: [contact info]
- Development Team Lead: [contact info]

**Escalation Path:**
1. Check troubleshooting section
2. Review recent logs and changes
3. Contact system administrator
4. If unresolved after 1 hour, escalate to development team

---

## Appendix

### Useful MongoDB Queries

```javascript
// Get credit statistics for last 24 hours
db.credit_ledger.aggregate([
  { $match: { createdAt: { $gte: Date.now() - 86400000 } } },
  { $group: {
      _id: "$transactionType",
      count: { $sum: 1 },
      totalAmount: { $sum: "$amount" }
  } },
  { $sort: { totalAmount: -1 } }
])

// Find largest single credit grants
db.credit_ledger.find({ direction: "credit" })
  .sort({ amount: -1 })
  .limit(10)

// Find users with most credit activity
db.credit_ledger.aggregate([
  { $group: { _id: "$userId", operationCount: { $sum: 1 } } },
  { $sort: { operationCount: -1 } },
  { $limit: 20 }
])

// Check idempotency key uniqueness
db.credit_ledger.aggregate([
  { $group: { _id: "$idempotencyKey", count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
])
```

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Related Specifications:** credit-ledger-migration  
**Maintained By:** Development Team
