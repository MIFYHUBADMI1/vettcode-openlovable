/**
 * Read-only diagnostic: load the stored project and check its stored
 * specification against ApplicationSpecificationSchema to find exactly why
 * full-spec reparse fails on section updates.
 *
 * Usage: npx tsx --env-file=.env.local scripts/inspect-project-spec.ts <projectId>
 */
import { MongoClient } from "mongodb"
import { ApplicationSpecificationSchema } from "../lib/types/specification"
import { PlanAnalysisSchema } from "../lib/types/plan-analysis"

const projectId = process.argv[2]
if (!projectId) {
  console.error("Usage: npx tsx --env-file=.env.local scripts/inspect-project-spec.ts <projectId>")
  process.exit(1)
}
if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI not set")
  process.exit(1)
}

const client = new MongoClient(process.env.MONGODB_URI)

async function main() {
  await client.connect()
  const db = client.db()
  const col = db.collection("projects")
  const doc = await col.findOne({ $or: [{ _id: projectId as never }, { id: projectId }] })
  if (!doc) {
    console.log("No project found with id:", projectId)
    return
  }

  const record = doc as Record<string, unknown>
  console.log("Project:", record.name ?? "(unnamed)")
  const spec = record.specification as Record<string, unknown> | undefined
  if (!spec) {
    console.log("specification: <absent>")
    return
  }

  console.log("spec keys:", Object.keys(spec).join(", "))
  for (const key of Object.keys(spec)) {
    if (spec[key] === null) console.log("  NULL field:", key)
    if (spec[key] === undefined) console.log("  UNDEFINED field:", key)
  }
  console.log("complexity:", JSON.stringify(spec.complexity))
  console.log("targetUsers type:", Array.isArray(spec.targetUsers) ? "array" : typeof spec.targetUsers)

  const result = ApplicationSpecificationSchema.safeParse(spec)
  if (result.success) {
    console.log("RESULT: stored spec VALIDATES against current schema")
  } else {
    console.log("RESULT: stored spec FAILS schema:")
    for (const issue of result.error.issues) {
      console.log(`  - path: ${issue.path.join(".") || "(root)"} :: ${issue.code} :: ${issue.message}`)
    }
  }

  const analysis = record.planAnalysis
  if (analysis) {
    const a = PlanAnalysisSchema.safeParse(analysis)
    console.log(a.success ? "planAnalysis: OK" : `planAnalysis FAILS: ${a.error.issues.map((i) => i.path.join(".")).join(", ")}`)
  }
}

main()
  .then(() => client.close())
  .catch((e: Error) => {
    console.error(e.message)
    process.exit(1)
  })
