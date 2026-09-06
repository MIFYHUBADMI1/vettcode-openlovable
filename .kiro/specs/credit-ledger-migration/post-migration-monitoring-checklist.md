# Post-Migration Monitoring Checklist

## Overview

This checklist provides a structured approach to monitoring the credit ledger system after migration completion. Use this to ensure system stability and catch any issues early.

**Timeline:** First 48 hours are critical, then weekly checks for the first month

---

## Immediate Post-Cleanup (First 2 Hours)

### Hour 1: Basic Verification

- [ ] **Cleanup Script Execution**
  - [ ] Backup file created successfully
  - [ ] Backup file size reasonable (matches collection size)
  - [ ] credit_transactions collection no longer exists
  - [ ] Cleanup report generated
  
- [ ] **Application Health**
  - [ ] Application is running
  - [ ] No errors in startup logs
  - [ ] Health check endpoints responding
  
- [ ] **Database Connectivity**
  - [ ] MongoDB connection pool healthy
  - [ ] credit_ledger collection accessible
  - [ ] Indexes present and usable

### Hour 2: Functional Testing

- [ ] **Admin UI Tests**
  - [ ] Admin Ledger Viewer loads without errors
  - [ ] Can filter by user ID
  - [ ] Can filter by transaction type
  - [ ] CSV export works
  - [ ] Legacy transactions page loads
  
- [ ] **Credit Operations**
  - [ ] Create test user - signup bonus granted
  - [ ] Check test user balance via API
  - [ ] Verify ledger entry created for signup bonus
  - [ ] Check idempotency - retry signup bonus (should not duplicate)

---

## First 24 Hours: Critical Monitoring

### Error Monitoring

- [ ] **Check Error Logs (Every 2 Hours)**
  ```bash
  # Look for credit-related errors
  grep -i "credit\|ledger\|insufficient" /var/log/app.log | tail -100
  ```
  
  **Red Flags:**
  - References to creditTransactionsCol
  - "Collection 'credit_transactions' not found" errors
  - Credit operation failures > 1%
  - Negative balance errors

- [ ] **Monitor Application Logs**
  ```bash
  # Watch for warnings
  tail -f /var/log/app.log | grep -i "warn\|error"
  ```

### Performance Monitoring

- [ ] **Credit Operation Latency** (Target: < 200ms)
  ```javascript
  // Query slow operations
  db.system.profile.find({
    ns: "your_db.credit_ledger",
    millis: { $gt: 200 }
  }).sort({ ts: -1 }).limit(10)
  ```

- [ ] **Database Query Performance**
  ```javascript
  // Check for table scans
  db.credit_ledger.find({}).explain("executionStats")
  ```

### Data Integrity Checks

- [ ] **Balance Consistency Check** (Run every 4 hours)
  ```javascript
  // Should return empty array
  db.users.find({
    $expr: {
      $ne: [
        "$credits",
        { $add: ["$subscriptionCredits", "$permanentCredits"] }
      ]
    }
  }).count()
  ```
  
  **If non-zero:** Investigate immediately

- [ ] **Negative Balance Check** (Run every 4 hours)
  ```javascript
  // Should return empty array
  db.users.find({
    $or: [
      { subscriptionCredits: { $lt: 0 } },
      { permanentCredits: { $lt: 0 } },
      { credits: { $lt: 0 } }
    ]
  }).count()
  ```
  
  **If non-zero:** CRITICAL - investigate immediately

- [ ] **Ledger Entry Verification**
  ```javascript
  // Check that entries have all required fields
  db.credit_ledger.findOne({
    $or: [
      { idempotencyKey: { $exists: false } },
      { balanceBefore: { $exists: false } },
      { balanceAfter: { $exists: false } }
    ]
  })
  ```
  
  **Should be null**

### User Experience Monitoring

- [ ] **Support Tickets**
  - [ ] Check for credit-related support tickets
  - [ ] Monitor user complaints about missing credits
  - [ ] Watch for duplicate charge reports

- [ ] **User Activity**
  - [ ] Verify users can perform builds
  - [ ] Check credit pack purchases work
  - [ ] Confirm subscription grants occur

---

## Daily Checks (First Week)

### Day 1

- [ ] **Morning Check (9 AM)**
  - [ ] Review overnight error logs
  - [ ] Run balance consistency check
  - [ ] Check ledger collection size growth
  - [ ] Verify no critical alerts fired

- [ ] **Afternoon Check (3 PM)**
  - [ ] Review morning's credit operations
  - [ ] Check for any user reports
  - [ ] Verify admin UI still functional
  - [ ] Run negative balance check

### Days 2-7

- [ ] **Daily Morning Check**
  - [ ] Review error logs from last 24 hours
  - [ ] Run balance consistency check
  - [ ] Check support ticket queue
  - [ ] Verify system health metrics

- [ ] **Daily Statistics Review**
  ```javascript
  // Compare to pre-migration if possible
  db.credit_ledger.aggregate([
    { $match: { createdAt: { $gte: Date.now() - 86400000 } } },
    { $group: {
        _id: "$transactionType",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" }
    } }
  ])
  ```

- [ ] **Weekly Summary (Day 7)**
  - [ ] Total credit operations this week
  - [ ] Error rate (should be < 0.1%)
  - [ ] Performance metrics (latency, throughput)
  - [ ] Any balance discrepancies found and resolved
  - [ ] User feedback summary

---

## Weekly Checks (First Month)

### Week 1 ✅

- [ ] Completed daily checks (Days 1-7)
- [ ] No critical issues encountered
- [ ] System performance acceptable
- [ ] User feedback positive

**Week 1 Summary:**
- Total operations: _______
- Error rate: _______
- Issues found: _______
- Issues resolved: _______

### Week 2

- [ ] **Monday: Full System Audit**
  - [ ] Run all integrity checks
  - [ ] Review performance metrics
  - [ ] Check index usage statistics
  - [ ] Verify backup strategy working

- [ ] **Wednesday: Mid-Week Check**
  - [ ] Balance consistency check
  - [ ] Review error logs
  - [ ] Check support tickets

- [ ] **Friday: Week-End Review**
  - [ ] Weekly statistics report
  - [ ] Performance trends
  - [ ] Document any issues

### Week 3-4

- [ ] **Same as Week 2** (Monday, Wednesday, Friday checks)
- [ ] **Month-End Report Preparation**
  - [ ] Compile all weekly summaries
  - [ ] Calculate overall success metrics
  - [ ] Document lessons learned
  - [ ] Propose any optimizations

---

## Key Performance Indicators (KPIs)

### Success Metrics

Track these daily for the first week:

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| **Credit Operation Success Rate** | > 99% | ___% | ⬜ |
| **Average Operation Latency** | < 200ms | ___ms | ⬜ |
| **Idempotency Collision Rate** | < 1% | ___% | ⬜ |
| **Balance Consistency** | 100% | ___% | ⬜ |
| **Negative Balance Incidents** | 0 | ___ | ⬜ |
| **Support Tickets (Credit Issues)** | < 5/day | ___ | ⬜ |
| **Database Query Performance** | < 100ms (p95) | ___ms | ⬜ |
| **Admin UI Load Time** | < 2s | ___s | ⬜ |

### Red Flags 🚩

**Immediate Action Required:**
- ❌ Any user with negative balance
- ❌ Credit operation success rate < 95%
- ❌ Balance consistency < 99%
- ❌ Support tickets > 20/day about credit issues

**Investigation Needed:**
- ⚠️ Operation latency > 500ms (p95)
- ⚠️ Idempotency collision rate > 5%
- ⚠️ Error rate > 1%
- ⚠️ Balance divergence in > 10 users

---

## Database Health Checks

### Index Usage Analysis

Run weekly:

```javascript
// Check which indexes are being used
db.credit_ledger.aggregate([
  { $indexStats: {} }
])

// Look for:
// - Unused indexes (consider removing)
// - High ops count on expected indexes (good)
// - Accesses.ops = 0 (index not used, investigate)
```

### Collection Statistics

Run weekly:

```javascript
// Get collection size and index size
db.credit_ledger.stats()

// Expected growth rate:
// - ~1000 docs/day (typical)
// - ~500KB/day with indexes
// - Monitor for unexpected spikes
```

### Query Performance

Run daily:

```javascript
// Find slow queries
db.system.profile.find({
  ns: "your_db.credit_ledger",
  millis: { $gt: 100 }
}).sort({ ts: -1 }).limit(10)

// If found, analyze with explain():
db.credit_ledger.find({ /* slow query */ }).explain("executionStats")
```

---

## User Impact Assessment

### Positive Indicators ✅

- [ ] No increase in credit-related support tickets
- [ ] Builds continue to work normally
- [ ] Credit pack purchases successful
- [ ] Subscription credits granted on renewal
- [ ] Users not reporting missing credits

### Negative Indicators ❌

- [ ] Spike in support tickets about credits
- [ ] Users reporting failed builds due to insufficient credits
- [ ] Credit purchase failures
- [ ] Users seeing incorrect balance
- [ ] Duplicate charge complaints

**If negative indicators present:**
1. Check error logs immediately
2. Review recent ledger entries for affected users
3. Run balance consistency checks
4. Escalate to development team if needed

---

## Rollback Decision Criteria

### When to Consider Rollback

Rollback should be considered if:

1. **Data Integrity Issues**
   - More than 10 users with balance inconsistencies
   - Any user with negative balance
   - Ledger entries missing critical fields

2. **Functional Failures**
   - Credit operations failing > 10% of the time
   - Admin UI completely non-functional
   - Critical features broken (builds, purchases)

3. **Performance Degradation**
   - Operation latency > 1 second consistently
   - Database query timeouts
   - Application crashes related to credit operations

4. **User Impact**
   - More than 50 support tickets per day
   - Multiple users reporting same credit issue
   - Revenue impact (purchases failing)

### Rollback Process

See [Cleanup Execution Guide](./cleanup-execution-guide.md#rollback-procedure) for detailed steps.

---

## Communication Plan

### Internal Communication

**Daily Status Updates (First Week):**
- Send to: Development team, Operations, Support
- Include: Key metrics, issues found, actions taken
- Format: Brief email or Slack message

**Weekly Reports (First Month):**
- Send to: Management, Development, Operations, Support
- Include: Weekly summary, trends, lessons learned
- Format: Detailed report

### User Communication

**If Issues Detected:**

1. **Minor Issues (< 10 users affected):**
   - Handle via support tickets
   - No mass communication needed
   - Document resolution for similar cases

2. **Major Issues (> 10 users affected):**
   - Send user notification about investigation
   - Provide ETA for resolution
   - Follow up when resolved

3. **Critical Issues (System-wide):**
   - Emergency notification to all users
   - Status page update
   - Hourly updates until resolved

---

## Escalation Path

### Level 1: Support Team (0-30 minutes)

- Handle routine credit inquiries
- Check user balance via admin UI
- Verify recent transactions
- Can resolve: Missing credits, balance questions

### Level 2: Operations Team (30-60 minutes)

- Access database directly
- Run diagnostic queries
- Check system logs
- Can resolve: Balance discrepancies, failed operations

### Level 3: Development Team (60+ minutes)

- Code-level investigation
- Database schema issues
- Critical bugs
- Can resolve: System-wide issues, data corruption

### Emergency Contact

**Critical Issues (Any time):**
- On-call engineer: [phone/slack]
- Development lead: [phone/slack]
- Database admin: [phone/slack]

---

## Completion Criteria

### Week 1 Complete When:

- ✅ All daily checks completed
- ✅ No critical issues encountered
- ✅ All KPIs meet targets
- ✅ User feedback neutral or positive
- ✅ Weekly summary documented

### Migration Fully Complete When:

- ✅ 4 weeks of monitoring completed
- ✅ All KPIs consistently meet targets
- ✅ No outstanding issues
- ✅ User feedback confirms stability
- ✅ Team confident in new system
- ✅ Documentation updated with lessons learned

---

## Final Sign-Off

**Week 4 Completion:**

- [ ] All monitoring completed
- [ ] No critical issues remaining
- [ ] Performance meets targets
- [ ] Documentation finalized
- [ ] Team trained on new system
- [ ] Backup verified and archived
- [ ] Migration project closed

**Signed Off By:**
- Operations Lead: _________________ Date: _______
- Development Lead: _________________ Date: _______
- Product Owner: _________________ Date: _______

---

## Notes Section

Use this space to document any unusual occurrences, workarounds discovered, or lessons learned:

```
Date: ________
Issue: ________________________________________________________
Resolution: ____________________________________________________
Notes: _________________________________________________________
```

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Related Documents:** 
- cleanup-execution-guide.md
- operator-guide.md
- migration-completion-report.md
