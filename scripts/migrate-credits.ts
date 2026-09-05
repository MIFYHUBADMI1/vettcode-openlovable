/**
 * Migration script: Split legacy `credits` into `subscriptionCredits` + `permanentCredits`.
 *
 * Run with: npx tsx scripts/migrate-credits.ts
 *
 * This migration:
 * 1. Finds users where subscriptionCredits/permanentCredits are not yet set
 * 2. Maps their existing `credits` balance to `permanentCredits` (legacy credits are permanent)
 * 3. Sets `subscriptionCredits` to 0
 * 4. Preserves the legacy `credits` field for backward compatibility
 *
 * Idempotent — safe to run multiple times.
 */

import { MongoClient } from "mongodb"

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI || typeof MONGODB_URI !== "string") {
  console.error("MONGODB_URI environment variable is required")
  process.exit(1)
}

async function migrate() {
  const client = new MongoClient(MONGODB_URI!)

  try {
    await client.connect()
    const db = client.db()
    const users = db.collection("users")

    // Find users that haven't been migrated yet
    const unmigrated = await users
      .find({
        $or: [
          { subscriptionCredits: { $exists: false } },
          { permanentCredits: { $exists: false } },
        ],
      })
      .toArray()

    console.log(`Found ${unmigrated.length} users to migrate`)

    let migrated = 0
    let skipped = 0

    for (const user of unmigrated) {
      const legacyCredits = user.credits ?? 0

      // Map legacy credits to permanent credits (they don't expire)
      const result = await users.updateOne(
        { _id: user._id },
        {
          $set: {
            subscriptionCredits: 0,
            permanentCredits: legacyCredits,
            updatedAt: Date.now(),
          },
        },
      )

      if (result.modifiedCount > 0) {
        migrated++
        console.log(`  Migrated ${user.id}: ${legacyCredits} credits → permanentCredits`)
      } else {
        skipped++
      }
    }

    console.log(`\nMigration complete: ${migrated} migrated, ${skipped} skipped`)

    // Verify no users are missing fields
    const remaining = await users.countDocuments({
      $or: [
        { subscriptionCredits: { $exists: false } },
        { permanentCredits: { $exists: false } },
      ],
    })

    if (remaining > 0) {
      console.warn(`Warning: ${remaining} users still missing fields`)
    } else {
      console.log("All users have subscriptionCredits and permanentCredits fields")
    }
  } finally {
    await client.close()
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
