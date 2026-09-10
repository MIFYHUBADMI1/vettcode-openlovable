"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowRight, Users, CreditCard, FolderKanban, Hammer, ShoppingCart, Activity, Shield, RefreshCw, AlertTriangle, Loader2, User, Key, BarChart3, Megaphone, Briefcase, Globe, Calendar, X, Download, Database, HardDrive, Zap, TrendingUp, MessageSquare } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { jsonFetcher } from "@/lib/client/api"
import { AdminNav } from "@/components/admin-nav"

interface OnboardingBreakdown {
  label: string
  count: number
}

interface AdminStats {
  users: {
    total: number
    verified: number
    admins: number
    newToday: number
    newThisWeek: number
  }
  credits: {
    totalHeld: number
    totalGranted: number
    totalCharged: number
    totalRefunded: number
  }
  projects: {
    total: number
    building: number
    ready: number
    failed: number
    byMode: { website: number; scratch: number }
  }
  builds: {
    total: number
    running: number
    succeeded: number
    failed: number
  }
  topUps: {
    pending: number
    approved: number
    rejected: number
    totalAmount: number
  }
  onboarding: {
    completed: number
    bySource: OnboardingBreakdown[]
    byRole: OnboardingBreakdown[]
    bySignalType: OnboardingBreakdown[]
  }
  publishing: {
    total: number
    succeeded: number
    failed: number
    creditsSpent: number
    avgDurationMs: number
    byDay: { date: string; count: number; succeeded: number }[]
    recentEvents: { id: string; projectName: string; status: string; createdAt: number; durationMs?: number }[]
  }
  infrastructure?: {
    totalManaged: number
    byPlan: { planId: string; planName: string; count: number }[]
    totalStorageUsed: number
    totalStorageCapacity: number
    totalInfraUsed: number
    totalInfraCap: number
    projectsNearStorageLimit: number
    projectsOverStorageLimit: number
    projectsNearInfraLimit: number
    expiredSubscriptions: number
    syncFailures: number
    totalInfraRevenue: number
    estimatedInfraCost: number
    estimatedGrossProfit: number
  }
}

function StatCard({ label, value, subtitle, icon: Icon, color }: {
  label: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`mt-2 text-3xl font-semibold tabular-nums ${color}`}>{value}</p>
            {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`rounded-lg p-2 ${color === "text-green-500" ? "bg-green-500/10" : color === "text-red-500" ? "bg-red-500/10" : color === "text-amber-500" ? "bg-amber-500/10" : "bg-primary/10"}`}>
            <Icon className={`size-4 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function QuickLink({ href, title, description, icon: Icon, badge }: {
  href: string
  title: string
  description: string
  icon: React.ElementType
  badge?: { label: string; color: string }
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/30 hover:bg-accent/50"
    >
      <div className="flex items-start gap-4">
        <div className="rounded-lg bg-primary/10 p-2.5">
          <Icon className="size-5 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{title}</p>
            {badge && (
              <Badge variant="outline" className={`text-xs ${badge.color}`}>
                {badge.label}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  )
}

export default function AdminDashboardPage() {
  // Date range filter for onboarding insights
  const [onboardingFrom, setOnboardingFrom] = useState("")
  const [onboardingTo, setOnboardingTo] = useState("")
  const [preset, setPreset] = useState<string | null>(null)

  const statsUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (onboardingFrom) params.set("onboardingFrom", onboardingFrom)
    if (onboardingTo) params.set("onboardingTo", onboardingTo)
    const qs = params.toString()
    return `/api/admin/stats${qs ? `?${qs}` : ""}`
  }, [onboardingFrom, onboardingTo])

  const { data: stats, error, isLoading, mutate } = useSWR<AdminStats>(
    statsUrl,
    jsonFetcher,
    { refreshInterval: 30000 },
  )

  function applyPreset(name: string, days: number | null) {
    setPreset(name)
    if (days === null) {
      setOnboardingFrom("")
      setOnboardingTo("")
    } else {
      const now = new Date()
      const from = new Date(now)
      from.setDate(from.getDate() - days)
      setOnboardingFrom(from.toISOString().slice(0, 10))
      setOnboardingTo(now.toISOString().slice(0, 10))
    }
  }

  function clearDateFilter() {
    setOnboardingFrom("")
    setOnboardingTo("")
    setPreset(null)
  }

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
        <div className="mx-auto max-w-6xl px-6 py-10">
          <Link href="/settings" className="font-mono text-xs text-primary hover:underline">← Settings</Link>
          <div className="mt-10 text-center">
            <AlertTriangle className="size-10 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-semibold">Access Denied</h1>
            <p className="mt-2 text-sm text-muted-foreground">You don&apos;t have permission to access this page.</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AdminNav />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Admin</p>
              <Badge variant="secondary" className="gap-1 text-xs">
                <Shield className="size-3" />
                Admin Panel
              </Badge>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              System overview and quick access to admin tools.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => mutate()} className="gap-1.5">
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </header>

        {/* ── Users ── */}
        <section className="mt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Users</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Users"
              value={stats?.users.total ?? 0}
              subtitle={`${stats?.users.verified ?? 0} verified`}
              icon={Users}
              color="text-foreground"
            />
            <StatCard
              label="Admins"
              value={stats?.users.admins ?? 0}
              icon={Shield}
              color="text-primary"
            />
            <StatCard
              label="New Today"
              value={stats?.users.newToday ?? 0}
              icon={Activity}
              color="text-green-500"
            />
            <StatCard
              label="New This Week"
              value={stats?.users.newThisWeek ?? 0}
              icon={Activity}
              color="text-blue-500"
            />
          </div>
        </section>

        {/* ── Credits ── */}
        <section className="mt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Credits</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Held by Users"
              value={(stats?.credits.totalHeld ?? 0).toLocaleString()}
              icon={CreditCard}
              color="text-primary"
            />
            <StatCard
              label="Total Granted"
              value={`+${(stats?.credits.totalGranted ?? 0).toLocaleString()}`}
              icon={CreditCard}
              color="text-green-500"
            />
            <StatCard
              label="Total Charged"
              value={`-${(stats?.credits.totalCharged ?? 0).toLocaleString()}`}
              icon={CreditCard}
              color="text-red-500"
            />
            <StatCard
              label="Total Refunded"
              value={`+${(stats?.credits.totalRefunded ?? 0).toLocaleString()}`}
              icon={CreditCard}
              color="text-amber-500"
            />
          </div>
        </section>

        {/* ── Projects & Builds ── */}
        <section className="mt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Projects & Builds</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Projects"
              value={stats?.projects.total ?? 0}
              subtitle={`${stats?.projects.byMode?.website ?? 0} website · ${stats?.projects.byMode?.scratch ?? 0} scratch`}
              icon={FolderKanban}
              color="text-foreground"
            />
            <StatCard
              label="Currently Building"
              value={stats?.projects.building ?? 0}
              icon={Hammer}
              color="text-amber-500"
            />
            <StatCard
              label="Ready"
              value={stats?.projects.ready ?? 0}
              icon={FolderKanban}
              color="text-green-500"
            />
            <StatCard
              label="Failed"
              value={stats?.projects.failed ?? 0}
              icon={FolderKanban}
              color="text-red-500"
            />
          </div>
        </section>

        {/* ── Builds Detail ── */}
        <section className="mt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Build Runs</p>
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard label="Total Runs" value={stats?.builds.total ?? 0} icon={Hammer} color="text-foreground" />
            <StatCard label="Running" value={stats?.builds.running ?? 0} icon={Hammer} color="text-amber-500" />
            <StatCard label="Succeeded" value={stats?.builds.succeeded ?? 0} icon={Hammer} color="text-green-500" />
            <StatCard label="Failed" value={stats?.builds.failed ?? 0} icon={Hammer} color="text-red-500" />
          </div>
        </section>

        {/* ── Top-Ups ── */}
        <section className="mt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Top-Ups</p>
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard
              label="Pending Review"
              value={stats?.topUps.pending ?? 0}
              icon={ShoppingCart}
              color={stats?.topUps.pending ? "text-amber-500" : "text-green-500"}
            />
            <StatCard label="Approved" value={stats?.topUps.approved ?? 0} icon={ShoppingCart} color="text-green-500" />
            <StatCard label="Rejected" value={stats?.topUps.rejected ?? 0} icon={ShoppingCart} color="text-red-500" />
            <StatCard
              label="Total Revenue"
              value={`${(stats?.topUps.totalAmount ?? 0).toLocaleString()}`}
              icon={CreditCard}
              color="text-primary"
            />
          </div>
        </section>

        {/* ── Onboarding Insights ── */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Onboarding Insights</p>
            <div className="flex items-center gap-2">
              {/* Export CSV */}
              {stats && (stats.onboarding.bySource.length > 0 || stats.onboarding.byRole.length > 0 || stats.onboarding.bySignalType.length > 0) && (
                <button
                  onClick={() => {
                    const esc = (s: string) => `"${s.replace(/"/g, '\"')}"`
                    const rows: string[][] = [["Category", "Label", "Count", "Percentage"]]
                    const addRows = (cat: string, items: OnboardingBreakdown[]) => {
                      const total = items.reduce((s, i) => s + i.count, 0)
                      items.forEach((item) => {
                        const pct = total > 0 ? Math.round((item.count / total) * 100) : 0
                        rows.push([cat, item.label, String(item.count), `${pct}%`])
                      })
                    }
                    addRows("Source", stats.onboarding.bySource)
                    addRows("Role", stats.onboarding.byRole)
                    addRows("Signal Type", stats.onboarding.bySignalType)
                    const csv = rows.map((r) => r.map(esc).join(",")).join("\n")
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement("a")
                    a.href = url
                    a.download = `onboarding-analytics-${new Date().toISOString().slice(0, 10)}.csv`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  className="h-8 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center gap-1.5"
                >
                  <Download className="size-3.5" />
                  Export CSV
                </button>
              )}
              {/* Preset buttons */}
              <div className="hidden sm:flex items-center gap-1 rounded-lg border border-border bg-card p-1">
                {[
                  { label: "7d", days: 7 },
                  { label: "30d", days: 30 },
                  { label: "90d", days: 90 },
                  { label: "All", days: null },
                ].map((p) => (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p.label, p.days)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      preset === p.label
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {/* Custom date inputs */}
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <input
                    type="date"
                    value={onboardingFrom}
                    onChange={(e) => { setOnboardingFrom(e.target.value); setPreset(null) }}
                    className="h-8 rounded-md border border-border bg-card pl-7 pr-2 text-xs text-foreground"
                  />
                </div>
                <span className="text-xs text-muted-foreground">to</span>
                <div className="relative">
                  <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <input
                    type="date"
                    value={onboardingTo}
                    onChange={(e) => { setOnboardingTo(e.target.value); setPreset(null) }}
                    className="h-8 rounded-md border border-border bg-card pl-7 pr-2 text-xs text-foreground"
                  />
                </div>
                {(onboardingFrom || onboardingTo) && (
                  <button
                    onClick={clearDateFilter}
                    className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    title="Clear filter"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Onboarding Completed"
              value={stats?.onboarding.completed ?? 0}
              subtitle={
                (onboardingFrom || onboardingTo)
                  ? `${onboardingFrom ?? "…"} → ${onboardingTo ?? "…"} · of ${stats?.users.total ?? 0} users`
                  : `${stats?.users.total ? Math.round(((stats?.onboarding.completed ?? 0) / stats.users.total) * 100) : 0}% completion rate · of ${stats?.users.total ?? 0} users`
              }
              icon={BarChart3}
              color="text-primary"
            />
            {stats?.onboarding.completed === 0 && stats?.users.total === 0 && (
              <div className="col-span-full rounded-lg border border-dashed border-border p-8 text-center">
                <BarChart3 className="size-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No users yet. Onboarding insights will appear here once users sign up.</p>
              </div>
            )}
          </div>

          {/* Sources */}
          {stats?.onboarding.bySource && stats.onboarding.bySource.length > 0 && (
            <div className="mt-4 rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Megaphone className="size-4 text-primary" />
                <p className="text-sm font-medium">How users found us</p>
              </div>
              <div className="space-y-2">
                {(() => {
                  const total = stats.onboarding.bySource.reduce((sum, s) => sum + s.count, 0)
                  return stats.onboarding.bySource.map((s) => {
                    const max = stats.onboarding.bySource[0]?.count ?? 1
                    const pct = Math.round((s.count / max) * 100)
                    const share = total > 0 ? Math.round((s.count / total) * 100) : 0
                    return (
                      <div key={s.label} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-28 truncate" title={s.label}>{s.label}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="font-mono text-xs text-muted-foreground w-16 text-right">{s.count} ({share}%)</span>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          )}

          {/* Roles */}
          {stats?.onboarding.byRole && stats.onboarding.byRole.length > 0 && (
            <div className="mt-4 rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Briefcase className="size-4 text-primary" />
                <p className="text-sm font-medium">User roles</p>
              </div>
              <div className="space-y-2">
                {(() => {
                  const total = stats.onboarding.byRole.reduce((sum, r) => sum + r.count, 0)
                  return stats.onboarding.byRole.map((r) => {
                    const max = stats.onboarding.byRole[0]?.count ?? 1
                    const pct = Math.round((r.count / max) * 100)
                    const share = total > 0 ? Math.round((r.count / total) * 100) : 0
                    return (
                      <div key={r.label} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-28 truncate" title={r.label}>{r.label}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-green-500/60" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="font-mono text-xs text-muted-foreground w-16 text-right">{r.count} ({share}%)</span>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          )}

          {/* Signal Types */}
          {stats?.onboarding.bySignalType && stats.onboarding.bySignalType.length > 0 && (
            <div className="mt-4 rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="size-4 text-primary" />
                <p className="text-sm font-medium">What users are building</p>
              </div>
              <div className="flex gap-4">
                {stats.onboarding.bySignalType.map((s) => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span className="text-sm font-medium capitalize">{s.label === "url" ? "Website mirroring" : s.label === "idea" ? "From scratch" : s.label}</span>
                    <Badge variant="secondary" className="font-mono text-xs">{s.count}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Publishing Analytics (Beta) ── */}
        {stats && (
          <section className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                Publishing Analytics
                <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">Beta</Badge>
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Total Publishes</p>
                  <p className="mt-1 text-2xl font-bold">{stats.publishing.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Succeeded</p>
                  <p className="mt-1 text-2xl font-bold text-green-600">{stats.publishing.succeeded}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Failed</p>
                  <p className="mt-1 text-2xl font-bold text-destructive">{stats.publishing.failed}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Credits Spent</p>
                  <p className="mt-1 text-2xl font-bold text-primary">{stats.publishing.creditsSpent.toLocaleString()}</p>
                  {stats.publishing.avgDurationMs > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Avg: {Math.round(stats.publishing.avgDurationMs / 1000)}s</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Publish by day chart */}
            {stats.publishing.byDay.length > 0 && (
              <div className="mt-4 border border-border bg-card p-4 rounded-lg">
                <p className="text-sm font-medium mb-3">Publishes over time (30 days)</p>
                <div className="flex items-end gap-1 h-24">
                  {stats.publishing.byDay.map((day) => {
                    const maxCount = Math.max(...stats.publishing.byDay.map((d) => d.count))
                    const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0
                    return (
                      <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-sm bg-primary/60 hover:bg-primary transition-colors"
                          style={{ height: `${Math.max(height, 4)}%` }}
                          title={`${day.date}: ${day.count} publishes (${day.succeeded} succeeded)`}
                        />
                        <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                          {day.date.slice(5)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Recent publish events */}
            {stats.publishing.recentEvents.length > 0 && (
              <div className="mt-4 border border-border bg-card p-4 rounded-lg">
                <p className="text-sm font-medium mb-3">Recent publishes</p>
                <div className="space-y-2">
                  {stats.publishing.recentEvents.map((e) => (
                    <div key={e.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={
                          e.status === "success" ? "size-2 rounded-full bg-green-500" :
                          e.status === "failed" ? "size-2 rounded-full bg-destructive" :
                          "size-2 rounded-full bg-primary animate-pulse"
                        } />
                        <span className="font-medium">{e.projectName}</span>
                        <Badge variant="outline" className={`text-[10px] ${
                          e.status === "success" ? "text-green-600 border-green-500/30" :
                          e.status === "failed" ? "text-destructive border-destructive/30" :
                          "text-primary border-primary/30"
                        }`}>{e.status}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {e.durationMs && <span>{Math.round(e.durationMs / 1000)}s</span>}
                        <span>{new Date(e.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {stats.publishing.total === 0 && (
              <div className="mt-4 border border-border bg-card p-6 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">No publishes yet. Publishing data will appear here once users deploy their apps.</p>
              </div>
            )}
          </section>
        )}

        {/* ── Infrastructure Summary ── */}
        {stats?.infrastructure && (
          <section className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Infrastructure</p>
              <Link
                href="/admin/infrastructure"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                Full infrastructure dashboard
                <ArrowRight className="size-3" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Managed Applications"
                value={stats.infrastructure.totalManaged}
                icon={Database}
                color="text-foreground"
              />
              <StatCard
                label="Total Storage Used"
                value={`${(stats.infrastructure.totalStorageUsed / (1024*1024*1024)).toFixed(1)} GB`}
                subtitle={`of ${(stats.infrastructure.totalStorageCapacity / (1024*1024*1024)).toFixed(1)} GB allocated`}
                icon={HardDrive}
                color="text-primary"
              />
              <StatCard
                label="Infrastructure Usage"
                value={`${stats.infrastructure.totalInfraUsed.toLocaleString()} / ${stats.infrastructure.totalInfraCap.toLocaleString()}`}
                icon={Zap}
                color="text-green-500"
              />
              <StatCard
                label="Estimated Gross Profit"
                value={`${stats.infrastructure.estimatedGrossProfit.toLocaleString()}`}
                icon={TrendingUp}
                color="text-green-500"
              />
            </div>
            {/* Plan distribution */}
            {stats.infrastructure.byPlan.length > 0 && (
              <div className="mt-4 flex gap-3 flex-wrap">
                {stats.infrastructure.byPlan.map((p) => (
                  <div key={p.planId} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
                    <span className="text-xs font-medium capitalize">{p.planId}</span>
                    <Badge variant="secondary" className="font-mono text-[10px]">{p.count}</Badge>
                  </div>
                ))}
              </div>
            )}
            {/* Alerts */}
            {(stats.infrastructure.projectsOverStorageLimit > 0 || stats.infrastructure.syncFailures > 0 || stats.infrastructure.expiredSubscriptions > 0) && (
              <div className="mt-3 flex gap-3 flex-wrap">
                {stats.infrastructure.projectsOverStorageLimit > 0 && (
                  <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/30">
                    {stats.infrastructure.projectsOverStorageLimit} over storage quota
                  </Badge>
                )}
                {stats.infrastructure.syncFailures > 0 && (
                  <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
                    {stats.infrastructure.syncFailures} sync failures
                  </Badge>
                )}
                {stats.infrastructure.expiredSubscriptions > 0 && (
                  <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/30">
                    {stats.infrastructure.expiredSubscriptions} expired
                  </Badge>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Quick Links ── */}
        <section className="mt-10">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Admin Tools</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <QuickLink
              href="/admin/payments"
              title="Payment Verifications"
              description="Review and verify Mobile Money top-up payments."
              icon={ShoppingCart}
              badge={stats?.topUps.pending ? { label: `${stats.topUps.pending} pending`, color: "text-amber-500 border-amber-500/30" } : undefined}
            />
            <QuickLink
              href="/admin/users"
              title="User Management"
              description="View users, manage credits, and review account details."
              icon={Users}
            />
            <QuickLink
              href="/admin/transactions"
              title="Credit Transactions"
              description="View all credit activity across all users."
              icon={CreditCard}
            />
            <QuickLink
              href="/admin/infrastructure"
              title="Infrastructure Control"
              description="Monitor plans, storage, Totalum sync, and costs."
              icon={Database}
            />
            <QuickLink
              href="/admin/referrals"
              title="Referral Management"
              description="View referrals, rewards, and fraud flags."
              icon={Users}
            />
            <QuickLink
              href="/admin/feedback"
              title="Doc Feedback"
              description="Vote counts and sentiment per documentation section."
              icon={MessageSquare}
            />
          </div>
        </section>

        {/* ── Account ── */}
        <section className="mt-10">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Account</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <QuickLink
              href="/settings/profile"
              title="Edit Profile & Avatar"
              description="Change your name, profile picture, and account details."
              icon={User}
            />
            <QuickLink
              href="/settings/security"
              title="Password & Security"
              description="Change your password, manage sessions, and update email."
              icon={Key}
            />
          </div>
        </section>
      </div>
    </main>
  )
}
