"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CircleCheck, CircleDashed, CircleX, History, Loader2, SearchCheck, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import type {
  SeoAuditScore,
  SeoFinding,
  SeoRecommendation,
  SeoRecommendationsMeta,
  SeoRefundInfo,
} from "@/lib/types/db"

/**
 * SEO & Visibility workspace (Phase 3 — v1.1).
 *
 * Surfaces what the bounded crawl actually observed on the project's own live
 * site: a transparent internal score, severity-labelled findings, and the
 * stored audit history. Nothing here claims a search ranking, traffic, or
 * conversion — the score is an Atai assessment of completed on-page checks.
 */

export interface SeoAuditView {
  id?: string
  url: string
  status: "completed" | "failed"
  score: { pass: number; fail: number; notObserved: number }
  auditScore?: SeoAuditScore | null
  pagesCrawled: number
  findings: SeoFinding[]
  recommendations?: SeoRecommendation[]
  recommendationsMeta?: SeoRecommendationsMeta | null
  refund?: SeoRefundInfo | null
  fromCache: boolean
  createdAt: number
  error?: string | null
}

export interface SeoHistoryRow {
  id: string
  url: string
  status: "completed" | "failed"
  score: { pass: number; fail: number; notObserved: number }
  auditScore?: SeoAuditScore
  pagesCrawled: number
  findingCount: number
  recommendationCount?: number
  refund?: SeoRefundInfo
  fromCache: boolean
  error?: string
  createdAt: number
  completedAt?: number
}

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 } as const

const SEVERITY_LABEL: Record<SeoFinding["severity"] & string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
}

const SEVERITY_CLASS: Record<SeoFinding["severity"] & string, string> = {
  critical: "bg-destructive/10 text-destructive",
  high: "bg-red-500/10 text-red-600 dark:text-red-400",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  low: "bg-muted text-muted-foreground",
  info: "bg-muted text-muted-foreground",
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** Locale- and timezone-independent so SSR and client render identically. */
function formatDate(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

function statusIcon(status: SeoFinding["status"]) {
  if (status === "pass") return <CircleCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
  if (status === "fail") return <CircleX className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
  return <CircleDashed className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
}

function statusLabel(status: SeoFinding["status"]): string {
  if (status === "pass") return "Pass"
  if (status === "fail") return "Needs work"
  return "Not observed"
}

function severityRank(finding: SeoFinding): number {
  return SEVERITY_ORDER[(finding.severity ?? "medium") as keyof typeof SEVERITY_ORDER] ?? 2
}

function sortFindings(findings: SeoFinding[]): SeoFinding[] {
  return [...findings].sort((a, b) => {
    const bySeverity = severityRank(a) - severityRank(b)
    if (bySeverity !== 0) return bySeverity
    const failFirst = (a.status === "fail" ? 0 : 1) - (b.status === "fail" ? 0 : 1)
    if (failFirst !== 0) return failFirst
    return a.label.localeCompare(b.label)
  })
}

export function SeoWorkspace({
  projectId,
  projectName,
  deployed,
  cost,
  available,
  initialAudit,
  initialHistory,
  initialCursor,
}: {
  projectId: string
  projectName: string
  deployed: boolean
  cost: number
  available: number
  initialAudit: SeoAuditView | null
  initialHistory: SeoHistoryRow[]
  initialCursor: string | null
}) {
  const router = useRouter()
  const [audit, setAudit] = useState<SeoAuditView | null>(initialAudit)
  const [latest, setLatest] = useState<SeoAuditView | null>(initialAudit)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState("")
  const [history, setHistory] = useState<SeoHistoryRow[]>(initialHistory)
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [loadingMore, setLoadingMore] = useState(false)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [viewingSaved, setViewingSaved] = useState(false)

  const canAfford = cost <= 0 || available >= cost

  async function runAudit() {
    setRunning(true)
    setStatus("Running the audit…")
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/seo-audit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      })
      const json = await response.json()
      if (!response.ok || !json.ok) {
        const code = json?.error?.code
        const message =
          code === "INSUFFICIENT_CREDITS"
            ? "You don't have enough credits for this audit."
            : (json?.error?.message ?? "The audit couldn't run.")
        toast.error(message)
        setStatus("The audit couldn't run.")
        return
      }
      const d = json.data
      const view: SeoAuditView = {
        id: d.auditId,
        url: d.url,
        status: "completed",
        score: d.score,
        auditScore: d.auditScore ?? null,
        pagesCrawled: d.pagesCrawled,
        findings: d.findings,
        recommendations: d.recommendations ?? [],
        recommendationsMeta: d.recommendationsMeta ?? null,
        refund: null,
        fromCache: false,
        createdAt: d.completedAt,
      }
      setAudit(view)
      setLatest(view)
      setViewingSaved(false)
      setHistory((prev) => [
        {
          id: d.auditId,
          url: d.url,
          status: "completed",
          score: d.score,
          ...(d.auditScore ? { auditScore: d.auditScore } : {}),
          pagesCrawled: d.pagesCrawled,
          findingCount: d.score.pass + d.score.fail + d.score.notObserved,
          recommendationCount: (d.recommendations ?? []).length,
          fromCache: false,
          createdAt: d.completedAt,
        },
        ...prev,
      ])
      setStatus(`Audit complete. ${d.score.fail} check${d.score.fail === 1 ? "" : "s"} need attention.`)
      toast.success("Audit complete.")
      router.refresh()
    } catch {
      toast.error("The audit couldn't run. Please try again.")
      setStatus("The audit couldn't run.")
    } finally {
      setRunning(false)
    }
  }

  async function loadMore() {
    if (!cursor) return
    setLoadingMore(true)
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/seo-audits?cursor=${encodeURIComponent(cursor)}`,
      )
      const json = await response.json()
      if (!response.ok || !json.ok) {
        toast.error("Couldn't load more history.")
        return
      }
      setHistory((prev) => [...prev, ...(json.data.audits as SeoHistoryRow[])])
      setCursor(json.data.nextCursor ?? null)
    } catch {
      toast.error("Couldn't load more history.")
    } finally {
      setLoadingMore(false)
    }
  }

  async function openAudit(id: string) {
    setOpeningId(id)
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/seo-audits/${encodeURIComponent(id)}`,
      )
      const json = await response.json()
      if (!response.ok || !json.ok) {
        toast.error("Couldn't open that audit.")
        return
      }
      const a = json.data.audit
      setAudit({
        id: a.id,
        url: a.url,
        status: a.status,
        score: a.score,
        auditScore: a.auditScore ?? null,
        pagesCrawled: a.pagesCrawled,
        findings: a.findings,
        recommendations: a.recommendations ?? [],
        recommendationsMeta: a.recommendationsMeta ?? null,
        refund: a.refund ?? null,
        fromCache: a.fromCache,
        createdAt: a.createdAt,
        error: a.error,
      })
      setViewingSaved(true)
      setStatus("Viewing a saved audit.")
    } catch {
      toast.error("Couldn't open that audit.")
    } finally {
      setOpeningId(null)
    }
  }

  const sorted = audit ? sortFindings(audit.findings) : []

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Market &amp; grow</p>
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <SearchCheck className="h-6 w-6 text-primary" aria-hidden /> SEO &amp; Visibility
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          A bounded, read-only check of {projectName}&apos;s own live website. Atai inspects the pages it can reach and
          reports what it actually observed. It does not measure search rankings, traffic, or conversions.
        </p>
        <p className="text-xs text-muted-foreground">
          {deployed && audit ? (
            <>
              Audited <span className="font-mono">{audit.url}</span> · last audit {formatDate(audit.createdAt)}
            </>
          ) : deployed ? (
            <>No audit yet for this project.</>
          ) : (
            <>No live website is connected to this project yet.</>
          )}
        </p>
      </header>

      {!deployed ? (
        <section className="rounded-2xl border border-border bg-card p-5 text-sm leading-6 text-muted-foreground">
          <h3 className="mb-1 text-base font-semibold text-foreground">Deploy your website first</h3>
          An audit reads only your own deployed site, so there is nothing to inspect yet. Once your project is live,
          come back here to run one.
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={runAudit} disabled={running || !canAfford}>
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              {audit ? "Run a fresh audit" : "Run first audit"} {cost > 0 ? `· ${cost} credits` : ""}
            </Button>
            {cost > 0 ? (
              <span className="text-xs text-muted-foreground">
                {canAfford ? `${available} credits available` : `Needs ${cost} credits — you have ${available}`}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">No credits are charged for this audit.</span>
            )}
            <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
              {status}
            </span>
          </div>

          {!audit ? (
            <section className="rounded-2xl border border-dashed border-border p-5 text-sm leading-6 text-muted-foreground">
              <h3 className="mb-1 text-base font-semibold text-foreground">No audit yet</h3>
              Run an audit to check the on-page fundamentals Atai can observe — HTTPS, page title, meta description,
              headings, internal links, and readable content. Checks Atai cannot observe are labelled &ldquo;not
              observed&rdquo; rather than counted as failures.
            </section>
          ) : (
            <>
              <ScoreCard
                audit={audit}
                viewingSaved={viewingSaved}
                onBackToLatest={() => {
                  setAudit(latest)
                  setViewingSaved(false)
                  setStatus("Viewing the most recent audit.")
                }}
              />

              {audit.status === "failed" ? (
                <section className="rounded-2xl border border-destructive/30 bg-card p-5">
                  <h3 className="text-base font-semibold">This audit didn&apos;t finish</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {audit.error ?? "Atai couldn't complete the crawl of your website."}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">{refundNote(audit.refund)}</p>
                </section>
              ) : (
              <section aria-labelledby="seo-findings-heading" className="flex flex-col gap-3">
                <h3 id="seo-findings-heading" className="text-lg font-semibold tracking-tight">
                  What Atai observed
                </h3>
                <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">
                  {sorted.map((f) => (
                    <li key={f.id} className="flex items-start gap-3 p-4">
                      <span className="mt-0.5">{statusIcon(f.status)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{f.label}</span>
                          {f.severity ? (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${SEVERITY_CLASS[f.severity]}`}
                            >
                              {SEVERITY_LABEL[f.severity]}
                            </span>
                          ) : null}
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {statusLabel(f.status)}
                          </span>
                          {f.category ? (
                            <span className="text-[11px] text-muted-foreground">{f.category}</span>
                          ) : null}
                        </div>
                        {f.observed ? <p className="mt-1 text-sm text-muted-foreground">{f.observed}</p> : null}
                        {f.note ? <p className="mt-1 text-xs leading-5 text-muted-foreground italic">{f.note}</p> : null}
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="text-xs leading-5 text-muted-foreground">
                  A check marked &ldquo;not observed&rdquo; means the crawler could not read that signal. It is not a
                  failure and it does not lower the score.
                </p>
              </section>
              )}

              <RecommendationsSection
                recommendations={audit.recommendations ?? []}
                meta={audit.recommendationsMeta ?? null}
              />
            </>
          )}

          <section aria-labelledby="seo-history-heading" className="flex flex-col gap-3">
            <h3 id="seo-history-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <History className="h-4 w-4" aria-hidden /> Audit history
            </h3>
            {history.length === 0 ? (
              <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
                Saved audits will appear here.
              </p>
            ) : (
              <>
                <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">
                  {history.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => openAudit(row.id)}
                        disabled={openingId === row.id}
                        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                      >
                        {openingId === row.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          statusIcon(row.status === "completed" ? "pass" : "fail")
                        )}
                        <span className="font-medium">{formatDate(row.createdAt)}</span>
                        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{row.url}</span>
                        <span className="text-xs text-muted-foreground">
                          {row.auditScore?.value != null ? `${row.auditScore.value}/100` : `${row.score.fail} to improve`}
                        </span>
                        {row.refund && row.refund.status !== "not_charged" ? (
                          <span className="text-xs text-muted-foreground">
                            {row.refund.status === "refunded"
                              ? "refunded"
                              : row.refund.status === "failed"
                                ? "refund failed"
                                : "refund pending"}
                          </span>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {row.findingCount} checks · {row.pagesCrawled} page{row.pagesCrawled === 1 ? "" : "s"}
                          {row.recommendationCount ? ` · ${row.recommendationCount} tips` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {cursor ? (
                  <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore} className="self-start">
                    {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                    Load older audits
                  </Button>
                ) : null}
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}

/** Plain-language statement of what happened to the charge on a failed run. */
function refundNote(refund: SeoRefundInfo | null | undefined): string {
  if (!refund || refund.status === "not_charged") {
    return "No credits were charged for this attempt. Run a fresh audit to try again."
  }
  if (refund.status === "refunded") {
    const amount = refund.amount ? `${refund.amount} credit${refund.amount === 1 ? "" : "s"}` : "Your credits"
    return `${amount} were refunded. Run a fresh audit to try again.`
  }
  if (refund.status === "failed") {
    return "We couldn't reverse the credits automatically — please contact support."
  }
  return "The refund is being processed. Run a fresh audit to try again."
}

const PRIORITY_LABEL = { high: "High", medium: "Medium", low: "Low" } as const
const PRIORITY_CLASS = {
  high: "bg-red-500/10 text-red-600 dark:text-red-400",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  low: "bg-muted text-muted-foreground",
} as const

function RecommendationsSection({
  recommendations,
  meta,
}: {
  recommendations: SeoRecommendation[]
  meta: SeoRecommendationsMeta | null
}) {
  if (!meta && recommendations.length === 0) return null

  return (
    <section aria-labelledby="seo-recommendations-heading" className="flex flex-col gap-3">
      <h3 id="seo-recommendations-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Sparkles className="h-4 w-4" aria-hidden /> What Atai suggests
      </h3>
      {recommendations.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          {meta?.status === "unavailable"
            ? "AI guidance couldn't be generated for this audit. The technical findings above are still valid."
            : "No failing checks were found, so there is nothing to recommend."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {recommendations.map((r, i) => (
            <li key={`${r.title}-${i}`} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{r.title}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_CLASS[r.priority]}`}>
                  {PRIORITY_LABEL[r.priority]} priority
                </span>
                {r.requiresDeveloper ? (
                  <span className="text-[11px] text-muted-foreground">developer likely needed</span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{r.whyItMatters}</p>
              <p className="mt-2 text-sm leading-6">
                <span className="font-medium">Do this: </span>
                {r.action}
              </p>
              {r.pageUrl ? (
                <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">{r.pageUrl}</p>
              ) : null}
              <p className="mt-2 text-[11px] text-muted-foreground">
                AI-generated from observed findings · {r.findingIds.join(", ")}
                {meta?.model ? ` · ${meta.model}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs leading-5 text-muted-foreground">
        These are suggestions, not measured results. Atai cannot see your search rankings or traffic, and making a
        change does not guarantee a ranking improvement.
      </p>
    </section>
  )
}

function ScoreCard({
  audit,
  viewingSaved,
  onBackToLatest,
}: {
  audit: SeoAuditView
  viewingSaved: boolean
  onBackToLatest: () => void
}) {
  const value = audit.auditScore?.value ?? null
  const eligible = audit.auditScore ? audit.auditScore.passedWeight + audit.auditScore.failedWeight : 0

  return (
    <section aria-labelledby="seo-score-heading" className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 id="seo-score-heading" className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Atai SEO score
          </h3>
          <p className="mt-1 text-3xl font-semibold tracking-tight">
            {value != null ? `${value}/100` : "Not available"}
          </p>
          <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
            An internal assessment of the on-page checks completed for this audit. It is not a Google ranking,
            traffic, or visibility metric.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
          {audit.status === "failed" ? (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">Audit failed</span>
          ) : (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">
              Completed
            </span>
          )}
          <span>
            {audit.score.pass} passed · {audit.score.fail} to improve · {audit.score.notObserved} not observed
          </span>
          <span>
            {audit.pagesCrawled} page{audit.pagesCrawled === 1 ? "" : "s"} inspected
            {audit.fromCache ? " · from recent cache" : ""}
          </span>
          {audit.auditScore ? <span>Score version {audit.auditScore.version}</span> : null}
        </div>
      </div>

      {value != null ? (
        <div className="mt-4">
          <div
            role="img"
            aria-label={`SEO score ${value} out of 100, based on ${eligible} weighted checks`}
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
          </div>
          {audit.auditScore && audit.auditScore.notApplicable > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {audit.auditScore.notApplicable} check{audit.auditScore.notApplicable === 1 ? "" : "s"} could not be
              evaluated and {audit.auditScore.notApplicable === 1 ? "is" : "are"} excluded from the score.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          No check was eligible for scoring in this audit, so Atai reports the score as unavailable rather than zero.
        </p>
      )}

      {audit.error ? <p className="mt-3 text-xs text-destructive">{audit.error}</p> : null}

      {viewingSaved ? (
        <Button variant="link" size="sm" className="mt-2 px-0" onClick={onBackToLatest}>
          Viewing a saved audit — run a fresh audit to update
        </Button>
      ) : null}
    </section>
  )
}
