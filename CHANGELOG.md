# Changelog

All notable changes to MirrorSite AI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed - Credit Ledger Migration

#### Migration to Unified Double-Entry Ledger System

**Summary:** The credit transaction system has been migrated from a legacy single-entry system (`credit_transactions` collection) to a unified double-entry ledger system (`credit_ledger` collection). This migration improves accounting accuracy, auditability, and enables better credit management features.

**Key Changes:**

1. **New Credit Ledger Collection**
   - All credit operations now use the `credit_ledger` collection
   - Double-entry accounting with `balanceBefore` and `balanceAfter` for every entry
   - Separate tracking of subscription and permanent credits
   - Enhanced transaction metadata and idempotency guarantees

2. **Centralized Credit Service**
   - All credit operations route through `lib/billing/credit-service.ts`
   - No direct database collection access for credit operations
   - Consistent idempotency handling across all operations
   - Proper error handling and logging

3. **Admin Ledger Viewer**
   - New admin UI at `/admin/ledger` for viewing credit transactions
   - Advanced filtering by user, credit type, transaction type, direction, and date range
   - Real-time updates every 15 seconds
   - CSV export functionality
   - Summary statistics (total entries, credits granted, debits charged)

4. **Enhanced Transactions UI**
   - Legacy transactions page updated to display ledger data
   - Visual distinction between credit (green, ↑) and debit (red, ↓) operations
   - Balance before/after display for transparency
   - Credit type badges (subscription vs permanent)

5. **Credit Consumption Order**
   - Subscription credits consumed first (oldest expiring first)
   - Permanent credits consumed second
   - Documented in `lib/billing/config.ts` as `CONSUMPTION_ORDER`

6. **Improved Idempotency**
   - All credit operations require idempotency keys
   - Duplicate operations safely return existing results
   - Prevents double-charging and duplicate grants

**Breaking Changes:**

- ❌ **Removed:** `creditTransactionsCol` function from `lib/db/collections.ts`
- ❌ **Removed:** `credit_transactions` collection (after Phase 6 cleanup)
- ✅ **Replaced with:** `creditLedgerCol` and credit-service functions

**Migration Notes:**

- The migration uses a clean cutover approach - no historical data migration
- Legacy `credit_transactions` collection is backed up before removal
- All code refactored to use `credit-service` instead of direct collection access
- Backward compatibility maintained for API response formats

**Database Changes:**

- **Added Collections:**
  - `credit_ledger` - Unified double-entry ledger
  
- **Removed Collections:**
  - `credit_transactions` - Legacy single-entry system (after cleanup)

- **New Indexes on credit_ledger:**
  - `{ id: 1 }` - Unique sparse index for entry IDs
  - `{ userId: 1, createdAt: -1 }` - User credit history queries
  - `{ userId: 1, creditType: 1, createdAt: -1 }` - Filtered user queries
  - `{ idempotencyKey: 1 }` - Unique idempotency guarantee
  - `{ transactionType: 1, createdAt: -1 }` - Admin reports and analytics
  - `{ referenceType: 1, referenceId: 1 }` - Reference lookups
  - `{ createdAt: -1 }` - Time-series queries
  - `{ creditType: 1, createdAt: -1 }` - Credit type filtering

**Refactored Files:**

- `lib/store/mongo-store.ts` - Delegates to credit-service
- `lib/referrals/referrals.ts` - Uses credit-service for grants
- `lib/infrastructure/service.ts` - Uses credit-service for build operations
- `lib/billing/topup-service.ts` - Uses credit-service for topups
- `lib/auth/users.ts` - Uses credit-service for signup bonuses
- `app/api/admin/users/[id]/route.ts` - Queries credit-ledger
- `app/api/admin/self-credits/route.ts` - Uses credit-service
- `app/api/admin/billing/user-billing/route.ts` - Queries credit-ledger
- `app/api/admin/billing/audit-log/route.ts` - Queries credit-ledger
- `app/api/admin/transactions/route.ts` - Reads from credit-ledger

**New Files:**

- `app/admin/ledger/page.tsx` - Admin ledger viewer UI
- `app/api/admin/ledger/route.ts` - Ledger query API endpoint
- `scripts/cleanup-credit-transactions.ts` - Database cleanup script
- `.kiro/specs/credit-ledger-migration/cleanup-execution-guide.md` - Cleanup documentation

**Documentation:**

- Enhanced JSDoc comments in `lib/billing/credit-service.ts`
- Migration operator guide in `.kiro/specs/credit-ledger-migration/`
- Cleanup execution guide with rollback procedures
- Updated README with credit consumption order

**Testing:**

- Unit tests for credit-service functions
- Integration tests for ledger API endpoints
- Property-based tests for correctness properties
- End-to-end tests for complete credit flows

**Rollback Procedure:**

If issues are discovered after cleanup, the `credit_transactions` collection can be restored from the backup file created during cleanup execution. See the cleanup execution guide for detailed rollback instructions.

**Related Specifications:**

- `.kiro/specs/credit-ledger-migration/requirements.md`
- `.kiro/specs/credit-ledger-migration/design.md`
- `.kiro/specs/credit-ledger-migration/tasks.md`

---

## [Previous Releases]

_Previous changelog entries would go here as the project evolves._
