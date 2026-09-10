# Implementation Plan: Credit Ledger Migration

## Overview

This implementation plan migrates the legacy single-entry credit transaction system to the unified double-entry ledger system. The migration follows a six-phase approach that prioritizes safety and minimizes breaking changes by establishing new UI and API infrastructure first, then refactoring internal services to use the centralized credit-service, and finally cleaning up legacy code and database collections.

## Tasks

### Phase 1: Foundation (No Breaking Changes)

- [x] 1. Create Admin Ledger Viewer API endpoint
  - [x] 1.1 Implement `/api/admin/ledger` route handler
    - Create file `app/api/admin/ledger/route.ts`
    - Implement GET handler with admin authentication check
    - Parse and validate query parameters (userId, creditType, transactionType, direction, startDate, endDate, page, limit, sortBy, sortOrder)
    - Build MongoDB filter from query parameters
    - Execute paginated query on credit_ledger collection
    - Calculate summary statistics using aggregation pipeline
    - Return JSON response with entries, pagination metadata, and summary
    - _Requirements: 2.1, 2.2, 2.3, 2.4-2.11, 2.13, 2.14, 2.15, 2.17, 2.18, 2.20_
  
  - [ ]* 1.2 Write unit tests for query parameter parsing
    - Test valid parameter combinations
    - Test invalid parameters return appropriate errors
    - Test default values for optional parameters
    - _Requirements: 11.2_
  
  - [x] 1.3 Implement user enrichment logic
    - Batch fetch user documents for all unique userIds in results
    - Create user map for efficient lookups
    - Enrich ledger entries with userName and userEmail
    - Handle missing users gracefully with fallback values
    - _Requirements: 2.16_
  
  - [ ]* 1.4 Write integration tests for ledger API endpoint
    - Test full request/response cycle
    - Test filter combinations produce correct results
    - Test pagination navigation
    - Test admin authentication requirement
    - _Requirements: 11.2_

- [x] 2. Create Admin Ledger Viewer UI component
  - [x] 2.1 Create ledger page component structure
    - Create file `app/admin/ledger/page.tsx`
    - Set up page layout with header, filters, summary, table, and pagination sections
    - _Requirements: 1.1_
  
  - [x] 2.2 Implement custom hooks for data management
    - Create `useLedgerData` hook for fetching and state management
    - Implement auto-refresh every 15 seconds
    - Create `useLedgerFilters` hook for filter state management
    - _Requirements: 1.19_
  
  - [x] 2.3 Create FilterPanel component
    - Implement search input for user, reason, and reference filtering
    - Implement credit type select filter (subscription, permanent)
    - Implement transaction type select filter
    - Implement direction select filter (credit, debit)
    - Implement date range filter with start and end date inputs
    - Implement clear all filters button
    - _Requirements: 1.4, 1.5, 1.6, 1.7, 1.8, 1.18_
  
  - [x] 2.4 Create LedgerTable and LedgerRow components
    - Display all required fields: timestamp, user, credit type, direction, amount, transaction type, balances, reference, idempotency key
    - Implement sortable columns for timestamp, amount, and userId
    - Apply visual distinction for credit (green, upward arrow) and debit (red, downward arrow)
    - Format balance values in monospace font with thousands separators
    - Display credit type with color-coded badges
    - _Requirements: 1.3, 1.16, 1.17_
  
  - [x] 2.5 Create SummaryPanel component
    - Display total entries count
    - Display total credits granted
    - Display total debits charged
    - _Requirements: 1.12_
  
  - [x] 2.6 Create PaginationControls component
    - Display current page and total pages
    - Implement first, previous, next, last page navigation
    - Implement page size selector (25, 50, 100, 200)
    - _Requirements: 1.9, 1.10, 1.11_
  
  - [x] 2.7 Implement CSV export functionality
    - Create exportToCSV function
    - Include all visible columns in export
    - Apply active filters to export
    - Generate downloadable CSV file with timestamp in filename
    - _Requirements: 1.13, 1.14, 1.15_
  
  - [x] 2.8 Implement loading and empty states
    - Display loading spinner during data fetch
    - Display error message on fetch failure
    - Display empty state message when no results match filters
    - _Requirements: 1.20_
  
  - [ ]* 2.9 Write unit tests for UI components
    - Test filter state management
    - Test pagination calculations
    - Test CSV export data transformation
    - Test search filtering logic
    - Test sort order logic
    - _Requirements: 11.1_

- [x] 3. Update legacy transactions endpoint to read from ledger
  - [x] 3.1 Refactor `/api/admin/transactions` route handler
    - Replace `creditTransactionsCol` import with `creditLedgerCol`
    - Update query to use credit_ledger collection
    - Map ledger entries to legacy response format
    - Compute signed amount from direction and amount fields
    - Preserve existing response structure (id, userId, userName, userEmail, type, amount, reason, createdAt)
    - Add optional ledger fields (creditType, direction, balanceBefore, balanceAfter) to response
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 5.13, 5.14, 5.15_
  
  - [ ]* 3.2 Write integration tests for updated transactions endpoint
    - Test response structure compatibility
    - Test signed amount calculation
    - Test user enrichment
    - Test admin authentication
    - _Requirements: 11.3_

- [ ] 4. Update admin transactions UI page
  - [ ] 4.1 Enhance transactions page with ledger fields
    - Update `app/admin/transactions/page.tsx` to display credit type
    - Display direction with visual distinction (arrows and colors)
    - Display balance before and balance after values
    - Format balance values in monospace font with thousands separators
    - Apply green styling for credit entries, red for debit entries
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12, 6.13, 6.14, 6.15_

- [ ] 5. Checkpoint - Verify Phase 1 completion
  - Ensure all tests pass
  - Manually verify Admin Ledger Viewer displays data correctly
  - Verify legacy transactions endpoint still works
  - Verify no breaking changes to existing functionality

### Phase 2: Core Services (Internal Changes Only)

- [ ] 6. Refactor MongoStore to delegate to credit-service
  - [ ] 6.1 Refactor getBalance method
    - Replace direct users collection query with call to `getAvailableCredits`
    - Maintain cache behavior
    - _Requirements: 3.1, 3.2, 3.4, 3.13_
  
  - [ ] 6.2 Refactor listTransactions method
    - Replace credit_transactions query with call to `getCreditHistory`
    - Map ledger entries to legacy CreditTransaction format
    - Maintain cache behavior
    - _Requirements: 3.1, 3.5, 3.13_
  
  - [ ] 6.3 Implement mapLedgerToLegacyTransaction helper
    - Convert ledger entry fields to legacy format
    - Compute signed amount from direction and amount
    - Map metadata.reason to reason field
    - _Requirements: 3.6, 3.11_
  
  - [ ] 6.4 Refactor addTransaction method
    - Determine if operation is credit or debit based on amount sign
    - Call `grantCredits` for positive amounts
    - Call `consumeCredits` for negative amounts
    - Use transaction ID as idempotency key
    - Add legacyMigration flag to metadata
    - Maintain cache invalidation behavior
    - _Requirements: 3.2, 3.3, 3.6, 3.12, 3.13_
  
  - [ ] 6.5 Refactor reserveCreditsAtomic method
    - Replace MongoDB transaction logic with call to `reserveCredits`
    - Handle InsufficientCreditsError by returning false
    - Propagate other errors to caller
    - Maintain cache invalidation behavior
    - _Requirements: 3.2, 3.3, 3.7, 3.12, 3.13, 3.14_
  
  - [ ] 6.6 Update imports in MongoStore
    - Remove `creditTransactionsCol` import
    - Add imports for credit-service functions (getAvailableCredits, getCreditHistory, grantCredits, consumeCredits, reserveCredits)
    - Add import for CreditLedgerEntry type
    - _Requirements: 3.8, 3.9, 3.15_
  
  - [ ]* 6.7 Write unit tests for MongoStore delegation
    - Test that getBalance calls getAvailableCredits
    - Test that listTransactions calls getCreditHistory
    - Test that addTransaction calls appropriate credit-service function
    - Test that reserveCreditsAtomic calls reserveCredits
    - Test error propagation
    - Test cache invalidation
    - _Requirements: 11.1, 11.6_

- [ ] 7. Refactor auth user creation to use credit-service
  - [ ] 7.1 Update lib/auth/users.ts
    - Replace direct credit_transactions insertion with call to `grantCredits`
    - Use signup_bonus transaction type
    - Generate proper idempotency key
    - _Requirements: 4.1, 4.5, 4.10, 4.13, 4.17_
  
  - [ ]* 7.2 Write integration tests for user signup credit grant
    - Test signup bonus creates ledger entry
    - Test idempotency of signup bonus
    - _Requirements: 11.10_

- [ ] 8. Refactor topup service to use credit-service
  - [ ] 8.1 Update lib/billing/topup-service.ts
    - Replace direct credit operations with calls to `grantCredits`
    - Use topup_grant transaction type
    - Ensure idempotency key usage
    - Remove direct collection access
    - _Requirements: 4.1, 4.4, 4.10, 4.13, 4.17_
  
  - [ ]* 8.2 Write integration tests for topup grant flow
    - Test topup creates ledger entry
    - Test balance update after topup
    - Test idempotency
    - _Requirements: 11.10_

- [ ] 9. Checkpoint - Verify Phase 2 completion
  - Ensure all core service tests pass
  - Verify MongoStore methods work correctly for existing callers
  - Verify signup and topup flows still work
  - Check that ledger entries are created for all operations

### Phase 3: Feature Services

- [ ] 10. Refactor referrals service to use credit-service
  - [ ] 10.1 Update lib/referrals/referrals.ts
    - Replace direct credit_transactions operations with calls to `grantCredits`
    - Use referral_bonus transaction type
    - Ensure proper idempotency keys
    - Remove direct collection access
    - _Requirements: 4.1, 4.2, 4.10, 4.13, 4.17_
  
  - [ ]* 10.2 Write integration tests for referral credit grant
    - Test referral bonus creates ledger entry
    - Test both referrer and referee receive credits
    - Test idempotency
    - _Requirements: 11.10_

- [ ] 11. Refactor infrastructure service to use credit-service
  - [ ] 11.1 Update lib/infrastructure/service.ts
    - Replace direct credit operations with calls to credit-service functions
    - Use build_reservation, build_consumption, build_release transaction types
    - Ensure proper idempotency keys for build operations
    - Remove direct collection access
    - _Requirements: 4.1, 4.3, 4.10, 4.13, 4.17_
  
  - [ ]* 11.2 Write integration tests for infrastructure credit flows
    - Test build reservation creates ledger entry
    - Test build consumption creates ledger entry
    - Test build release creates ledger entry
    - Test credit flow through complete build lifecycle
    - _Requirements: 11.11_

- [ ] 12. Checkpoint - Verify Phase 3 completion
  - Ensure all feature service tests pass
  - Verify referral credit grants work correctly
  - Verify infrastructure build credit operations work correctly
  - Check ledger entries for referral and build operations

### Phase 4: Admin APIs

- [ ] 13. Refactor admin user API to use credit-service
  - [ ] 13.1 Update app/api/admin/users/[id]/route.ts
    - Replace credit_transactions query with call to `getCreditHistory`
    - Update transaction retrieval logic
    - Remove direct collection access
    - _Requirements: 4.1, 4.6, 4.11, 4.14, 4.17_

- [ ] 14. Refactor admin self-credits API to use credit-service
  - [ ] 14.1 Update app/api/admin/self-credits/route.ts
    - Replace direct credit operations with call to `grantCredits`
    - Use admin_adjustment transaction type
    - Ensure idempotency
    - Remove direct collection access
    - _Requirements: 4.1, 4.7, 4.10, 4.13, 4.17_

- [ ] 15. Refactor admin billing APIs to use credit-service
  - [ ] 15.1 Update app/api/admin/billing/user-billing/route.ts
    - Replace credit_transactions query with call to `getCreditHistory`
    - Update transaction retrieval logic
    - Remove direct collection access
    - _Requirements: 4.1, 4.8, 4.11, 4.14, 4.17_
  
  - [ ] 15.2 Update app/api/admin/billing/audit-log/route.ts
    - Replace credit_transactions query with call to `getCreditHistory` or `creditLedgerCol`
    - Update transaction retrieval logic
    - Remove direct collection access
    - _Requirements: 4.1, 4.9, 4.11, 4.14, 4.17_

- [ ] 16. Checkpoint - Verify Phase 4 completion
  - Ensure all admin API tests pass
  - Manually test admin user detail page displays transaction history
  - Manually test admin self-credits functionality
  - Manually test admin billing pages display credit data correctly

### Phase 5: Verification

- [ ] 17. Comprehensive testing and verification
  - [ ] 17.1 Search for remaining creditTransactionsCol references
    - Run `grep -r "creditTransactionsCol" lib/ app/` to find any remaining usage
    - Verify only cleanup script and test files reference the legacy collection
    - _Requirements: 4.1, 4.15_
  
  - [ ] 17.2 Verify no writes to credit_transactions collection
    - Search codebase for `insertOne` operations on credit_transactions
    - Verify all credit operations use credit-service
    - _Requirements: 4.10, 4.19, 10.7, 11.5_
  
  - [ ] 17.3 Run complete test suite
    - Execute all unit tests
    - Execute all integration tests
    - Execute all property-based tests
    - Verify 90% code coverage for refactored modules
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11, 11.12, 11.13, 11.15_
  
  - [ ]* 17.4 Write property-based tests for correctness properties
    - **Property 2: Filter Result Correctness**
    - **Validates: Requirements 1.4, 1.5, 1.6, 1.7, 1.8**
    - Test that all filtered results match ALL active filter criteria
  
  - [ ]* 17.5 Write property-based tests for pagination
    - **Property 3: Pagination Correctness**
    - **Validates: Requirements 1.9, 1.10, 1.11**
    - Test that pagination correctly divides data and all entries appear exactly once
  
  - [ ]* 17.6 Write property-based tests for summary statistics
    - **Property 4: Summary Statistics Accuracy**
    - **Validates: Requirements 1.12**
    - Test that summary calculations match actual data sums
  
  - [ ] 17.7 Manual smoke testing of admin UI
    - Test Admin Ledger Viewer filters work correctly
    - Test pagination navigation works
    - Test CSV export produces valid CSV
    - Test auto-refresh updates data
    - Test empty state displays correctly
    - Test legacy transactions page displays ledger data
    - Test balance and direction visual distinctions
    - _Requirements: 8.3_
  
  - [ ] 17.8 Manual API endpoint testing
    - Test `/api/admin/ledger` with various filter combinations
    - Test invalid parameters return appropriate errors
    - Test admin authentication requirement
    - Test response structure matches specification
    - _Requirements: 8.6_
  
  - [ ] 17.9 Database integrity verification
    - Query credit_ledger collection and verify entries have all required fields
    - Verify balanceBefore and balanceAfter values are consistent
    - Verify idempotency keys are unique
    - Run balance reconciliation queries
    - _Requirements: 8.5, 8.11_
  
  - [ ] 17.10 Create verification checklist document
    - Document all verification steps performed
    - Document test results
    - Document any issues found and resolved
    - Create at `.kiro/specs/credit-ledger-migration/verification-checklist.md`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12, 8.16, 8.17, 8.18_

- [ ] 18. Checkpoint - Verify Phase 5 completion
  - All tests pass with 90%+ coverage
  - No remaining creditTransactionsCol references except in cleanup script
  - Manual verification checklist complete
  - System ready for Phase 6 cleanup

### Phase 6: Cleanup

- [ ] 19. Create and test database cleanup script
  - [ ] 19.1 Create cleanup script
    - Create file `scripts/cleanup-legacy-credit-transactions.ts`
    - Implement verification that credit_ledger exists and has entries
    - Implement backup creation to `backups/credit_transactions_backup_[timestamp].json`
    - Implement interactive confirmation prompt
    - Implement collection drop operation
    - Implement deletion verification
    - Implement operation logging
    - Add safety checks and error handling
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 7.14, 7.15_
  
  - [ ] 19.2 Add cleanup script to package.json
    - Add script entry: `"cleanup:credit-transactions": "tsx scripts/cleanup-legacy-credit-transactions.ts"`
    - _Requirements: 7.1_
  
  - [ ]* 19.3 Write tests for cleanup script
    - Test backup creation
    - Test confirmation prompt handling
    - Test abort on empty ledger collection
    - Test collection drop success verification
    - _Requirements: 11.14_

- [ ] 20. Execute database cleanup (MANUAL STEP - DO NOT AUTOMATE)
  - [ ] 20.1 Run cleanup script manually
    - Execute `npm run cleanup:credit-transactions`
    - Review backup file location and contents
    - Confirm deletion when prompted
    - Verify credit_transactions collection no longer exists
    - _Requirements: 7.3, 7.8, 7.9, 7.11, 7.14, 7.20_

- [ ] 21. Remove legacy code references
  - [ ] 21.1 Remove creditTransactionsCol from collections.ts
    - Remove function export from `lib/db/collections.ts`
    - Remove collection type definition
    - Remove index creation logic for credit_transactions
    - Update ensureIndexes function to remove creditTx variable references
    - _Requirements: 7.16, 7.17, 7.18, 7.19_
  
  - [ ] 21.2 Add required indexes for credit_ledger collection
    - Create composite index on { userId: 1, createdAt: -1 }
    - Create index on { createdAt: -1 }
    - Create index on { transactionType: 1, createdAt: -1 }
    - Create index on { creditType: 1, createdAt: -1 }
    - Create unique index on { idempotencyKey: 1 }
    - _Requirements: Design Section 10_

- [ ] 22. Update documentation
  - [ ] 22.1 Add JSDoc comments to refactored code
    - Add comments to MongoStore delegation methods
    - Document idempotency requirements
    - Document error handling expectations
    - Add example usage for complex operations
    - _Requirements: 9.1, 9.2, 9.7, 9.8, 9.9_
  
  - [ ] 22.2 Update README and CHANGELOG
    - Document migration to credit ledger system
    - Add migration notes to CHANGELOG
    - Document credit consumption order
    - Document double-entry ledger principles
    - Update API documentation references
    - _Requirements: 9.10, 9.11, 9.12, 9.13_
  
  - [ ] 22.3 Create migration operator guide
    - Document cleanup procedure
    - Document rollback procedures
    - Document post-migration monitoring requirements
    - Document cutover process
    - _Requirements: 7.20, 8.13, 8.19, 8.20, 10.13_

- [ ] 23. Final checkpoint - Migration complete
  - All tests pass
  - All documentation updated
  - Legacy collection removed
  - No references to creditTransactionsCol remain
  - System operating on credit ledger exclusively

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at each phase boundary
- Phase 1 establishes new infrastructure without breaking existing code
- Phases 2-4 progressively refactor internal services to use credit-service
- Phase 5 verifies the migration is complete and correct
- Phase 6 performs cleanup and removes all legacy code
- The manual cleanup step (20.1) must be executed carefully with human oversight
- Property-based tests validate universal correctness properties from the design
- Integration tests validate end-to-end credit operation flows

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.2", "2.3", "3.1"] },
    { "id": 2, "tasks": ["1.4", "2.4", "2.5", "2.6", "3.2", "4.1"] },
    { "id": 3, "tasks": ["2.7", "2.8", "2.9", "6.1", "6.2", "6.3"] },
    { "id": 4, "tasks": ["6.4", "6.5", "6.6", "7.1"] },
    { "id": 5, "tasks": ["6.7", "7.2", "8.1"] },
    { "id": 6, "tasks": ["8.2", "10.1", "11.1"] },
    { "id": 7, "tasks": ["10.2", "11.2", "13.1", "14.1", "15.1", "15.2"] },
    { "id": 8, "tasks": ["17.1", "17.2", "17.3", "17.4", "17.5", "17.6"] },
    { "id": 9, "tasks": ["17.7", "17.8", "17.9", "17.10"] },
    { "id": 10, "tasks": ["19.1", "19.2"] },
    { "id": 11, "tasks": ["19.3", "20.1"] },
    { "id": 12, "tasks": ["21.1", "21.2"] },
    { "id": 13, "tasks": ["22.1", "22.2", "22.3"] }
  ]
}
```
