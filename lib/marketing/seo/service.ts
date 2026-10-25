import "server-only"

/**
 * SEO audit service (Phase 3 — W2, extended v1.2).
 *
 * Orchestrates one bounded, read-only audit of a project's OWN deployed URL:
 *   guard the URL (SSRF) → crawl via the existing Firecrawl service → run the
 *   deterministic auditor → (best-effort) AI recommendations → persist a
 *   durable `seo_audits` record.
 *
 * It does NOT charge credits (that is the caller's concern via
 * `chargeSeoAuditCredits`) and it does NOT accept an arbitrary user-supplied
 * URL from outside: the caller passes the project's recorded
 * `deployment.productionUrl`. Even so the URL is run through
 * `assertPublicHttpUrl` as defense in depth.
 *
 * Failure semantics:
 *  - A crawl/audit failure persists a `failed` audit with a safe, non-technical
 *    error, then rethrows so the caller's existing refund path runs. The record
 *    keeps the amount that was charged and starts at `refund.status: "pending"`;
 *    the caller stamps the real outcome via `markSeoAuditRefund` once the credit
 *    reversal is confirmed, so history never claims a refund that did not happen.
 *  - A recommendation failure NEVER fails the audit: the deterministic findings
 *    are kept and `recommendationsMeta.status` records why guidance is absent.
 */

import { ObjectId } from "mongodb"
import { isFirecrawlConfigured, crawlUrlToEvidence } from "./crawl"
import { auditWebsiteEvidence } from "./auditor"
import { generateSeoRecommendations, isSeoRecommendationConfigured } from "./recommendations"
import { seoAuditsCol } from "@/lib/db/collections"
import { cryptoId } from "@/lib/store/store"
import { AppError } from "@/lib/errors"
import { logger } from "@/lib/logging/logger"
import type {
  SeoAuditDoc,
  SeoAuditScore,
  SeoFinding,
  SeoRecommendation,
  SeoRecommendationsMeta,
  SeoRefundInfo,
  SeoRefundStatus,
} from "@/lib/types/db"

/** History page size bounds — the list endpoint never returns an unbounded set. */
export const SEO_HISTORY_DEFAULT_LIMIT = 10
export const SEO_HISTORY_MAX_LIMIT = 25

export interface RunSeoAuditInput {
  userId: string
  projectId: string
  /** The project's recorded production URL — validated against SSRF here. */
  url: string
  /** Credits charged for this run, recorded for transparency. */
  creditsCharged?: number
  /** Project name, used only to ground AI recommendations. */
  projectName?: string
  /**
   * Called after a failed audit has been written, with its id, so the caller
   * can record the refund outcome against the stored history row.
   */
  onFailedAuditPersisted?: (auditId: string) => void
}

export interface RunSeoAuditOutcome {
  auditId: string
  status: SeoAuditDoc["status"]
  score: SeoAuditDoc["score"]
  auditScore: SeoAuditScore
  findings: SeoFinding[]
  recommendations: SeoRecommendation[]
  recommendationsMeta: SeoRecommendationsMeta
  pagesCrawled: number
  url: string
  completedAt: number
}

/** Bounded history row — deliberately excludes the full findings array. */
export interface SeoAuditSummary {
  id: string
  url: string
  status: SeoAuditDoc["status"]
  score: SeoAuditDoc["score"]
  auditScore?: SeoAuditScore
  pagesCrawled: number
  /** Derived from the stored counts so history queries stay small. */
  findingCount: number
  recommendationCount: number
  /** Present on failed runs: what happened to the charge. */
  refund?: SeoRefundInfo
  fromCache: boolean
  error?: string
  createdAt: number
  completedAt?: number
}

/**
 * Safe, non-technical failure text stored on a failed audit and shown to the
 * owner. No provider payloads, stack traces, or internals.
 */
export function seoSafeFailureMessage(code: string | undefined): string {
  switch (code) {
    case "FIRECRAWL_UNAVAILABLE":
      return "Atai couldn't reach your website to inspect it."
    case "VALIDATION":
      return "That website address can't be audited."
    case "DATABASE_UNAVAILABLE":
      return "We couldn't save the audit results."
    default:
      return "The audit didn't finish. Please try again."
  }
}

export async function runSeoAudit({
  userId,
  projectId,
  url,
  creditsCharged = 0,
  projectName,
  onFailedAuditPersisted,
}: RunSeoAuditInput): Promise<RunSeoAuditOutcome> {
  const startedAt = Date.now()
  const id = `seo_${cryptoId()}`

  // 1. Crawl (guarded) + 2. deterministic audit. Any failure here is recorded
  //    as a failed audit, then rethrown so the caller refunds.
  let prepared: { evidenceUrl: string; fromCache: boolean; result: ReturnType<typeof auditWebsiteEvidence> }
  try {
    if (!isFirecrawlConfigured()) throw new AppError("FIRECRAWL_UNAVAILABLE")
    const { evidence, fromCache } = await crawlUrlToEvidence(url)
    prepared = {
      evidenceUrl: evidence.sourceUrl || url,
      fromCache,
      result: auditWebsiteEvidence(evidence),
    }
  } catch (e) {
    const code = e instanceof AppError ? e.code : undefined
    const persisted = await persistFailedAudit({
      _id: new ObjectId(),
      id,
      userId,
      projectId,
      url,
      status: "failed",
      findings: [],
      score: { pass: 0, fail: 0, notObserved: 0 },
      pagesCrawled: 0,
      // What was actually charged. The caller confirms the reversal below.
      creditsCharged,
      refund: creditsCharged > 0 ? { status: "pending", amount: creditsCharged } : { status: "not_charged" },
      error: seoSafeFailureMessage(code),
      fromCache: false,
      startedAt,
      completedAt: Date.now(),
      createdAt: Date.now(),
    })
    if (persisted) onFailedAuditPersisted?.(id)
    throw e
  }

  // 3. AI recommendations — best-effort, grounded in the failing findings.
  const { recommendations, recommendationsMeta } = await buildRecommendations({
    projectName: projectName ?? prepared.evidenceUrl,
    url: prepared.evidenceUrl,
    findings: prepared.result.findings,
  })

  const completedAt = Date.now()
  const doc: SeoAuditDoc = {
    _id: new ObjectId(),
    id,
    userId,
    projectId,
    url: prepared.evidenceUrl,
    status: "completed",
    findings: prepared.result.findings,
    score: prepared.result.score,
    auditScore: prepared.result.auditScore,
    ...(recommendations.length > 0 ? { recommendations } : {}),
    recommendationsMeta,
    pagesCrawled: prepared.result.pagesCrawled,
    creditsCharged,
    fromCache: prepared.fromCache,
    startedAt,
    completedAt,
    createdAt: completedAt,
  }

  try {
    const col = await seoAuditsCol()
    await col.insertOne(doc as never)
  } catch (e) {
    logger.error("marketing.seo", "failed to persist seo audit", {
      projectId,
      message: e instanceof Error ? e.message : String(e),
    })
    throw new AppError("DATABASE_UNAVAILABLE")
  }

  logger.info("marketing.seo", "audit completed", {
    projectId,
    auditId: id,
    pages: prepared.result.pagesCrawled,
    pass: prepared.result.score.pass,
    fail: prepared.result.score.fail,
    notObserved: prepared.result.score.notObserved,
    score: prepared.result.auditScore.value,
    recommendations: recommendations.length,
    recommendationsStatus: recommendationsMeta.status,
    fromCache: prepared.fromCache,
  })

  return {
    auditId: id,
    status: "completed",
    score: prepared.result.score,
    auditScore: prepared.result.auditScore,
    findings: prepared.result.findings,
    recommendations,
    recommendationsMeta,
    pagesCrawled: prepared.result.pagesCrawled,
    url: doc.url,
    completedAt,
  }
}

/**
 * Generate AI guidance without ever failing the audit. When there is nothing to
 * fix, no model call is made. When the model is unconfigured or fails, the
 * audit keeps its deterministic findings and the meta records `unavailable`.
 */
async function buildRecommendations(input: {
  projectName: string
  url: string
  findings: SeoFinding[]
}): Promise<{ recommendations: SeoRecommendation[]; recommendationsMeta: SeoRecommendationsMeta }> {
  const failing = input.findings.filter((f) => f.status === "fail")
  if (failing.length === 0) {
    return { recommendations: [], recommendationsMeta: { status: "no_findings" } }
  }
  if (!isSeoRecommendationConfigured()) {
    return { recommendations: [], recommendationsMeta: { status: "unavailable" } }
  }
  try {
    const generated = await generateSeoRecommendations(input)
    if (generated.recommendations.length === 0) {
      return { recommendations: [], recommendationsMeta: { status: "unavailable" } }
    }
    return {
      recommendations: generated.recommendations,
      recommendationsMeta: { status: "generated", model: generated.model, generatedAt: Date.now() },
    }
  } catch (e) {
    logger.warn("marketing.seo", "recommendations unavailable — audit kept", {
      message: e instanceof Error ? e.message : String(e),
    })
    return { recommendations: [], recommendationsMeta: { status: "unavailable" } }
  }
}

/** Best-effort: a failed write must never replace the original crawl error.
 * Returns whether the record was stored, so the caller only stamps a refund on
 * a row that actually exists. */
async function persistFailedAudit(doc: SeoAuditDoc): Promise<boolean> {
  try {
    const col = await seoAuditsCol()
    await col.insertOne(doc as never)
    logger.info("marketing.seo", "failed audit persisted", { projectId: doc.projectId, auditId: doc.id })
    return true
  } catch (e) {
    logger.warn("marketing.seo", "could not persist failed audit", {
      projectId: doc.projectId,
      message: e instanceof Error ? e.message : String(e),
    })
    return false
  }
}

/**
 * Record the confirmed refund outcome on a stored failed audit. Scoped by
 * projectId so a row from another project can never be touched. Best-effort:
 * a failure here must not mask the original audit error.
 */
export async function markSeoAuditRefund(
  projectId: string,
  auditId: string,
  status: Exclude<SeoRefundStatus, "pending">,
  amount?: number,
): Promise<void> {
  if (!auditId) return
  try {
    const col = await seoAuditsCol()
    await col.updateOne(
      { projectId, id: auditId },
      { $set: { refund: { status, at: Date.now(), ...(amount && amount > 0 ? { amount } : {}) } } },
    )
  } catch (e) {
    logger.warn("marketing.seo", "could not record refund outcome", {
      projectId,
      auditId,
      status,
      message: e instanceof Error ? e.message : String(e),
    })
  }
}

/** Read the most recent audit for a project (ownership-scoped by caller). */
export async function getLatestSeoAudit(projectId: string): Promise<SeoAuditDoc | null> {
  const col = await seoAuditsCol()
  const doc = await col.find({ projectId }).sort({ createdAt: -1, id: -1 }).limit(1).next()
  return (doc as unknown as SeoAuditDoc) ?? null
}

/**
 * Read one stored audit, scoped to its project. Returns null when the id does
 * not belong to this project — the route converts that into a uniform 404, so
 * a readable audit id from another project reveals nothing.
 */
export async function getSeoAuditById(projectId: string, auditId: string): Promise<SeoAuditDoc | null> {
  if (!auditId) return null
  const col = await seoAuditsCol()
  const doc = await col.find({ projectId, id: auditId }).limit(1).next()
  return (doc as unknown as SeoAuditDoc) ?? null
}

/** Opaque history cursor — same convention as the runtime usage list. */
function parseCursor(cursor: string | undefined): { createdAt: number; id: string } | null {
  if (!cursor) return null
  const idx = cursor.indexOf("_")
  if (idx <= 0) return null
  const createdAt = Number(cursor.slice(0, idx))
  const id = cursor.slice(idx + 1)
  if (!Number.isFinite(createdAt) || !id) return null
  return { createdAt, id }
}

function encodeCursor(createdAt: number, id: string): string {
  return `${createdAt}_${id}`
}

function toSummary(doc: SeoAuditDoc): SeoAuditSummary {
  return {
    id: doc.id,
    url: doc.url,
    status: doc.status,
    score: doc.score,
    ...(doc.auditScore ? { auditScore: doc.auditScore } : {}),
    pagesCrawled: doc.pagesCrawled,
    findingCount: doc.score.pass + doc.score.fail + doc.score.notObserved,
    recommendationCount: doc.recommendations?.length ?? 0,
    ...(doc.refund ? { refund: doc.refund } : {}),
    fromCache: doc.fromCache,
    ...(doc.error ? { error: doc.error } : {}),
    createdAt: doc.createdAt,
    ...(doc.completedAt ? { completedAt: doc.completedAt } : {}),
  }
}

/**
 * Bounded, newest-first audit history for a project. Uses a cursor so the
 * project's entire history is never loaded in one request.
 */
export async function listSeoAudits(
  projectId: string,
  options: { limit?: number; cursor?: string } = {},
): Promise<{ audits: SeoAuditSummary[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(options.limit ?? SEO_HISTORY_DEFAULT_LIMIT, 1), SEO_HISTORY_MAX_LIMIT)
  const filter: Record<string, unknown> = { projectId }

  const cursor = parseCursor(options.cursor)
  if (cursor) {
    filter.$or = [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { $lt: cursor.id } },
    ]
  }

  const col = await seoAuditsCol()
  const docs = (await col
    .find(filter)
    .sort({ createdAt: -1, id: -1 })
    .limit(limit + 1)
    .toArray()) as unknown as SeoAuditDoc[]

  const hasMore = docs.length > limit
  const page = hasMore ? docs.slice(0, limit) : docs
  const last = page[page.length - 1]

  return {
    audits: page.map(toSummary),
    nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
  }
}
