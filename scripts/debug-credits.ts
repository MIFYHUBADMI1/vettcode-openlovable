import { getMongoClient } from "../lib/db/mongodb"

async function main() {
  console.log("Credit System Diagnostic\n")
  
  const client = await getMongoClient()
  const db = client.db()
  
  try {
    const user = await db.collection("users").findOne(
      { subscriptionCredits: { $gt: 0 } },
      { sort: { updatedAt: -1 } }
    )

    if (!user) {
      console.log("No users with subscription credits found")
      return
    }

    console.log("User:", user.email)
    console.log("Total credits:", user.credits)
    console.log("Subscription credits:", user.subscriptionCredits)
    console.log("Permanent credits:", user.permanentCredits)
    console.log("\nCredit Buckets:")
    console.log(JSON.stringify(user.creditBuckets, null, 2))
    
    console.log("\n\nRecent Ledger Entries:")
    const entries = await db.collection("credit_ledger")
      .find({ userId: user.id })
      .sort({ createdAt: -1 })
      .limit(15)
      .toArray()
    
    for (const e of entries) {
      const sign = e.direction === "credit" ? "+" : "-"
      console.log(`${sign}${e.amount} ${e.creditType} - ${e.transactionType}`)
      console.log(`  ${new Date(e.createdAt).toLocaleString()}`)
      console.log(`  Key: ${e.idempotencyKey}`)
      console.log(`  Balance: ${e.balanceBefore} -> ${e.balanceAfter}\n`)
    }

    console.log("\nSubscriptions:")
    const subs = await db.collection("subscription_records")
      .find({ userId: user.id })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray()
    
    for (const s of subs) {
      console.log(`${s.planName} (${s.planId}) - ${s.status}`)
      console.log(`  Sub ID: ${s.dodoSubscriptionId}`)
      console.log(`  Period: ${new Date(s.currentPeriodStart).toLocaleDateString()} - ${new Date(s.currentPeriodEnd).toLocaleDateString()}\n`)
    }

  } finally {
    await client.close()
  }
}

main().catch(console.error)
