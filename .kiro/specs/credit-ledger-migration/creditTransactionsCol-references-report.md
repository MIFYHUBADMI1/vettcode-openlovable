# creditTransactionsCol References Report
**Generated:** ${new Date().toISOString()}

## Summary
Found remaining references to `creditTransactionsCol` in the codebase that need to be addressed.

## Active Code Files (Need Refactoring)

### 1. `lib/db/collections.ts`
**Status:** ⚠️ Function definition still exists
- Line 39: Function export definition
- Lines 94, 114: Used in `ensureIndexes()` function
**Action Required:** Remove function after Phase 6 cleanup

### 2. `app/api/admin/users/[id]/route.ts`
**Status:** ❌ Still using legacy collection
- Line 17: `const txCol = await creditTransactionsCol()`
- Used for querying user transactions
**Action Required:** Refactor to use `getCreditHistory` from credit-service

### 3. `app/api/admin/stats/route.ts`
**Status:** ❌ Still using legacy collection
- Line 4: Import statement
- Line 126: Used in Promise.all for statistics
**Action Required:** Refactor to use credit_ledger collection

### 4. `app/api/admin/billing/user-billing/route.ts`
**Status:** ❌ Still using legacy collection
- Line 4: Import statement
- Line 16: `const txCol = await creditTransactionsCol()`
**Action Required:** Refactor to use `getCreditHistory` or `creditLedgerCol`

### 5. `app/api/admin/billing/reconciliation/route.ts`
**Status:** ⚠️ Mixed usage (has both ledger and legacy)
- Line 8: Import statement
- Line 47: Used in Promise.all alongside creditLedgerCol
**Action Required:** Remove legacy collection usage, use only ledger

### 6. `app/api/admin/billing/overview/route.ts`
**Status:** ❌ Still using legacy collection
- Line 5: Import statement
- Line 19: Used in Promise.all for overview statistics
**Action Required:** Refactor to use credit_ledger collection

### 7. `app/api/admin/self-credits/route.ts`
**Status:** ❌ Still using legacy collection for writes
- Line 4: Import statement
- Line 35: `const txCol = await creditTransactionsCol()`
- Line 37: Direct insertOne operation
**Action Required:** Refactor to use `grantCredits` from credit-service

### 8. `app/api/admin/billing/audit-log/route.ts`
**Status:** ❌ Still using legacy collection
- Line 4: Import statement
- Line 17: `const txCol = await creditTransactionsCol()`
**Action Required:** Refactor to use `getCreditHistory` or `creditLedgerCol`

## Documentation and Metadata Files (Expected)

### ✅ Acceptable References
- `.kiro/specs/credit-ledger-migration/tasks.meta.json` - Task metadata
- `.kiro/specs/credit-ledger-migration/tasks.md` - Task documentation
- `.kiro/specs/credit-ledger-migration/task-6-completion-summary.md` - Completion report
- `.kiro/specs/credit-ledger-migration/task-3.1-summary.md` - Task summary
- `.kiro/specs/credit-ledger-migration/requirements.md` - Requirements document
- `.kiro/specs/credit-ledger-migration/design.md` - Design document

## Priority Actions

### High Priority (Breaking Changes)
1. **`app/api/admin/self-credits/route.ts`** - Still writing to legacy collection
   - This violates Requirement 4.10: No insertOne on credit_transactions

### Medium Priority (Phase 4 Admin APIs)
2. **`app/api/admin/users/[id]/route.ts`** - Task 13.1
3. **`app/api/admin/billing/user-billing/route.ts`** - Task 15.1
4. **`app/api/admin/billing/audit-log/route.ts`** - Task 15.2
5. **`app/api/admin/billing/overview/route.ts`** - New discovery
6. **`app/api/admin/stats/route.ts`** - New discovery
7. **`app/api/admin/billing/reconciliation/route.ts`** - Partial migration

### Low Priority (Phase 6 Cleanup)
8. **`lib/db/collections.ts`** - Task 21.1 (remove after all migrations complete)

## Completion Status
- ✅ Phase 2: MongoStore refactored
- ✅ Phase 3: Feature services refactored (referrals, infrastructure, topup)
- ❌ Phase 4: Admin APIs still need refactoring (7 files)
- ❌ Phase 6: collections.ts cleanup pending

## Recommendations
1. Complete Phase 4 tasks (13-16) to migrate admin APIs
2. Address the new discoveries (stats, overview endpoints)
3. Execute Phase 6 cleanup to remove collections.ts references
4. No cleanup script references found - may need to be created as part of Task 19
