"use client"

import useSWR from "swr"
import Link from "next/link"
import {
  Loader2,
  AlertTriangle,
  Shield,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  RefreshCw,
  MessageSquare,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { jsonFetcher } from "@/lib/client/api"
import { AdminNav } from "@/components/admin-nav"

interface SectionFeedback {
  id: string
  label: string
  up: number
  down: number
  total: number
  sentiment: number | null
}

interface FeedbackStats {
  totalVotes: number
  totalUp: number
  totalDown: number
  overallSentiment: number | null
  sections: SectionFeedback[]
}

function SentimentBar({ up, down }: { up: number; down: number }) {
  const total = up + down
  if (total === 0) return <div className="h-2 w-full rounded-full bg-muted" />

  const upPct = Math.round((up / total) * 100)
  const downPct = 100 - upPct

  return (
    <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full">
      <div
        className="rounded-full bg-green-500 transition-all"
        style={{ width: `${upPct}%` }}
      />
      <div
        className="rounded-full bg-red-400 transition-all"
        style={{ width: `${downPct}%` }}
      />
    </div>
  )
}

function SentimentBadge({ sentiment }: { sentiment: number | null }) {
  if (sentiment === null) {
    return (
      <Badge variant="outline" className="gap-1 text-xs text-muted-foreground border-border">
        <Minus className="size-3" />
        No votes
      </Badge>
    )
  }

  if (sentiment >= 80) {
    return (
      <Badge variant="outline" className="gap-1 text-xs text-green-500 border-green-500/30">
        <TrendingUp className="size-3" />
        {sentiment}% positive
      </Badge>
    )
  }

  if (sentiment >= 50) {
    return (
      <Badge variant="outline" className="gap-1 text-xs text-amber-500 border-amber-500/30">
        <Minus className="size-3" />
        {sentiment}% positive
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="gap-1 text-xs text-red-500 border-red-500/30">
      <TrendingDown className="size-3" />
      {sentiment}% positive
    </Badge>
  )
}

export default function AdminFeedbackPage() {
  const { data, error, isLoading, mutate } = useSWR<FeedbackStats>(
    "/api/admin/feedback",
    jsonFetcher,
    { refreshInterval: 30000 },
  )

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <AdminNav />
        <div className="mx-auto max-w-6xl px-6 py-10 text-center">
          <AlertTriangle className="size-10 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-semibold">Access Denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You don&apos;t have permission to access this page.
          </p>
        </div>
      </main>
    )
  }

  const stats = data
  const sections = stats?.sections ?? []

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AdminNav />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Admin
              </p>
              <Badge variant="secondary" className="gap-1 text-xs">
                <Shield className="size-3" />
                Admin Panel
              </Badge>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Documentation Feedback
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Vote counts and sentiment per documentation section.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            className="gap-1.5"
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </header>

        {/* ── Summary Cards ── */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Votes</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums">
                    {stats?.totalVotes ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    across all sections
                  </p>
                </div>
                <div className="rounded-lg bg-primary/10 p-2">
                  <MessageSquare className="size-4 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Positive Votes</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums text-green-500">
                    {stats?.totalUp ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    👍 helpful
                  </p>
                </div>
                <div className="rounded-lg bg-green-500/10 p-2">
                  <ThumbsUp className="size-4 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Negative Votes</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums text-red-500">
                    {stats?.totalDown ?? 0}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    👎 needs work
                  </p>
                </div>
                <div className="rounded-lg bg-red-500/10 p-2">
                  <ThumbsDown className="size-4 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Overall Sentiment</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums">
                    {stats?.overallSentiment !== null
                      ? `${stats?.overallSentiment}%`
                      : "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    positive rate
                  </p>
                </div>
                <div className="rounded-lg bg-primary/10 p-2">
                  <BarChart3 className="size-4 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Section Breakdown ── */}
        <section className="mt-10">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Section Breakdown
          </p>

          {sections.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="size-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-lg font-medium">No feedback data yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Votes will appear here once users start rating doc sections.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {sections.map((section) => (
                <div
                  key={section.id}
                  className="rounded-lg border border-border bg-card p-5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium">{section.label}</h3>
                        <SentimentBadge sentiment={section.sentiment} />
                      </div>

                      <div className="mt-3 flex items-center gap-4">
                        <div className="flex-1">
                          <SentimentBar up={section.up} down={section.down} />
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="size-3 text-green-500" />
                          {section.up}
                        </span>
                        <span className="flex items-center gap-1">
                          <ThumbsDown className="size-3 text-red-500" />
                          {section.down}
                        </span>
                        <span>{section.total} total votes</span>
                      </div>
                    </div>

                    {/* Mini bar chart for visual comparison */}
                    <div className="hidden sm:flex items-end gap-0.5 h-10 shrink-0">
                      <div
                        className="w-4 rounded-t bg-green-500/60 transition-all"
                        style={{
                          height: section.up > 0
                            ? `${Math.max((section.up / Math.max(...sections.map((s) => s.up + s.down), 1)) * 100, 8)}%`
                            : "0%",
                        }}
                        title={`${section.up} up`}
                      />
                      <div
                        className="w-4 rounded-t bg-red-400/60 transition-all"
                        style={{
                          height: section.down > 0
                            ? `${Math.max((section.down / Math.max(...sections.map((s) => s.up + s.down), 1)) * 100, 8)}%`
                            : "0%",
                        }}
                        title={`${section.down} down`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Quick Insights ── */}
        {sections.length > 0 && (
          <section className="mt-10">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
              Quick Insights
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Most helpful section */}
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <TrendingUp className="size-3.5 text-green-500" />
                    Highest Sentiment
                  </div>
                  {(() => {
                    const best = [...sections]
                      .filter((s) => s.total > 0)
                      .sort((a, b) => (b.sentiment ?? 0) - (a.sentiment ?? 0))[0]
                    return best ? (
                      <>
                        <p className="font-medium">{best.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {best.sentiment}% positive · {best.total} votes
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No data</p>
                    )
                  })()}
                </CardContent>
              </Card>

              {/* Needs most improvement */}
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <TrendingDown className="size-3.5 text-red-500" />
                    Needs Improvement
                  </div>
                  {(() => {
                    const worst = [...sections]
                      .filter((s) => s.total >= 3)
                      .sort((a, b) => (a.sentiment ?? 100) - (b.sentiment ?? 100))[0]
                    return worst && (worst.sentiment ?? 100) < 80 ? (
                      <>
                        <p className="font-medium">{worst.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {worst.sentiment}% positive · {worst.down} negative votes
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        All sections performing well
                      </p>
                    )
                  })()}
                </CardContent>
              </Card>

              {/* Most voted section */}
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <BarChart3 className="size-3.5 text-primary" />
                    Most Active Section
                  </div>
                  {(() => {
                    const most = [...sections].sort(
                      (a, b) => b.total - a.total,
                    )[0]
                    return most && most.total > 0 ? (
                      <>
                        <p className="font-medium">{most.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {most.total} votes · {most.up} up / {most.down} down
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No data</p>
                    )
                  })()}
                </CardContent>
              </Card>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
