import { MongoClient } from "mongodb"

const uri = process.env.MONGODB_URI || "mongodb+srv://mixifyhub7_db_user:LBAKQWEV1SAwDXhR@vettcode.kycouyv.mongodb.net/?appName=vettcode"

async function main() {
  console.log("Connecting to MongoDB...")
  const client = new MongoClient(uri)
  await client.connect()
  
  const db = client.db()
  const user = await db.collection("users").findOne(
    { subscriptionCredits: { $gt: 0 } },
    { sort: { updatedAt: -1 } }
  )

  if (!user) {
    console.log("No user found")
    await client.close()
    return
  }

  console.log("\n=== USER ===")
  console.log("Email:", user.email)
  console.log("Total credits:", user.credits)
  console.log("Subscription:", user.subscriptionCredits)
  console.log("Permanent:", user.permanentCredits)
  
  console.log("\n=== CREDIT BUCKETS ===")
  if (user.creditBuckets && user.creditBuckets.length > 0) {
    for (const b of user.creditBuckets) {
      console.log(`Plan: ${b.planId}, Amount: ${b.amount}/${b.originalAmount}, Sub: ${b.subscriptionId}`)
      console.log(`  Expires: ${new Date(b.expiresAt).toLocaleString()}`)
    }
  } else {
    console.log("NO BUCKETS FOUND")
  }

  console.log("\n=== RECENT LEDGER (last 15) ===")
  const entries = await db.collection("credit_ledger")
    .find({ userId: user.id })
    .sort({ createdAt: -1 })
    .limit(15)
    .toArray()
  
  for (const e of entries) {
    const sign = e.direction === "credit" ? "+" : "-"
    console.log(`${sign}${e.amount} ${e.creditType} - ${e.transactionType}`)
    console.log(`  ${new Date(e.createdAt).toLocaleString()} - ${e.balanceBefore} -> ${e.balanceAfter}`)
    console.log(`  Key: ${e.idempotencyKey}`)
  }

  await client.close()
}

main().catch(console.error)
