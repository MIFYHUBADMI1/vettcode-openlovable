import "server-only"

/**
 * SEO audit service (Phase 3 — W2).
 *
 * Orchestrates one bounded, read-only audit of a project's OWN deployed URL:
 *   guard the URL (SSRF) → crawl via the existing Firecrawl service → run the
 *   deterministic auditor → persist a durable `seo_audits` record.
 *
 * It does NOT charge credits (that is the caller's concern via
 * `chargeSeoAuditCredits`) and it does NOT accept an arbitrary user-supplied
 * URL from outside: the caller passes the project's recorded
 * `deployment.productionUrl`. Even so the URL is run through
 * `assertPublicHttpUrl` as defense in depth.
 */

import { ObjectId } from "mongodb"
import { isFirecrawlConfigured, crawlUrlToEvidence } from "./crawl"
import { auditWebsiteEvidence } from "./auditor"
import { seoAuditsCol } from "@/lib/db/collections"
import { cryptoId } from "@/lib/store/store"
import { AppError } from "@/lib/errors"
import { logger } from "@/lib/logging/logger"
import type { SeoAuditDoc } from "@/lib/types/db"

export interface RunSeoAuditInput {
  userId: string
  projectId: string
  /** The project's recorded production URL — validated against SSRF here. */
  url: string
  /** Credits charged for this run, recorded for transparency. */
  creditsCharged?: number
}

export interface RunSeoAuditOutcome {
  auditId: string
  status: SeoAuditDoc["status"]
  score: SeoAuditDoc["score"]
  findings: SeoAuditDoc["findings"]
  pagesCrawled: number
  url: string
  completedAt: number
}

export async function runSeoAudit({ userId, projectId, url, creditsCharged = 0 }: RunSeoAuditInput): Promise<RunSeoAuditOutcome> {
  const startedAt = Date.now()

  if (!isFirecrawlConfigured()) {
    throw new AppError("FIRECRAWL_UNAVAILABLE")
  }

  // 1. Crawl (guarded). crawlUrlToEvidence validates the URL and returns
  //    normalized evidence or throws FIRECRAWL_UNAVAILABLE on provider failure.
  const { evidence, fromCache } = await crawlUrlToEvidence(url)

  // 2. Deterministic audit — pure, reproducible.
  const result = auditWebsiteEvidence(evidence)

  const completedAt = Date.now()
  const id = `seo_${cryptoId()}`

  const doc: SeoAuditDoc = {
    // _id is optional in the collection type; Mongo assigns it, but we set a
    // business id string and mirror it. Provide a fresh ObjectId primary.
    _id: new ObjectId(),
    id,
    userId,
    projectId,
    url: evidence.sourceUrl || url,
    status: "completed",
    findings: result.findings,
    score: result.score,
    pagesCrawled: result.pagesCrawled,
    creditsCharged,
    fromCache,
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
    pages: result.pagesCrawled,
    pass: result.score.pass,
    fail: result.score.fail,
    notObserved: result.score.notObserved,
    fromCache,
  })

  return {
    auditId: id,
    status: "completed",
    score: result.score,
    findings: result.findings,
    pagesCrawled: result.pagesCrawled,
    url: doc.url,
    completedAt,
  }
}

/** Read the most recent audit for a project (ownership-scoped by caller). */
export async function getLatestSeoAudit(projectId: string): Promise<SeoAuditDoc | null> {
  const col = await seoAuditsCol()
  const doc = await col.find({ projectId }).sort({ createdAt: -1 }).limit(1).next()
  return (doc as unknown as SeoAuditDoc) ?? null
}
