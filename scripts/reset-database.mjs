import { MongoClient } from "mongodb"

const names = [
  "users",
  "sessions",
  "verification_tokens",
  "rate_limits",
  "projects",
  "build_runs",
  "credit_transactions",
  "project_assets",
  "provider_usage",
]

const uri = process.env.MONGODB_URI
if (!uri) throw new Error("MONGODB_URI is not configured")

const client = new MongoClient(uri)
await client.connect()
try {
  const dbName = new URL(uri).pathname.slice(1) || undefined
  const db = client.db(dbName)
  const results = []
  for (const name of names) {
    const collection = db.collection(name)
    const result = await collection.deleteMany({})
    const remaining = await collection.countDocuments({})
    results.push({ collection: name, deleted: result.deletedCount, remaining })
  }
  console.table(results)
  if (results.some(({ remaining }) => remaining !== 0)) {
    throw new Error("Database reset verification failed")
  }
  console.log("Database reset verified: all application collections are empty.")
} finally {
  await client.close()
}
