"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, SearchCheck, CircleCheck, CircleX, CircleDashed } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SeoAuditScore, SeoFinding } from "@/lib/types/db"

/**
 * SEO visibility panel (Phase 3 — W2). Client surface on the Growth Overview.
 * Renders the latest stored audit and can trigger a fresh, credit-charged
 * audit of the project's own live URL via the ownership-gated endpoint. The
 * URL is never supplied here — the server audits the project's recorded
 * production URL. All figures are deterministic on-page findings; nothing
 * about rankings or traffic is claimed.
 */

export interface SeoAuditView {
  url: string
  status: "completed" | "failed"
  score: { pass: number; fail: number; notObserved: number }
  auditScore?: SeoAuditScore | null
  pagesCrawled: number
  findings: SeoFinding[]
  fromCache: boolean
  createdAt: number
}

export interface SeoPanelState {
  enabled: boolean
  deployed: boolean
  cost: number
  available: number
  /** Destination of the full SEO & Visibility workspace. */
  href: string
  latest: SeoAuditView | null
}

function statusIcon(status: SeoFinding["status"]) {
  if (status === "pass") return <CircleCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-label="pass" />
  if (status === "fail") return <CircleX className="h-4 w-4 text-red-600 dark:text-red-400" aria-label="fail" />
  return <CircleDashed className="h-4 w-4 text-muted-foreground" aria-label="not observed" />
}

export function SeoAuditPanel({ projectId, state }: { projectId: string; state: SeoPanelState }) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [latest, setLatest] = useState<SeoAuditView | null>(state.latest)
  /**
   * Phase 3 (Workstream C): one stable intent id per audit *attempt*. It is
   * kept across a network-level failure so retrying an audit whose outcome we
   * never saw cannot charge twice; it is replaced as soon as the server gives
   * a definitive answer, so the next audit is a genuinely new operation.
   * Idempotency identity only — the server scopes it by user + project and it
   * grants nothing.
   */
  const intentRef = useRef<string | null>(null)

  if (!state.enabled) {
    return (
      <section className="flex min-w-0 flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">SEO visibility</h2>
        <p className="rounded-2xl border border-dashed border-border bg-transparent p-4 text-sm leading-6 text-muted-foreground sm:p-5">
          SEO audits are not enabled for this account yet.
        </p>
      </section>
    )
  }

  async function runAudit() {
    setRunning(true)
    if (!intentRef.current) {
      const randomId = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `seo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      intentRef.current = randomId
    }
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/seo-audit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: intentRef.current }),
      })
      const json = await response.json()
      // The server answered definitively — this attempt is settled, so the
      // next click is a new operation with its own intent id.
      intentRef.current = null
      if (!response.ok || !json.ok) {
        const code = json?.error?.code
        const msg = json?.error?.message ?? "The audit couldn't run."
        toast.error(code === "INSUFFICIENT_CREDITS" ? "Not enough credits for this audit." : msg)
        return
      }
      const d = json.data
      setLatest({
        url: d.url,
        status: "completed",
        score: d.score,
        auditScore: d.auditScore ?? null,
        pagesCrawled: d.pagesCrawled,
        findings: d.findings,
        fromCache: false,
        createdAt: d.completedAt,
      })
      toast.success(`Audit complete — ${d.score.pass} passed, ${d.score.fail} to improve.`)
      router.refresh()
    } catch {
      toast.error("The audit couldn't run. Please try again.")
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <SearchCheck className="h-5 w-5 shrink-0 text-primary" /> SEO visibility
        </h2>
        <div className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Link
            href={state.href}
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Open SEO &amp; Visibility →
          </Link>
          <Button
            size="sm"
            variant={latest ? "outline" : "default"}
            onClick={runAudit}
            disabled={running || !state.deployed}
            className="w-full sm:w-auto"
          >
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {latest ? "Re-run audit" : "Run audit"} {state.cost > 0 ? `· ${state.cost} credits` : ""}
          </Button>
        </div>
      </div>

      {!state.deployed ? (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm leading-6 text-muted-foreground sm:p-5">
          Deploy your project to a live URL first — the audit reads only your own deployed site.
        </p>
      ) : !latest ? (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm leading-6 text-muted-foreground sm:p-5">
          No audit yet. This checks on-page fundamentals of your live URL (title, description, headings, links, HTTPS).
          It reads your own site only and never claims a search ranking. Costs {state.cost} credits.
        </p>
      ) : (
        <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm sm:gap-3">
            <span className="min-w-0 break-all font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {latest.url}
            </span>
            {latest.auditScore?.value != null ? (
              <span className="shrink-0 whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {latest.auditScore.value}/100
              </span>
            ) : null}
            <span className="shrink-0 whitespace-nowrap rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">{latest.score.pass} pass</span>
            <span className="shrink-0 whitespace-nowrap rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-600 dark:text-red-400">{latest.score.fail} to improve</span>
            <span className="shrink-0 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{latest.score.notObserved} not observed</span>
            {latest.fromCache ? <span className="text-xs italic text-muted-foreground">(from recent cache)</span> : null}
          </div>
          <ul className="flex flex-col gap-2">
            {latest.findings.map((f) => (
              <li key={f.id} className="flex min-w-0 items-start gap-2 text-sm">
                <span className="mt-0.5 shrink-0">{statusIcon(f.status)}</span>
                <span className="min-w-0 break-words">
                  <span className="font-medium">{f.label}</span>
                  {f.observed ? <span className="text-muted-foreground"> — {f.observed}</span> : null}
                  {f.note ? <span className="block text-xs italic text-muted-foreground">{f.note}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
            Deterministic on-page findings from a bounded crawl of your own site. Atai does not measure search rankings,
            traffic, or conversions — these are configuration checks only.
          </p>
        </div>
      )}
    </section>
  )
}
