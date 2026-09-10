# Credit Transactions Cleanup Execution Guide

## Overview

This guide documents the manual execution of the database cleanup script that removes the legacy `credit_transactions` collection after the migration to the unified `credit_ledger` system.

## Prerequisites

Before running the cleanup script, ensure that:

1. ✅ All Phase 1-5 tasks are complete
2. ✅ All code has been refactored to use credit-service instead of direct collection access
3. ✅ The `credit_ledger` collection exists and contains entries
4. ✅ All tests pass successfully
5. ✅ The system has been running in production with the new ledger system for at least 48 hours
6. ✅ You have verified no code is writing to `credit_transactions` collection

## Pre-Cleanup Checklist

Run these verification commands before executing the cleanup:

```bash
# 1. Search for any remaining references to creditTransactionsCol
grep -r "creditTransactionsCol" lib/ app/ --exclude-dir=node_modules

# 2. Verify credit_ledger has entries
# (This will be checked by the script, but good to verify manually)
# Connect to MongoDB and run:
# db.credit_ledger.countDocuments()

# 3. Check that all tests pass
npm test

# 4. Verify the cleanup script exists
ls -la scripts/cleanup-credit-transactions.ts
```

## Execution Steps

### Step 1: Review the Script

Read through the cleanup script to understand what it will do:

```bash
cat scripts/cleanup-credit-transactions.ts
```

The script will:
1. Verify `credit_ledger` exists and has data
2. Count documents in `credit_transactions`
3. Create a backup in `backups/credit_transactions_backup_[timestamp].json`
4. Prompt for confirmation
5. Drop the `credit_transactions` collection
6. Verify deletion
7. Generate a cleanup report

### Step 2: Run the Cleanup Script

Execute the script using npm:

```bash
npm run cleanup:credit-transactions
```

**Expected Output:**

```
=== Credit Transactions Cleanup Script ===

This script will remove the legacy credit_transactions collection.
All credit operations should now use the unified credit_ledger system.

Step 1: Verifying credit_ledger collection...
✓ credit_ledger contains [X] entries

Step 2: Checking credit_transactions collection...
Found [Y] documents in credit_transactions

Step 3: Creating backup...
✓ Backup created: backups/credit_transactions_backup_[timestamp].json
  Size: [X.XX] MB

=== Cleanup Summary ===
Documents to delete: [Y]
Backup location: backups/credit_transactions_backup_[timestamp].json
credit_ledger entries: [X]

⚠️  WARNING: This operation is irreversible!
   The credit_transactions collection will be permanently removed.

Type 'DELETE' to confirm deletion, or anything else to cancel:
```

### Step 3: Confirm Deletion

When prompted, carefully review the summary statistics. If everything looks correct, type exactly:

```
DELETE
```

**Note:** The input is case-sensitive. Anything other than `DELETE` will cancel the operation.

### Step 4: Verify Completion

After successful deletion, the script will output:

```
Step 5: Dropping credit_transactions collection...
✓ Collection dropped successfully

Step 6: Verifying deletion...
✓ Verified: credit_transactions collection no longer exists

=== Cleanup Complete ===
Report saved to: backups/cleanup_report_[timestamp].json

Next steps:
1. Remove creditTransactionsCol from lib/db/collections.ts
2. Update ensureIndexes function to remove credit_transactions references
3. Run tests to verify everything works correctly
```

### Step 5: Review the Cleanup Report

Check the cleanup report for full details:

```bash
cat backups/cleanup_report_[timestamp].json
```

The report contains:
- Timestamp of cleanup execution
- Number of documents deleted
- Backup file location
- Success/failure status
- Any errors encountered

## Post-Cleanup Steps

After successful cleanup execution:

1. **Remove Legacy Code References** (Task 21.1)
   - Remove `creditTransactionsCol` function from `lib/db/collections.ts`
   - Remove credit_transactions indexes from `ensureIndexes` function

2. **Verify Application Still Works**
   ```bash
   # Run all tests
   npm test
   
   # Start dev server and test manually
   npm run dev
   ```

3. **Monitor Production**
   - Watch error logs for any issues
   - Monitor credit operations
   - Check admin ledger viewer works correctly

4. **Archive Backup**
   - Store the backup file in a secure location
   - Document the backup location for future reference
   - Keep the backup for at least 90 days

## Rollback Procedure

If issues are discovered after cleanup:

1. **Stop All Credit Operations**
   - Put the application in maintenance mode if possible

2. **Restore the Collection**
   ```javascript
   // Connect to MongoDB and run:
   const fs = require('fs');
   const backup = JSON.parse(fs.readFileSync('backups/credit_transactions_backup_[timestamp].json'));
   db.credit_transactions.insertMany(backup);
   ```

3. **Verify Restoration**
   ```javascript
   // Check document count matches backup
   db.credit_transactions.countDocuments()
   ```

4. **Investigate Issues**
   - Review error logs
   - Check what code was still accessing the collection
   - Fix any remaining references

5. **Re-run Verification**
   - Complete Phase 5 verification checklist again
   - Ensure all code uses credit-service

## Troubleshooting

### Script Won't Run

**Error:** `Command not found: tsx`

**Solution:**
```bash
npm install --save-dev tsx
```

### Empty Ledger Collection

**Error:** `credit_ledger collection is empty`

**Solution:**
- This means the migration hasn't been completed
- Check that credit-service is being used for all operations
- Run the application and perform some credit operations
- Verify entries are being created in credit_ledger

### Backup File Too Large

**Issue:** Backup file is very large and causing issues

**Solution:**
- The script creates a JSON backup, which can be large
- Consider manually exporting to compressed format first
- Use MongoDB's dump tools: `mongodump --collection credit_transactions`

### Cleanup Cancelled

**Issue:** Accidentally cancelled the cleanup

**Solution:**
- Simply run the script again
- The script is idempotent and can be safely re-executed
- Each run creates a new backup with a timestamp

## Safety Notes

- ⚠️ **Never run this script without a full database backup**
- ⚠️ **Always run in a staging environment first**
- ⚠️ **Verify all tests pass before production cleanup**
- ⚠️ **Have a rollback plan ready**
- ⚠️ **Coordinate with team before running in production**
- ⚠️ **Run during low-traffic periods**

## Cleanup Completion Checklist

- [ ] Cleanup script executed successfully
- [ ] Backup file created and verified
- [ ] credit_transactions collection no longer exists
- [ ] Cleanup report generated
- [ ] Application still functions correctly
- [ ] Admin ledger viewer displays data properly
- [ ] All tests pass
- [ ] No errors in production logs
- [ ] Backup archived securely
- [ ] Documentation updated
- [ ] Team notified of completion

## Contact

If you encounter any issues during cleanup:
1. Stop immediately
2. Do not proceed with deletion
3. Review the troubleshooting section
4. Consult with the development team
5. Check verification checklist for missed steps

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Related Spec:** credit-ledger-migration
