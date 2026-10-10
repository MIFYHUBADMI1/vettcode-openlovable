"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, SearchCheck, CircleCheck, CircleX, CircleDashed } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SeoFinding } from "@/lib/types/db"

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

  if (!state.enabled) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">SEO visibility</h2>
        <p className="rounded-2xl border border-dashed border-border bg-transparent p-5 text-sm leading-6 text-muted-foreground">
          SEO audits are not enabled for this account yet.
        </p>
      </section>
    )
  }

  async function runAudit() {
    setRunning(true)
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/seo-audit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      })
      const json = await response.json()
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
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <SearchCheck className="h-5 w-5 text-primary" /> SEO visibility
        </h2>
        <Button size="sm" variant={latest ? "outline" : "default"} onClick={runAudit} disabled={running || !state.deployed}>
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {latest ? "Re-run audit" : "Run audit"} {state.cost > 0 ? `· ${state.cost} credits` : ""}
        </Button>
      </div>

      {!state.deployed ? (
        <p className="rounded-2xl border border-border bg-card p-5 text-sm leading-6 text-muted-foreground">
          Deploy your project to a live URL first — the audit reads only your own deployed site.
        </p>
      ) : !latest ? (
        <p className="rounded-2xl border border-border bg-card p-5 text-sm leading-6 text-muted-foreground">
          No audit yet. This checks on-page fundamentals of your live URL (title, description, headings, links, HTTPS).
          It reads your own site only and never claims a search ranking. Costs {state.cost} credits.
        </p>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{latest.url}</span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">{latest.score.pass} pass</span>
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-600 dark:text-red-400">{latest.score.fail} to improve</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{latest.score.notObserved} not observed</span>
            {latest.fromCache ? <span className="text-xs text-muted-foreground italic">(from recent cache)</span> : null}
          </div>
          <ul className="flex flex-col gap-2">
            {latest.findings.map((f) => (
              <li key={f.id} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5">{statusIcon(f.status)}</span>
                <span>
                  <span className="font-medium">{f.label}</span>
                  {f.observed ? <span className="text-muted-foreground"> — {f.observed}</span> : null}
                  {f.note ? <span className="block text-xs text-muted-foreground italic">{f.note}</span> : null}
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
