"use client"

import { useState } from "react"
import { Megaphone, Sparkles, Loader2, Clock, RefreshCw, ChevronDown, ChevronUp, Search, Globe, Mail, Users, Rocket, FileText, Handshake, Share, Zap } from "lucide-react"
import { toast } from "sonner"
import { CofounderMarkdown } from "@/components/cofounder/markdown"
import { postJson } from "@/lib/client/api"
import type { MarketingChannel } from "@/lib/resources/business-intelligence"
import { RESOURCES_CREDIT_COSTS } from "@/lib/resources/resources-credits"

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  Search, Globe, Users, Mail, Megaphone, Rocket, FileText, Handshake, Share, Zap,
}

const FIT_STYLES = {
  high: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  low: "bg-muted text-muted-foreground border-border",
}

const DIFFICULTY_STYLES = {
  easy: "text-emerald-600 dark:text-emerald-400",
  medium: "text-amber-600 dark:text-amber-400",
  hard: "text-rose-600 dark:text-rose-400",
}

interface Props {
  projectId: string
  channels: MarketingChannel[]
  cachedPlaybook?: { text: string; generatedAt: number }
  credits: number
  onCreditsChanged: (n: number) => void
}

export function MarketingPlaybookSection({ projectId, channels, cachedPlaybook, credits, onCreditsChanged }: Props) {
  const [playbook, setPlaybook] = useState(cachedPlaybook ?? null)
  const [generating, setGenerating] = useState(false)
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null)
  const cost = RESOURCES_CREDIT_COSTS.marketingPlaybook

  async function generate() {
    if (credits < cost) {
      toast.error(`You need ${cost} credits to generate a marketing playbook.`)
      return
    }
    setGenerating(true)
    try {
      const data = await postJson<{ text: string; generatedAt: number }>(
        `/api/projects/${projectId}/resources/marketing-playbook`
      )
      setPlaybook(data)
      onCreditsChanged(credits - cost)
      toast.success("Marketing playbook generated!")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate playbook")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Channel cards */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Megaphone className="size-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Marketing channels</h2>
        </div>
        <p className="mb-5 text-sm text-muted-foreground">
          Channels ranked by fit for your specific business type — derived from your plan.
        </p>

        <div className="space-y-3">
          {channels.map((channel) => {
            const Icon = CHANNEL_ICONS[channel.icon] ?? Megaphone
            const isOpen = expandedChannel === channel.name
            return (
              <div key={channel.name} className="rounded-xl border border-border bg-card overflow-hidden">
                <button
                  onClick={() => setExpandedChannel(isOpen ? null : channel.name)}
                  className="w-full px-4 py-3 text-left hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Icon className="size-4 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-foreground">{channel.name}</p>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${FIT_STYLES[channel.fit]}`}>
                            {channel.fit} fit
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <p className={`text-xs font-medium ${DIFFICULTY_STYLES[channel.difficulty]}`}>
                            {channel.difficulty} difficulty
                          </p>
                          <p className="text-xs text-muted-foreground">{channel.timeToResults}</p>
                        </div>
                      </div>
                    </div>
                    {isOpen ? <ChevronUp className="size-4 text-muted-foreground shrink-0" /> : <ChevronDown className="size-4 text-muted-foreground shrink-0" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border px-4 py-3 space-y-3">
                    <p className="text-sm text-muted-foreground">{channel.why}</p>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Starting tactics</p>
                      <ul className="space-y-1.5">
                        {channel.tactics.map((tactic, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                            {tactic}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* AI Playbook */}
      <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <h3 className="font-semibold text-foreground">Full 90-day marketing playbook</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Week-by-week plan for your top channels with actual copy angles, messaging templates, and success metrics — specific to this business.
            </p>
          </div>
          {!playbook && (
            <button
              onClick={generate}
              disabled={generating || credits < cost}
              className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {generating ? "Generating…" : `Generate playbook (${cost} credits)`}
            </button>
          )}
        </div>

        {playbook && (
          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="size-3" />
                Generated {new Date(playbook.generatedAt).toLocaleDateString()}
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
              <CofounderMarkdown>{playbook.text}</CofounderMarkdown>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
