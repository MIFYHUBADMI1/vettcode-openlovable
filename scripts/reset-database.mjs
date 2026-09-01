import { MongoClient } from "mongodb"

const uri = process.env.MONGODB_URI
if (!uri) throw new Error("MONGODB_URI is not configured")

const client = new MongoClient(uri)
await client.connect()
try {
  const dbName = new URL(uri).pathname.slice(1) || undefined
  const db = client.db(dbName)

  const collections = await db.listCollections().toArray()
  if (collections.length === 0) {
    console.log("Database is already empty — no collections found.")
    process.exit(0)
  }

  const results = []
  for (const { name } of collections) {
    const before = await db.collection(name).countDocuments({})
    await db.collection(name).drop()
    results.push({ collection: name, documents_before: before, status: "dropped" })
  }

  console.table(results)
  console.log(`\nDropped ${results.length} collection(s). Database is now empty.`)
} finally {
  await client.close()
}
