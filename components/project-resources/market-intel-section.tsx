"use client"

import { useState } from "react"
import { TrendingUp, Sparkles, Loader2, Users, DollarSign, Briefcase, Compass, Layers, Clock, RefreshCw, Building2, Star } from "lucide-react"
import { toast } from "sonner"
import { CofounderMarkdown } from "@/components/cofounder/markdown"
import { postJson } from "@/lib/client/api"
import type { MarketCard, ValuationSnapshot } from "@/lib/resources/business-intelligence"
import { RESOURCES_CREDIT_COSTS } from "@/lib/resources/resources-credits"

const CARD_ICONS: Record<string, React.ElementType> = {
  Users, DollarSign, Briefcase, Compass, Layers,
}

interface Props {
  projectId: string
  marketCards: MarketCard[]
  valuationSnapshot: ValuationSnapshot
  cachedResearch?: { text: string; generatedAt: number }
  credits: number
  onCreditsChanged: (n: number) => void
}

export function MarketIntelSection({ projectId, marketCards, valuationSnapshot, cachedResearch, credits, onCreditsChanged }: Props) {
  const [research, setResearch] = useState(cachedResearch ?? null)
  const [generating, setGenerating] = useState(false)
  const cost = RESOURCES_CREDIT_COSTS.marketResearch

  async function generate() {
    if (credits < cost) {
      toast.error(`You need ${cost} credits to research your market.`)
      return
    }
    setGenerating(true)
    try {
      const data = await postJson<{ text: string; generatedAt: number }>(
        `/api/projects/${projectId}/resources/market-research`
      )
      setResearch(data)
      onCreditsChanged(credits - cost)
      toast.success("Market research complete!")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to research market")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Market snapshot cards */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="size-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Market snapshot</h2>
        </div>
        <p className="mb-5 text-sm text-muted-foreground">Derived from your business plan — no AI cost.</p>

        {marketCards.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {marketCards.map((card) => {
              const Icon = CARD_ICONS[card.icon] ?? Briefcase
              return (
                <div key={card.label} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="size-4 text-primary" />
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{card.label}</p>
                  </div>
                  <p className="text-sm font-medium text-foreground leading-5">{card.value}</p>
                  {card.detail && <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
            <p className="text-sm text-muted-foreground">Complete your collaborate plan to see market snapshot data.</p>
          </div>
        )}
      </section>

      {/* Valuation snapshot */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="size-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Valuation & comparable companies</h2>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 mb-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Methodology</p>
              <p className="mt-1 font-semibold text-foreground">{valuationSnapshot.model.methodology}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Typical Range</p>
              <p className="mt-1 font-semibold text-foreground">{valuationSnapshot.model.lowMultiple} — {valuationSnapshot.model.highMultiple}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Example at your scale</p>
              <p className="mt-1 text-sm text-muted-foreground">{valuationSnapshot.model.exampleMetric}</p>
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Key value drivers</p>
            <ul className="space-y-2">
              {valuationSnapshot.keyDrivers.map((driver, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Star className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  {driver}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Giants in this space</p>
          <div className="space-y-3">
            {valuationSnapshot.giants.map((giant) => (
              <div key={giant.name} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-semibold text-foreground">{giant.name}</p>
                    <p className="text-xs text-muted-foreground">{giant.niche} · Founded {giant.founded}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-primary">{giant.lastValuation}</p>
                    <p className="text-[10px] text-muted-foreground">{giant.revenueRange}</p>
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{giant.whatMadeThem}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Market Research */}
      <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <h3 className="font-semibold text-foreground">Deep market research</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              AI-generated market size estimates, buyer personas, timing analysis, and entry strategy — specific to this business.
            </p>
          </div>
          {!research && (
            <button
              onClick={generate}
              disabled={generating || credits < cost}
              className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {generating ? "Researching…" : `Research my market (${cost} credits)`}
            </button>
          )}
        </div>

        {research && (
          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="size-3" />
                Generated {new Date(research.generatedAt).toLocaleDateString()}
              </p>
              <button
                onClick={generate}
                disabled={generating || credits < cost}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                <RefreshCw className="size-3" />
                Refresh ({cost} credits)
              </button>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <CofounderMarkdown>{research.text}</CofounderMarkdown>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
