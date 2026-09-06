# Requirements Document

## Introduction

This specification defines the migration from the legacy single-entry credit transaction system (`credit_transactions` collection) to the unified double-entry ledger system (`credit_ledger` collection). The migration encompasses three main areas: updating the admin UI to display ledger data, refactoring all code that directly accesses the old collection to use the centralized credit-service, and establishing a clean cutover process that starts fresh from the migration date without backward data migration.

## Glossary

- **Legacy_System**: The existing single-entry credit transaction system using the `credit_transactions` collection
- **Ledger_System**: The new double-entry credit ledger system using the `credit_ledger` collection
- **Admin_UI**: The administrative web interface for viewing credit transaction data
- **MongoStore**: The MongoDB data store class (`lib/store/mongo-store.ts`) that provides data persistence operations
- **Credit_Service**: The centralized credit service (`lib/billing/credit-service.ts`) that manages all credit operations
- **Migration_Date**: The timestamp when the system cutover occurs from Legacy_System to Ledger_System
- **Cutover**: The process of switching from Legacy_System to Ledger_System without migrating historical data
- **Admin_Ledger_Viewer**: The new admin UI component for viewing Ledger_System entries

## Requirements

### Requirement 1: Admin Ledger Viewer Features

**User Story:** As an administrator, I want to view credit ledger entries with comprehensive filtering, pagination, and export capabilities, so that I can audit credit operations and analyze user activity.

#### Acceptance Criteria

1.1. THE Admin_Ledger_Viewer SHALL display ledger entries from the `credit_ledger` collection only

1.2. THE Admin_Ledger_Viewer SHALL NOT display entries from the `credit_transactions` collection

1.3. THE Admin_Ledger_Viewer SHALL display the following fields for each ledger entry: user identifier, user name, user email, credit type (subscription or permanent), amount, direction (credit or debit), transaction type, reference type, reference identifier, balance before, balance after, timestamp, and idempotency key

1.4. THE Admin_Ledger_Viewer SHALL support filtering by user identifier

1.5. THE Admin_Ledger_Viewer SHALL support filtering by credit type with options for subscription and permanent

1.6. THE Admin_Ledger_Viewer SHALL support filtering by transaction type with options including signup_bonus, referral_bonus, subscription_grant, subscription_expiration, build_reservation, build_consumption, build_release, topup_grant, admin_adjustment, and refund

1.7. THE Admin_Ledger_Viewer SHALL support filtering by direction with options for credit and debit

1.8. THE Admin_Ledger_Viewer SHALL support filtering by date range with start date and end date inputs

1.9. THE Admin_Ledger_Viewer SHALL implement pagination with configurable page size of 25, 50, 100, or 200 entries per page

1.10. THE Admin_Ledger_Viewer SHALL display the current page number and total page count

1.11. THE Admin_Ledger_Viewer SHALL provide navigation controls for first page, previous page, next page, and last page

1.12. THE Admin_Ledger_Viewer SHALL display summary statistics including total entries count, total credits granted, and total debits charged

1.13. THE Admin_Ledger_Viewer SHALL support exporting filtered results to CSV format

1.14. THE Admin_Ledger_Viewer SHALL include all visible columns in the CSV export

1.15. THE Admin_Ledger_Viewer SHALL apply active filters to the CSV export

1.16. THE Admin_Ledger_Viewer SHALL sort entries by creation timestamp in descending order by default

1.17. THE Admin_Ledger_Viewer SHALL allow sorting by timestamp, amount, and user identifier in ascending or descending order

1.18. THE Admin_Ledger_Viewer SHALL display a search input that filters across user name, user email, reason, and reference identifier fields

1.19. THE Admin_Ledger_Viewer SHALL refresh data every 15 seconds automatically

1.20. WHEN no entries match the active filters, THE Admin_Ledger_Viewer SHALL display an empty state message

### Requirement 2: Admin API Endpoints

**User Story:** As a system component, I want a REST API endpoint that serves ledger data with query parameters for filtering and pagination, so that the Admin_UI can retrieve and display credit transactions.

#### Acceptance Criteria

2.1. THE System SHALL provide a GET endpoint at `/api/admin/ledger`

2.2. WHEN a request is received at `/api/admin/ledger`, THE System SHALL require admin authentication

2.3. IF the requester is not authenticated as an admin, THEN THE System SHALL return a 403 Forbidden response

2.4. THE System SHALL accept a `userId` query parameter to filter entries by user identifier

2.5. THE System SHALL accept a `creditType` query parameter with valid values of subscription or permanent

2.6. THE System SHALL accept a `transactionType` query parameter to filter by transaction type

2.7. THE System SHALL accept a `direction` query parameter with valid values of credit or debit

2.8. THE System SHALL accept a `startDate` query parameter as a Unix timestamp in milliseconds

2.9. THE System SHALL accept an `endDate` query parameter as a Unix timestamp in milliseconds

2.10. THE System SHALL accept a `page` query parameter as a positive integer starting from 1

2.11. THE System SHALL accept a `limit` query parameter with valid values of 25, 50, 100, or 200

2.12. WHEN the `limit` query parameter is not provided, THE System SHALL default to 50 entries per page

2.13. THE System SHALL query the `credit_ledger` collection with filters constructed from the query parameters

2.14. THE System SHALL sort query results by `createdAt` field in descending order

2.15. THE System SHALL apply pagination using skip and limit operations

2.16. THE System SHALL enrich ledger entries with user name and user email from the `users` collection

2.17. THE System SHALL return a JSON response containing an array of ledger entries and pagination metadata

2.18. THE System SHALL include total count, current page, total pages, and page size in pagination metadata

2.19. THE System SHALL NOT query the `credit_transactions` collection

2.20. IF the query execution fails, THEN THE System SHALL return a 500 Internal Server Error response with an error message

### Requirement 3: MongoStore Refactoring

**User Story:** As a developer, I want MongoStore to delegate all credit operations to Credit_Service instead of directly manipulating credit balances, so that the system maintains a single authoritative source for credit management.

#### Acceptance Criteria

3.1. THE MongoStore SHALL NOT directly query the `credit_transactions` collection

3.2. THE MongoStore SHALL NOT directly update user credit balances in the `users` collection

3.3. THE MongoStore SHALL NOT implement credit transaction insertion logic

3.4. WHEN `getBalance` is called, THE MongoStore SHALL invoke `getAvailableCredits` from Credit_Service

3.5. WHEN `listTransactions` is called, THE MongoStore SHALL invoke `getCreditHistory` from Credit_Service

3.6. WHEN `addTransaction` is called, THE MongoStore SHALL invoke the appropriate Credit_Service function based on transaction type

3.7. WHEN `reserveCreditsAtomic` is called, THE MongoStore SHALL invoke `reserveCredits` from Credit_Service

3.8. THE MongoStore SHALL remove the import statement for `creditTransactionsCol`

3.9. THE MongoStore SHALL add an import statement for Credit_Service functions

3.10. THE MongoStore SHALL preserve the method signatures of `getBalance`, `listTransactions`, `addTransaction`, and `reserveCreditsAtomic`

3.11. THE MongoStore SHALL maintain backward compatibility with existing callers

3.12. THE MongoStore SHALL remove direct MongoDB transaction logic for credit operations

3.13. THE MongoStore SHALL retain cache invalidation logic for balance and transaction list caches

3.14. WHEN a Credit_Service operation fails, THE MongoStore SHALL propagate the error to the caller

3.15. THE MongoStore SHALL NOT contain any direct references to `credit_transactions` collection after refactoring

### Requirement 4: Legacy Code Migration

**User Story:** As a system maintainer, I want all code that directly accesses the `credit_transactions` collection to be refactored to use Credit_Service, so that credit operations are consistent and maintainable.

#### Acceptance Criteria

4.1. THE System SHALL identify all files that import `creditTransactionsCol` from `lib/db/collections`

4.2. THE System SHALL refactor `lib/referrals/referrals.ts` to use Credit_Service functions instead of direct collection access

4.3. THE System SHALL refactor `lib/infrastructure/service.ts` to use Credit_Service functions instead of direct collection access

4.4. THE System SHALL refactor `lib/billing/topup-service.ts` to use Credit_Service functions instead of direct collection access

4.5. THE System SHALL refactor `lib/auth/users.ts` to use Credit_Service functions instead of direct collection access

4.6. THE System SHALL refactor `app/api/admin/users/[id]/route.ts` to use Credit_Service functions for transaction retrieval

4.7. THE System SHALL refactor `app/api/admin/self-credits/route.ts` to use Credit_Service functions instead of direct collection access

4.8. THE System SHALL refactor `app/api/admin/billing/user-billing/route.ts` to use Credit_Service functions for transaction retrieval

4.9. THE System SHALL refactor `app/api/admin/billing/audit-log/route.ts` to use Credit_Service functions for transaction retrieval

4.10. THE System SHALL remove all direct `insertOne` operations on `credit_transactions` collection

4.11. THE System SHALL remove all direct `find` operations on `credit_transactions` collection

4.12. THE System SHALL remove all direct `updateOne` operations on `credit_transactions` collection

4.13. WHEN refactoring credit grant operations, THE System SHALL use `grantCredits` from Credit_Service with appropriate idempotency keys

4.14. WHEN refactoring transaction retrieval, THE System SHALL use `getCreditHistory` from Credit_Service

4.15. THE System SHALL preserve existing business logic and idempotency guarantees

4.16. THE System SHALL maintain existing error handling patterns

4.17. THE System SHALL update import statements to reference Credit_Service instead of creditTransactionsCol

4.18. THE System SHALL ensure all refactored operations use proper idempotency keys

4.19. THE System SHALL verify that all MongoDB transactions involving credit operations are removed in favor of Credit_Service transactions

4.20. IF a file uses both legacy and ledger systems during migration, THEN THE System SHALL document the transition logic with inline comments

### Requirement 5: Admin Transactions Endpoint Migration

**User Story:** As a system component, I want the existing `/api/admin/transactions` endpoint to be replaced with the new ledger endpoint, so that the admin UI seamlessly transitions to the new system.

#### Acceptance Criteria

5.1. THE System SHALL update the endpoint at `/api/admin/transactions` to query the `credit_ledger` collection

5.2. THE System SHALL remove all references to `creditTransactionsCol` from `/api/admin/transactions/route.ts`

5.3. THE System SHALL add an import for `creditLedgerCol` to `/api/admin/transactions/route.ts`

5.4. THE System SHALL maintain the existing response structure with fields: id, userId, userName, userEmail, type, amount, reason, createdAt

5.5. THE System SHALL map ledger `transactionType` field to response `type` field

5.6. THE System SHALL map ledger `metadata.reason` field to response `reason` field when available

5.7. WHEN `metadata.reason` is not present, THE System SHALL use the `transactionType` value as the reason

5.8. THE System SHALL compute the signed amount by combining ledger `amount` and `direction` fields

5.9. WHEN direction is credit, THE System SHALL return a positive amount

5.10. WHEN direction is debit, THE System SHALL return a negative amount

5.11. THE System SHALL continue to sort results by `createdAt` in descending order

5.12. THE System SHALL continue to limit results to 200 entries

5.13. THE System SHALL continue to enrich entries with user information from the `users` collection

5.14. THE System SHALL maintain admin authentication requirements

5.15. THE System SHALL preserve error handling patterns

### Requirement 6: Admin UI Component Updates

**User Story:** As an administrator, I want the existing transactions page to display the new ledger format with additional fields, so that I have visibility into the double-entry accounting details.

#### Acceptance Criteria

6.1. THE System SHALL update `app/admin/transactions/page.tsx` to display credit type for each entry

6.2. THE System SHALL update `app/admin/transactions/page.tsx` to display direction for each entry

6.3. THE System SHALL update `app/admin/transactions/page.tsx` to display balance before for each entry

6.4. THE System SHALL update `app/admin/transactions/page.tsx` to display balance after for each entry

6.5. THE System SHALL display credit type with visual distinction between subscription and permanent

6.6. THE System SHALL display direction with visual distinction between credit and debit

6.7. THE System SHALL use an upward arrow icon for credit direction entries

6.8. THE System SHALL use a downward arrow icon for debit direction entries

6.9. THE System SHALL apply green color styling to credit entries

6.10. THE System SHALL apply red color styling to debit entries

6.11. THE System SHALL display balance values in a monospace font

6.12. THE System SHALL format balance values with thousands separators

6.13. THE System SHALL maintain the existing search functionality across user and reason fields

6.14. THE System SHALL maintain the existing summary statistics display

6.15. THE System SHALL update summary calculations to use direction and amount fields from ledger entries

### Requirement 7: Database Cleanup

**User Story:** As a system administrator, I want the old `credit_transactions` collection to be safely deleted after migration verification, so that the database does not contain redundant legacy data.

#### Acceptance Criteria

7.1. THE System SHALL provide a manual database cleanup script

7.2. THE Script SHALL be located at `scripts/cleanup-legacy-credit-transactions.ts`

7.3. THE Script SHALL require explicit confirmation before executing deletion

7.4. THE Script SHALL verify that the `credit_ledger` collection exists and contains entries

7.5. WHEN the `credit_ledger` collection is empty, THE Script SHALL abort with an error message

7.6. THE Script SHALL display the count of documents in the `credit_transactions` collection before deletion

7.7. THE Script SHALL prompt the administrator with a confirmation message showing the count

7.8. IF the administrator confirms, THEN THE Script SHALL drop the `credit_transactions` collection

7.9. IF the administrator cancels, THEN THE Script SHALL exit without making changes

7.10. THE Script SHALL log the deletion operation with timestamp and document count

7.11. THE Script SHALL verify the collection no longer exists after deletion

7.12. THE Script SHALL create a backup export of `credit_transactions` collection before deletion

7.13. THE Script SHALL save the backup to `backups/credit_transactions_backup_[timestamp].json`

7.14. THE Script SHALL NOT execute automatically on deployment

7.15. THE Script SHALL include usage instructions in inline comments

7.16. THE System SHALL remove the `creditTransactionsCol` function from `lib/db/collections.ts` after cleanup

7.17. THE System SHALL remove the `credit_transactions` collection type definition after cleanup

7.18. THE System SHALL remove index creation logic for `credit_transactions` collection after cleanup

7.19. THE System SHALL update the `ensureIndexes` function to remove references to creditTx variable after cleanup

7.20. THE System SHALL document the cleanup procedure in a migration guide

### Requirement 8: Migration Verification Checklist

**User Story:** As a system administrator, I want a comprehensive verification checklist to validate the migration, so that I can ensure the system operates correctly after the cutover.

#### Acceptance Criteria

8.1. THE System SHALL provide a migration verification checklist document

8.2. THE Checklist SHALL be located at `.kiro/specs/credit-ledger-migration/verification-checklist.md`

8.3. THE Checklist SHALL include verification steps for admin UI functionality

8.4. THE Checklist SHALL include verification steps for MongoStore delegation

8.5. THE Checklist SHALL include verification steps for Credit_Service operation

8.6. THE Checklist SHALL include verification steps for API endpoint responses

8.7. THE Checklist SHALL include verification steps for data consistency

8.8. THE Checklist SHALL include verification steps for legacy code removal

8.9. THE Checklist SHALL specify manual testing procedures for the Admin_Ledger_Viewer

8.10. THE Checklist SHALL specify API endpoint test cases with example requests and expected responses

8.11. THE Checklist SHALL specify database queries to verify ledger data integrity

8.12. THE Checklist SHALL specify commands to search for remaining references to `credit_transactions`

8.13. THE Checklist SHALL include a rollback procedure in case of migration failure

8.14. THE Checklist SHALL document expected behavior for new credit operations after Migration_Date

8.15. THE Checklist SHALL document expected behavior when querying historical data from before Migration_Date

8.16. THE Checklist SHALL include performance validation steps to ensure query response times are acceptable

8.17. THE Checklist SHALL include a section for verifying cache invalidation behavior

8.18. THE Checklist SHALL include a section for verifying error handling and logging

8.19. THE Checklist SHALL specify acceptance criteria for considering the migration complete

8.20. THE Checklist SHALL specify post-migration monitoring requirements for the first 48 hours

### Requirement 9: Code Quality and Documentation

**User Story:** As a developer, I want clear inline documentation and type safety for all refactored code, so that future maintenance is straightforward.

#### Acceptance Criteria

9.1. THE System SHALL add JSDoc comments to all new public methods

9.2. THE System SHALL add inline comments explaining the delegation pattern in MongoStore

9.3. THE System SHALL add inline comments marking removed legacy code sections

9.4. THE System SHALL maintain TypeScript type safety for all function signatures

9.5. THE System SHALL NOT use `any` types in refactored code

9.6. THE System SHALL export proper interfaces for ledger entry types

9.7. THE System SHALL document idempotency requirements in function comments

9.8. THE System SHALL document error handling expectations in function comments

9.9. THE System SHALL include example usage in JSDoc comments for complex operations

9.10. THE System SHALL update README documentation to reference the new ledger system

9.11. THE System SHALL document the credit consumption order in Credit_Service

9.12. THE System SHALL document the double-entry ledger principles in Credit_Service

9.13. THE System SHALL add migration notes to the CHANGELOG

9.14. THE System SHALL document breaking changes if any public APIs are affected

9.15. THE System SHALL add deprecation notices to any temporarily preserved legacy functions

### Requirement 10: Cutover Process

**User Story:** As a system operator, I want a clean cutover from the legacy system to the ledger system at a defined migration date, so that the transition is predictable and verifiable.

#### Acceptance Criteria

10.1. THE System SHALL establish a Migration_Date configuration value

10.2. THE Migration_Date SHALL be stored in environment configuration

10.3. WHEN the current date is before Migration_Date, THE System SHALL continue using Legacy_System for backward compatibility reads

10.4. WHEN the current date is on or after Migration_Date, THE System SHALL use Ledger_System exclusively

10.5. THE System SHALL NOT migrate historical data from `credit_transactions` to `credit_ledger`

10.6. THE System SHALL record all new credit operations to `credit_ledger` collection only after Migration_Date

10.7. THE System SHALL NOT write to `credit_transactions` collection after Migration_Date

10.8. WHEN a user views their transaction history after Migration_Date, THE System SHALL display only transactions created after Migration_Date

10.9. THE Admin_UI SHALL display a notice indicating that historical data before Migration_Date is not shown

10.10. THE System SHALL log the Migration_Date and cutover status during startup

10.11. THE System SHALL validate that Migration_Date is a valid Unix timestamp in milliseconds

10.12. IF Migration_Date is not configured, THEN THE System SHALL default to immediate cutover behavior

10.13. THE System SHALL document the cutover process in operator documentation

10.14. THE System SHALL provide a script to validate system readiness before Migration_Date

10.15. THE System SHALL provide monitoring alerts if any code attempts to write to `credit_transactions` after Migration_Date

### Requirement 11: Testing Requirements

**User Story:** As a quality assurance engineer, I want comprehensive test coverage for the migration, so that regressions are caught before production deployment.

#### Acceptance Criteria

11.1. THE System SHALL provide unit tests for MongoStore delegation methods

11.2. THE System SHALL provide integration tests for the `/api/admin/ledger` endpoint

11.3. THE System SHALL provide integration tests for the updated `/api/admin/transactions` endpoint

11.4. THE System SHALL provide unit tests for Credit_Service idempotency guarantees

11.5. THE System SHALL provide tests verifying that no code writes to `credit_transactions` collection

11.6. THE System SHALL provide tests verifying that MongoStore delegates to Credit_Service

11.7. THE System SHALL provide tests for pagination logic in the admin ledger endpoint

11.8. THE System SHALL provide tests for filtering logic in the admin ledger endpoint

11.9. THE System SHALL provide tests for CSV export functionality

11.10. THE System SHALL provide end-to-end tests for the complete credit grant flow using Ledger_System

11.11. THE System SHALL provide end-to-end tests for the complete credit consumption flow using Ledger_System

11.12. THE System SHALL provide tests for error handling when Credit_Service operations fail

11.13. THE System SHALL provide tests verifying cache invalidation after credit operations

11.14. THE System SHALL provide tests for the database cleanup script

11.15. THE System SHALL achieve at least 90% code coverage for refactored modules

### Requirement 12: Backward Compatibility

**User Story:** As a system integrator, I want preserved interfaces and graceful handling of legacy data references, so that existing integrations continue to function during and after migration.

#### Acceptance Criteria

12.1. THE MongoStore SHALL maintain the same public method signatures after refactoring

12.2. THE System SHALL return empty arrays when querying for pre-Migration_Date transactions

12.3. THE System SHALL NOT throw errors when legacy transaction references are encountered

12.4. THE Admin_UI SHALL handle missing user information gracefully

12.5. THE System SHALL convert legacy transaction types to equivalent ledger transaction types where possible

12.6. THE System SHALL preserve existing API response formats for the `/api/admin/transactions` endpoint

12.7. THE System SHALL maintain existing error codes and error messages

12.8. THE System SHALL preserve existing authentication and authorization logic

12.9. THE System SHALL NOT require database schema migrations for user-facing collections

12.10. THE System SHALL handle edge cases where user credit balances predate Migration_Date
