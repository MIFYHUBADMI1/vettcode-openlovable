import { MongoClient } from "mongodb"

const uri = process.env.MONGODB_URI || "mongodb+srv://mixifyhub7_db_user:LBAKQWEV1SAwDXhR@vettcode.kycouyv.mongodb.net/?appName=vettcode"

async function main() {
  console.log("Cleaning up duplicate credit buckets...")
  const client = new MongoClient(uri)
  await client.connect()
  
  const db = client.db()
  const users = db.collection("users")
  
  const user = await users.findOne(
    { subscriptionCredits: { $gt: 0 } },
    { sort: { updatedAt: -1 } }
  )

  if (!user || !user.creditBuckets || user.creditBuckets.length === 0) {
    console.log("No buckets to clean")
    await client.close()
    return
  }

  console.log(`Found ${user.creditBuckets.length} buckets for ${user.email}`)
  
  // Group buckets by subscriptionId and keep only the most recently created one
  const bucketsBySubId = new Map()
  for (const bucket of user.creditBuckets) {
    const existing = bucketsBySubId.get(bucket.subscriptionId)
    if (!existing || bucket.createdAt > existing.createdAt) {
      bucketsBySubId.set(bucket.subscriptionId, bucket)
    }
  }

  const uniqueBuckets = Array.from(bucketsBySubId.values())
  console.log(`Keeping ${uniqueBuckets.length} unique buckets (removing ${user.creditBuckets.length - uniqueBuckets.length} duplicates)`)

  // Recalculate the correct totals
  const correctSubCredits = uniqueBuckets.reduce((sum, b) => sum + b.amount, 0)
  const correctTotal = correctSubCredits + (user.permanentCredits || 0)

  console.log(`Current totals: ${user.credits} total, ${user.subscriptionCredits} sub`)
  console.log(`Correct totals: ${correctTotal} total, ${correctSubCredits} sub`)

  if (uniqueBuckets.length === user.creditBuckets.length) {
    console.log("No duplicates found — nothing to clean")
  } else {
    await users.updateOne(
      { id: user.id },
      {
        $set: {
          creditBuckets: uniqueBuckets,
          subscriptionCredits: correctSubCredits,
          credits: correctTotal,
          updatedAt: Date.now()
        }
      }
    )
    console.log("✓ Database cleaned!")
  }

  await client.close()
}

main().catch(console.error)
