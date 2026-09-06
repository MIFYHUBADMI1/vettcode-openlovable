import { getDb } from "@/lib/db/mongodb"
import type { UserDoc, SessionDoc, VerificationTokenDoc, RateLimitDoc, ProjectAssetDoc, ProviderUsageDoc, TopUpDoc, PublishEventDoc, ReferralDoc, DocFeedbackDoc, WebhookEventDoc } from "@/lib/types/db"
import type { MirrorProject, BuildRun, CreditTransaction } from "@/lib/types/project"
import type { CreditLedgerEntry, BuildAuthorization, PaymentRecord, SubscriptionRecord } from "@/lib/billing/billing-types"

/** Cache the Db reference across hot reloads so we don't re-resolve per call. */
const globalForDb = globalThis as unknown as { __mirrorDb?: Awaited<ReturnType<typeof getDb>> }
let dbReady = false

async function getDbCached() {
  if (!globalForDb.__mirrorDb) globalForDb.__mirrorDb = await getDb()
  // Ensure indexes once after the first connection — never block requests
  // after the initial call.
  if (!dbReady) {
    dbReady = true
    ensureIndexes().catch((e) => console.error("[v0] ensureIndexes: startup failed", e))
  }
  return globalForDb.__mirrorDb
}

export async function usersCol() {
  return (await getDbCached()).collection<UserDoc>("users")
}
export async function sessionsCol() {
  return (await getDbCached()).collection<SessionDoc>("sessions")
}
export async function verificationTokensCol() {
  return (await getDbCached()).collection<VerificationTokenDoc>("verification_tokens")
}
export async function rateLimitsCol() {
  return (await getDbCached()).collection<RateLimitDoc>("rate_limits")
}
export async function projectsCol() {
  return (await getDbCached()).collection<MirrorProject & { _id?: unknown }>("projects")
}
export async function buildRunsCol() {
  return (await getDbCached()).collection<BuildRun & { _id?: unknown }>("build_runs")
}
export async function creditTransactionsCol() {
  return (await getDbCached()).collection<CreditTransaction & { _id?: unknown }>("credit_transactions")
}
export async function projectAssetsCol() {
  return (await getDbCached()).collection<ProjectAssetDoc>("project_assets")
}
export async function providerUsageCol() {
  return (await getDbCached()).collection<ProviderUsageDoc>("provider_usage")
}
export async function topupsCol() {
  return (await getDbCached()).collection<TopUpDoc & { _id?: unknown }>("topups")
}
export async function publishEventsCol() {
  return (await getDbCached()).collection<PublishEventDoc & { _id?: unknown }>("publish_events")
}
export async function referralsCol() {
  return (await getDbCached()).collection<ReferralDoc & { _id?: unknown }>("referrals")
}
export async function docFeedbackCol() {
  return (await getDbCached()).collection<DocFeedbackDoc & { _id?: unknown }>("doc_feedback")
}
export async function webhookEventsCol() {
  return (await getDbCached()).collection<WebhookEventDoc & { _id?: unknown }>("webhook_events")
}

// ─── Unified Billing Collections ─────────────────────────────────────────────

export async function creditLedgerCol() {
  return (await getDbCached()).collection<CreditLedgerEntry>("credit_ledger")
}

export async function buildAuthorizationsCol() {
  return (await getDbCached()).collection<BuildAuthorization>("build_authorizations")
}

export async function paymentRecordsCol() {
  return (await getDbCached()).collection<PaymentRecord>("payment_records")
}

export async function subscriptionRecordsCol() {
  return (await getDbCached()).collection<SubscriptionRecord>("subscription_records")
}

let indexesEnsured = false

/**
 * Drop legacy non-sparse unique id indexes once per process. These exist on
 * older databases where `id: null` records broke uniqueness; after dropping
 * they are replaced by the sparse versions below.
 */
let legacyIndexesDropped = false
async function dropLegacyIndexes() {
  if (legacyIndexesDropped) return
  legacyIndexesDropped = true
  const [projects, buildRuns, creditTx, assets, usage] = await Promise.all([
    projectsCol(), buildRunsCol(), creditTransactionsCol(), projectAssetsCol(), providerUsageCol(),
  ])
  await Promise.all([
    projects.dropIndex("id_1").catch(() => undefined),
    buildRuns.dropIndex("id_1").catch(() => undefined),
    creditTx.dropIndex("id_1").catch(() => undefined),
    assets.dropIndex("id_1").catch(() => undefined),
    usage.dropIndex("id_1").catch(() => undefined),
  ])
}

/**
 * Create indexes idempotently on first DB access (spec section 20). Mongo's
 * `createIndex` is a no-op if an equivalent index already exists, so this is
 * safe to call repeatedly and cheap after the first call per process.
 */
export async function ensureIndexes() {
  if (indexesEnsured) return
  const [users, sessions, tokens, rateLimits, projects, buildRuns, creditTx, assets, usage] = await Promise.all([
    usersCol(), sessionsCol(), verificationTokensCol(), rateLimitsCol(),
    projectsCol(), buildRunsCol(), creditTransactionsCol(), projectAssetsCol(), providerUsageCol(),
  ])

  // Drop legacy indexes once, then create all indexes.
  await dropLegacyIndexes()

  await Promise.all([
    users.createIndex({ email: 1 }, { unique: true }),
    users.createIndex({ googleId: 1 }, { sparse: true }),
    users.createIndex({ referralCode: 1 }, { sparse: true }),
    // Supports lookups and expiry queries on individual credit buckets
    users.createIndex({ "creditBuckets.subscriptionId": 1 }, { sparse: true }),
    users.createIndex({ "creditBuckets.expiresAt": 1 }, { sparse: true }),
    // Supports the admin "top users by credits" query: find non-deleted users
    // sorted by credits descending — without this index it requires a full
    // collection scan + in-memory sort.
    users.createIndex({ deletedAt: 1, credits: -1 }, { sparse: true, name: "users_credits_desc" }),
    sessions.createIndex({ tokenHash: 1 }, { unique: true }),
    sessions.createIndex({ userId: 1 }),
    sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    tokens.createIndex({ tokenHash: 1 }, { unique: true }),
    tokens.createIndex({ userId: 1, purpose: 1 }),
    tokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    rateLimits.createIndex({ key: 1 }, { unique: true }),
    rateLimits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    projects.createIndex({ id: 1 }, { unique: true, sparse: true, name: "projects_id_unique" }),
    projects.createIndex({ userId: 1, updatedAt: -1 }),
    buildRuns.createIndex({ id: 1 }, { unique: true, sparse: true, name: "build_runs_id_unique" }),
    buildRuns.createIndex({ mirrorProjectId: 1, startedAt: -1 }),
    creditTx.createIndex({ id: 1 }, { unique: true, sparse: true, name: "credit_transactions_id_unique" }),
    creditTx.createIndex({ userId: 1, createdAt: -1 }),
    assets.createIndex({ id: 1 }, { unique: true, sparse: true, name: "project_assets_id_unique" }),
    assets.createIndex({ userId: 1, createdAt: -1 }),
    usage.createIndex({ id: 1 }, { unique: true, sparse: true, name: "provider_usage_id_unique" }),
    usage.createIndex({ provider: 1, createdAt: -1 }),
  ])

  // Publish event indexes
  const publishEvents = await publishEventsCol()
  await Promise.all([
    publishEvents.createIndex({ id: 1 }, { unique: true, sparse: true, name: "publish_events_id_unique" }),
    publishEvents.createIndex({ userId: 1, createdAt: -1 }),
    publishEvents.createIndex({ projectId: 1, createdAt: -1 }),
    publishEvents.createIndex({ status: 1, createdAt: -1 }),
    publishEvents.createIndex({ createdAt: -1 }),
  ])

  // Top-up indexes
  const topups = await topupsCol()
  await Promise.all([
    topups.createIndex({ id: 1 }, { unique: true, sparse: true, name: "topups_id_unique" }),
    topups.createIndex({ userId: 1, createdAt: -1 }),
    topups.createIndex({ paymentReference: 1 }, { unique: true }),
    topups.createIndex({ status: 1, createdAt: -1 }),
    topups.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]).catch((error) => {
    console.error("[v0] ensureIndexes: failed", error)
    // Log but don't crash — indexes are best-effort; the app can still
    // function (albeit slower) without them on the first request.
    indexesEnsured = false
  })

  // Referral indexes
  const referrals = await referralsCol()
  await Promise.all([
    referrals.createIndex({ id: 1 }, { unique: true, sparse: true, name: "referrals_id_unique" }),
    referrals.createIndex({ referrerUserId: 1, createdAt: -1 }),
    referrals.createIndex({ referredUserId: 1 }, { unique: true }),
    referrals.createIndex({ referralCode: 1 }),
  ])

  // Doc feedback indexes
  const docFeedback = await docFeedbackCol()
  await Promise.all([
    docFeedback.createIndex({ key: 1 }, { unique: true, name: "doc_feedback_key_unique" }),
    docFeedback.createIndex({ sectionId: 1, vote: 1 }),
  ])

  // Webhook event indexes
  const webhookEvents = await webhookEventsCol()
  await Promise.all([
    webhookEvents.createIndex({ id: 1 }, { unique: true, sparse: true, name: "webhook_events_id_unique" }),
    webhookEvents.createIndex({ webhookId: 1 }, { unique: true, name: "webhook_events_webhook_id_unique" }),
    webhookEvents.createIndex({ eventType: 1, receivedAt: -1 }),
    webhookEvents.createIndex({ status: 1, receivedAt: -1 }),
    webhookEvents.createIndex({ receivedAt: -1 }),
  ])

  // ─── Unified Billing Indexes ────────────────────────────────────────────
  const creditLedger = await creditLedgerCol()
  await Promise.all([
    creditLedger.createIndex({ id: 1 }, { unique: true, sparse: true, name: "credit_ledger_id_unique" }),
    creditLedger.createIndex({ userId: 1, createdAt: -1 }),
    creditLedger.createIndex({ userId: 1, creditType: 1, createdAt: -1 }),
    creditLedger.createIndex({ idempotencyKey: 1 }, { unique: true, name: "credit_ledger_idempotency_unique" }),
    creditLedger.createIndex({ transactionType: 1, createdAt: -1 }),
    creditLedger.createIndex({ referenceType: 1, referenceId: 1 }),
  ])

  const buildAuths = await buildAuthorizationsCol()
  await Promise.all([
    buildAuths.createIndex({ id: 1 }, { unique: true, sparse: true, name: "build_auth_id_unique" }),
    buildAuths.createIndex({ userId: 1, createdAt: -1 }),
    buildAuths.createIndex({ projectId: 1, createdAt: -1 }),
    buildAuths.createIndex({ status: 1, createdAt: -1 }),
    buildAuths.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ])

  const paymentRecords = await paymentRecordsCol()
  await Promise.all([
    paymentRecords.createIndex({ id: 1 }, { unique: true, sparse: true, name: "payment_records_id_unique" }),
    paymentRecords.createIndex({ dodoPaymentId: 1 }, { unique: true, name: "payment_records_dodo_id_unique" }),
    paymentRecords.createIndex({ userId: 1, createdAt: -1 }),
    paymentRecords.createIndex({ status: 1, createdAt: -1 }),
  ])

  const subRecords = await subscriptionRecordsCol()
  await Promise.all([
    subRecords.createIndex({ id: 1 }, { unique: true, sparse: true, name: "subscription_records_id_unique" }),
    subRecords.createIndex({ dodoSubscriptionId: 1 }, { unique: true, name: "subscription_records_dodo_id_unique" }),
    subRecords.createIndex({ userId: 1, createdAt: -1 }),
    subRecords.createIndex({ status: 1, createdAt: -1 }),
  ])

  indexesEnsured = true
}
