import { MongoClient, ObjectId } from "mongodb"
import bcrypt from "bcryptjs"
import { randomBytes } from "node:crypto"

const uri = process.env.MONGODB_URI
if (!uri) throw new Error("MONGODB_URI is not configured")

const ADMIN_EMAIL = "admin@mirrorsite.ai"
const ADMIN_PASSWORD = "password@admin@mirrorsite.ai"
const ADMIN_NAME = "Admin"
const ADMIN_CREDITS = 0 // no starting credits — admin tops up like everyone else

const client = new MongoClient(uri)
await client.connect()
try {
  const dbName = new URL(uri).pathname.slice(1) || undefined
  const db = client.db(dbName)

  // Check if admin already exists
  const existing = await db.collection("users").findOne({ email: ADMIN_EMAIL })
  if (existing) {
    console.log(`Admin user ${ADMIN_EMAIL} already exists (id: ${existing.id}). Updating...`)

    // Update password hash, credits, and admin flag
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12)
    await db.collection("users").updateOne(
      { email: ADMIN_EMAIL },
      {
        $set: {
          passwordHash,
          credits: ADMIN_CREDITS,
          isAdmin: true,
          emailVerified: true,
          updatedAt: Date.now(),
        },
      },
    )
    console.log("Admin user updated successfully.")
  } else {
    // Create new admin user
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12)
    const id = `user_${randomBytes(12).toString("hex")}`
    const now = Date.now()

    const doc = {
      _id: new ObjectId(),
      id,
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      passwordHash,
      authProvider: "password",
      emailVerified: true,
      credits: ADMIN_CREDITS,
      isAdmin: true,
      createdAt: now,
      updatedAt: now,
    }

    await db.collection("users").insertOne(doc)

    console.log(`Admin user created:`)
    console.log(`  Email:    ${ADMIN_EMAIL}`)
    console.log(`  Password: ${ADMIN_PASSWORD}`)
    console.log(`  User ID:  ${id}`)
    console.log(`  Credits:  ${ADMIN_CREDITS.toLocaleString()}`)
    console.log(`  Admin:    true`)
    console.log(`  Verified: true`)
  }
} finally {
  await client.close()
}
