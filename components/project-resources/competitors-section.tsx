"use client"

import { useState } from "react"
import { Users, Sparkles, Loader2, ExternalLink, ThumbsUp, ThumbsDown, Clock, RefreshCw, Shield, Zap } from "lucide-react"
import { toast } from "sonner"
import { postJson } from "@/lib/client/api"
import type { ApplicationSpecification } from "@/lib/types/specification"
import type { CompetitorProfile } from "./resources-client"
import { RESOURCES_CREDIT_COSTS } from "@/lib/resources/resources-credits"

interface Props {
  projectId: string
  spec: ApplicationSpecification
  cachedCompetitors?: { data: CompetitorProfile[]; generatedAt: number }
  credits: number
  onCreditsChanged: (n: number) => void
}

export function CompetitorsSection({ projectId, spec, cachedCompetitors, credits, onCreditsChanged }: Props) {
  const [competitors, setCompetitors] = useState<CompetitorProfile[]>(cachedCompetitors?.data ?? [])
  const [generatedAt, setGeneratedAt] = useState(cachedCompetitors?.generatedAt ?? null)
  const [generating, setGenerating] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const cost = RESOURCES_CREDIT_COSTS.competitors

  async function find() {
    if (credits < cost) {
      toast.error(`You need ${cost} credits to research competitors.`)
      return
    }
    setGenerating(true)
    try {
      const data = await postJson<{ competitors: CompetitorProfile[]; generatedAt: number }>(
        `/api/projects/${projectId}/resources/competitors`
      )
      setCompetitors(data.competitors)
      setGeneratedAt(data.generatedAt)
      onCreditsChanged(credits - cost)
      toast.success(`Found ${data.competitors.length} competitors!`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to find competitors")
    } finally {
      setGenerating(false)
    }
  }

  const FIT_LEVEL_LABEL: Record<string, string> = {
    "Bootstrapped": "Bootstrapped",
    "Seed": "Seed",
    "Series A": "Series A",
    "Series B": "Series B",
    "Series C+": "Series C+",
    "Public": "Public",
    "Acquired": "Acquired",
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="size-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Competitive intelligence</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Real competitors in your space — their positioning, strengths, weaknesses, and what you can learn from them.
          </p>
        </div>
        {competitors.length === 0 ? (
          <button
            onClick={find}
            disabled={generating || credits < cost}
            className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {generating ? "Searching…" : `Find competitors (${cost} credits)`}
          </button>
        ) : (
          <button
            onClick={find}
            disabled={generating || credits < cost}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent disabled:opacity-40"
          >
            <RefreshCw className="size-3" />
            Refresh ({cost} credits)
          </button>
        )}
      </div>

      {generatedAt && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="size-3" />
          Last updated {new Date(generatedAt).toLocaleDateString()}
        </p>
      )}

      {competitors.length === 0 && !generating && (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <Users className="mx-auto size-10 text-muted-foreground mb-3" />
          <p className="font-medium text-foreground">No competitor data yet</p>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
            Click "Find competitors" and we'll research the real players in your space — their pricing, positioning, strengths, and weaknesses.
          </p>
        </div>
      )}

      {competitors.length > 0 && (
        <div className="space-y-4">
          {competitors.map((c, i) => (
            <div key={c.name} className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === c.name ? null : c.name)}
                className="w-full p-4 text-left hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">{c.name}</p>
                        {c.url && (
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground hover:text-primary"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                        {c.fundingStatus && (
                          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            {c.fundingStatus}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{c.tagline}</p>
                    </div>
                  </div>
                  <p className="shrink-0 text-xs text-muted-foreground">{c.pricing}</p>
                </div>
              </button>

              {expanded === c.name && (
                <div className="border-t border-border p-4 space-y-4">
                  {c.targetCustomer && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Who they serve</p>
                      <p className="text-sm text-foreground">{c.targetCustomer}</p>
                    </div>
                  )}

                  {c.competitiveEdge && (
                    <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                      <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1 flex items-center gap-1">
                        <Zap className="size-3" /> Their competitive edge
                      </p>
                      <p className="text-sm text-foreground">{c.competitiveEdge}</p>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    {c.strengths?.length && (
                      <div>
                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mb-2">
                          <ThumbsUp className="size-3" /> Strengths
                        </p>
                        <ul className="space-y-1">
                          {c.strengths.map((s, si) => (
                            <li key={si} className="text-sm text-muted-foreground flex items-start gap-1.5">
                              <Shield className="size-3 shrink-0 mt-0.5 text-emerald-500" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {c.weaknesses?.length && (
                      <div>
                        <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1 mb-2">
                          <ThumbsDown className="size-3" /> Weaknesses
                        </p>
                        <ul className="space-y-1">
                          {c.weaknesses.map((w, wi) => (
                            <li key={wi} className="text-sm text-muted-foreground flex items-start gap-1.5">
                              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-rose-400" />
                              {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {c.businessModel && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Business model</p>
                      <p className="text-sm text-muted-foreground">{c.businessModel}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
