import { getDb } from "@/lib/db/mongodb"
import type { UserDoc, SessionDoc, VerificationTokenDoc, RateLimitDoc, ProjectAssetDoc, ProviderUsageDoc } from "@/lib/types/db"
import type { MirrorProject, BuildRun, CreditTransaction } from "@/lib/types/project"

export async function usersCol() {
  return (await getDb()).collection<UserDoc>("users")
}
export async function sessionsCol() {
  return (await getDb()).collection<SessionDoc>("sessions")
}
export async function verificationTokensCol() {
  return (await getDb()).collection<VerificationTokenDoc>("verification_tokens")
}
export async function rateLimitsCol() {
  return (await getDb()).collection<RateLimitDoc>("rate_limits")
}
export async function projectsCol() {
  return (await getDb()).collection<MirrorProject & { _id?: unknown }>("projects")
}
export async function buildRunsCol() {
  return (await getDb()).collection<BuildRun & { _id?: unknown }>("build_runs")
}
export async function creditTransactionsCol() {
  return (await getDb()).collection<CreditTransaction & { _id?: unknown }>("credit_transactions")
}
export async function projectAssetsCol() {
  return (await getDb()).collection<ProjectAssetDoc>("project_assets")
}
export async function providerUsageCol() {
  return (await getDb()).collection<ProviderUsageDoc>("provider_usage")
}

let indexesEnsured = false

/**
 * Create indexes idempotently on first DB access (spec section 20). Mongo's
 * `createIndex` is a no-op if an equivalent index already exists, so this is
 * safe to call repeatedly and cheap after the first call per process.
 */
export async function ensureIndexes() {
  if (indexesEnsured) return
  indexesEnsured = true
  const [users, sessions, tokens, rateLimits, projects, buildRuns, creditTx, assets, usage] = await Promise.all([
    usersCol(),
    sessionsCol(),
    verificationTokensCol(),
    rateLimitsCol(),
    projectsCol(),
    buildRunsCol(),
    creditTransactionsCol(),
    projectAssetsCol(),
    providerUsageCol(),
  ])

  await Promise.all([
    users.createIndex({ email: 1 }, { unique: true }),
    users.createIndex({ googleId: 1 }, { sparse: true }),
    sessions.createIndex({ tokenHash: 1 }, { unique: true }),
    sessions.createIndex({ userId: 1 }),
    sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    tokens.createIndex({ tokenHash: 1 }, { unique: true }),
    tokens.createIndex({ userId: 1, purpose: 1 }),
    tokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    rateLimits.createIndex({ key: 1 }, { unique: true }),
    rateLimits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    projects.createIndex({ id: 1 }, { unique: true }),
    projects.createIndex({ userId: 1, updatedAt: -1 }),
    buildRuns.createIndex({ id: 1 }, { unique: true }),
    buildRuns.createIndex({ mirrorProjectId: 1, startedAt: -1 }),
    creditTx.createIndex({ id: 1 }, { unique: true }),
    creditTx.createIndex({ userId: 1, createdAt: -1 }),
    assets.createIndex({ id: 1 }, { unique: true }),
    assets.createIndex({ userId: 1, createdAt: -1 }),
    usage.createIndex({ id: 1 }, { unique: true }),
    usage.createIndex({ provider: 1, createdAt: -1 }),
  ]).catch((error) => {
    // Never continue a request against a partially initialized database. Reset
    // the guard so a later request can retry, then surface the outage.
    indexesEnsured = false
    throw error
  })
}
