"use client"

import { useMemo, useState, type ElementType } from "react"
import Link from "next/link"
import useSWR from "swr"
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Calendar,
  Download,
  Globe,
  Megaphone,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { jsonFetcher } from "@/lib/client/api"
import { AdminSelfCredit } from "@/components/admin-self-credit"
import { ADMIN_LEAVE, ADMIN_NAV, allAdminNavItems } from "@/components/admin/admin-nav-config"
import { cn } from "@/lib/utils"

interface OnboardingBreakdown {
  label: string
  count: number
}

interface AdminStats {
  users: { total: number; verified: number; admins: number; newToday: number; newThisWeek: number }
  credits: { totalHeld: number; totalGranted: number; totalCharged: number; totalRefunded: number }
  projects: { total: number; building: number; ready: number; failed: number; byMode: { website: number; scratch: number } }
  builds: { total: number; running: number; succeeded: number; failed: number }
  topUps: { pending: number; approved: number; rejected: number; totalAmount: number }
  onboarding: {
    completed: number
    bySource: OnboardingBreakdown[]
    byRole: OnboardingBreakdown[]
    bySignalType: OnboardingBreakdown[]
    byRevenueTarget?: OnboardingBreakdown[]
    byTargetUsers?: OnboardingBreakdown[]
    byEffortScale?: OnboardingBreakdown[]
    byHoursPerDay?: OnboardingBreakdown[]
    byIntent?: OnboardingBreakdown[]
    bySelectedPlan?: OnboardingBreakdown[]
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

type FrStats = {
  total: number
  newThisWeek: number
  underReview: number
  planned: number
  inProgress: number
  shipped: number
  totalVotes: number
}

function Stat({
  label,
  value,
  subtitle,
  href,
}: {
  label: string
  value: string | number
  subtitle?: string
  href?: string
}) {
  const inner = (
    <>
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
    </>
  )
  const className = "rounded-2xl border border-border bg-card p-4"
  if (href) {
    return (
      <Link href={href} className={cn(className, "block transition-colors hover:border-primary/30 hover:bg-accent/40")}>
        {inner}
      </Link>
    )
  }
  return <div className={className}>{inner}</div>
}

function BarList({
  title,
  icon: Icon,
  items,
  tone = "bg-primary/60",
}: {
  title: string
  icon: ElementType
  items: OnboardingBreakdown[]
  tone?: string
}) {
  const total = items.reduce((sum, item) => sum + item.count, 0)
  const max = items[0]?.count ?? 1
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <p className="text-sm font-medium">{title}</p>
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const pct = Math.round((item.count / max) * 100)
          const share = total > 0 ? Math.round((item.count / total) * 100) : 0
          return (
            <div key={item.label} className="flex items-center gap-3">
              <span className="w-28 truncate text-xs text-muted-foreground" title={item.label}>
                {item.label}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
              </div>
              <span className="w-16 text-right font-mono text-xs text-muted-foreground">
                {item.count} ({share}%)
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AdminDashboardPage() {
  const [onboardingFrom, setOnboardingFrom] = useState("")
  const [onboardingTo, setOnboardingTo] = useState("")
  const [preset, setPreset] = useState<string | null>(null)
  const [catalogQuery, setCatalogQuery] = useState("")

  const statsUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (onboardingFrom) params.set("onboardingFrom", onboardingFrom)
    if (onboardingTo) params.set("onboardingTo", onboardingTo)
    const qs = params.toString()
    return `/api/admin/stats${qs ? `?${qs}` : ""}`
  }, [onboardingFrom, onboardingTo])

  const { data: stats, error, isLoading, mutate } = useSWR<AdminStats>(statsUrl, jsonFetcher, { refreshInterval: 30000 })
  const { data: frStats } = useSWR<FrStats>("/api/admin/feature-requests?stats=1", jsonFetcher, { refreshInterval: 60000 })

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

  const attention = useMemo(() => {
    const items: { href: string; title: string; detail: string }[] = []
    if (stats?.topUps.pending) {
      items.push({
        href: "/admin/payments",
        title: `${stats.topUps.pending} payment${stats.topUps.pending === 1 ? "" : "s"} waiting`,
        detail: "Review mobile money top-ups",
      })
    }
    if (stats?.projects.failed) {
      items.push({
        href: "/admin/users",
        title: `${stats.projects.failed} failed project${stats.projects.failed === 1 ? "" : "s"}`,
        detail: "Builds that did not complete",
      })
    }
    if (stats?.builds.failed) {
      items.push({
        href: "/admin/infrastructure",
        title: `${stats.builds.failed} failed build run${stats.builds.failed === 1 ? "" : "s"}`,
        detail: "Inspect infrastructure and runs",
      })
    }
    if (stats?.infrastructure?.projectsOverStorageLimit) {
      items.push({
        href: "/admin/infrastructure",
        title: `${stats.infrastructure.projectsOverStorageLimit} over storage quota`,
        detail: "Apps hitting their storage limit",
      })
    }
    if (stats?.infrastructure?.syncFailures) {
      items.push({
        href: "/admin/infrastructure",
        title: `${stats.infrastructure.syncFailures} sync failure${stats.infrastructure.syncFailures === 1 ? "" : "s"}`,
        detail: "Totalum sync needs attention",
      })
    }
    if (frStats?.underReview) {
      items.push({
        href: "/admin/feature-requests",
        title: `${frStats.underReview} feature request${frStats.underReview === 1 ? "" : "s"} to review`,
        detail: "Demand waiting on a product decision",
      })
    }
    return items
  }, [stats, frStats])

  const catalog = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase()
    const groups = ADMIN_NAV.map((group) => ({
      ...group,
      items: q
        ? group.items.filter(
            (item) =>
              item.label.toLowerCase().includes(q) ||
              item.description.toLowerCase().includes(q) ||
              item.href.toLowerCase().includes(q),
          )
        : group.items,
    })).filter((group) => group.items.length > 0)
    const leave = q
      ? ADMIN_LEAVE.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q) ||
            item.href.toLowerCase().includes(q),
        )
      : ADMIN_LEAVE
    return { groups, leave }
  }, [catalogQuery])

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <AlertTriangle className="mx-auto size-8 text-destructive" />
        <h2 className="mt-4 text-lg font-semibold">We couldn't load admin stats.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          If you shouldn't be here, go back to the founder dashboard. Otherwise try again.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" onClick={() => void mutate()}>
            Try again
          </Button>
          <Link
            href="/dashboard"
            className="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-sm hover:bg-accent"
          >
            Founder home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Command center</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">What needs you, and what's running.</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Control center for every Atai admin page. Search, then open anything from here or the sidebar.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void mutate()} className="gap-1.5 self-start">
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
      </header>

      <section id="directory" className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">All admin pages</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {allAdminNavItems().length} destinations in this product, plus your account.
            </p>
          </div>
          <input
            value={catalogQuery}
            onChange={(e) => setCatalogQuery(e.target.value)}
            placeholder="Find a page…"
            className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm sm:w-72"
          />
        </div>
        <nav className="mt-3 flex flex-wrap gap-2 text-xs">
          {ADMIN_NAV.map((group) => (
            <a key={group.id} href={`#admin-${group.id}`} className="rounded-full border border-border px-3 py-1 text-muted-foreground hover:text-foreground">
              {group.label}
            </a>
          ))}
        </nav>
        <div className="mt-4 space-y-6">
          {catalog.groups.map((group) => (
            <div key={group.id} id={`admin-${group.id}`}>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{group.label}</p>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-accent/40"
                    >
                      <span className="rounded-lg border border-border p-2 text-muted-foreground group-hover:text-foreground">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          {item.label}
                          <ArrowRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </span>
                        <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">{item.href}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{item.description}</span>
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
          {catalog.leave.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Your account</p>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {catalog.leave.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-start gap-3 rounded-2xl border border-dashed border-border bg-card/50 p-4 hover:bg-accent/40"
                    >
                      <Icon className="mt-0.5 size-4 text-muted-foreground" />
                      <span>
                        <span className="block text-sm font-medium">{item.label}</span>
                        <span className="block font-mono text-[11px] text-muted-foreground">{item.href}</span>
                        <span className="block text-xs text-muted-foreground">{item.description}</span>
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ) : null}
          {catalog.groups.length === 0 && catalog.leave.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pages match that search.</p>
          ) : null}
        </div>
      </section>

      {isLoading && !stats ? (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
      ) : null}

      {attention.length > 0 ? (
        <section className="mt-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-amber-800 dark:text-amber-300">Needs attention</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {attention.map((item) => (
              <li key={item.href + item.title}>
                <Link href={item.href} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-background/70 px-3 py-2.5 hover:bg-accent">
                  <span>
                    <span className="block text-sm font-medium">{item.title}</span>
                    <span className="block text-xs text-muted-foreground">{item.detail}</span>
                  </span>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : stats ? (
        <p className="mt-6 text-sm text-muted-foreground">Nothing urgent in the queues right now.</p>
      ) : null}

      <section className="mt-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Snapshot</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Users" value={stats?.users.total ?? "—"} subtitle={`${stats?.users.verified ?? 0} verified · ${stats?.users.newToday ?? 0} today`} href="/admin/users" />
          <Stat label="Projects" value={stats?.projects.total ?? "—"} subtitle={`${stats?.projects.building ?? 0} building · ${stats?.projects.failed ?? 0} failed`} />
          <Stat label="Credits held" value={(stats?.credits.totalHeld ?? 0).toLocaleString()} subtitle={`Granted ${(stats?.credits.totalGranted ?? 0).toLocaleString()}`} href="/admin/transactions" />
          <Stat
            label="Payments pending"
            value={stats?.topUps.pending ?? "—"}
            subtitle={`${(stats?.topUps.totalAmount ?? 0).toLocaleString()} approved volume`}
            href="/admin/payments"
          />
          <Stat label="Build runs" value={stats?.builds.total ?? "—"} subtitle={`${stats?.builds.running ?? 0} running · ${stats?.builds.failed ?? 0} failed`} />
          <Stat label="Publishes" value={stats?.publishing.total ?? "—"} subtitle={`${stats?.publishing.succeeded ?? 0} succeeded · ${stats?.publishing.failed ?? 0} failed`} />
          <Stat
            label="Feature requests"
            value={frStats?.total ?? "—"}
            subtitle={`${frStats?.underReview ?? 0} need review · ${frStats?.totalVotes ?? 0} votes`}
            href="/admin/feature-requests"
          />
          <Stat
            label="Managed apps"
            value={stats?.infrastructure?.totalManaged ?? "—"}
            subtitle={stats?.infrastructure ? `${(stats.infrastructure.totalStorageUsed / (1024 * 1024 * 1024)).toFixed(1)} GB storage` : undefined}
            href="/admin/infrastructure"
          />
        </div>
      </section>

      <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Credits granted" value={`+${(stats?.credits.totalGranted ?? 0).toLocaleString()}`} />
        <Stat label="Credits charged" value={`-${(stats?.credits.totalCharged ?? 0).toLocaleString()}`} />
        <Stat label="Credits refunded" value={`+${(stats?.credits.totalRefunded ?? 0).toLocaleString()}`} />
        <Stat label="New users this week" value={stats?.users.newThisWeek ?? "—"} href="/admin/users" />
      </section>

      <section className="mt-10">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Onboarding</p>
          <div className="flex flex-wrap items-center gap-2">
            {stats &&
            (stats.onboarding.bySource.length > 0 || stats.onboarding.byRole.length > 0 || stats.onboarding.bySignalType.length > 0) ? (
              <button
                type="button"
                onClick={() => {
                  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
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
                  addRows("Revenue target", stats.onboarding.byRevenueTarget ?? [])
                  addRows("User target", stats.onboarding.byTargetUsers ?? [])
                  addRows("Effort", stats.onboarding.byEffortScale ?? [])
                  addRows("Hours / day", stats.onboarding.byHoursPerDay ?? [])
                  addRows("Intent", stats.onboarding.byIntent ?? [])
                  addRows("Selected plan", stats.onboarding.bySelectedPlan ?? [])
                  const csv = rows.map((r) => r.map(esc).join(",")).join("\n")
                  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement("a")
                  a.href = url
                  a.download = `onboarding-analytics-${new Date().toISOString().slice(0, 10)}.csv`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs"
              >
                <Download className="size-3.5" />
                Export CSV
              </button>
            ) : null}
            <div className="flex items-center gap-1 rounded-lg border border-border p-1">
              {[
                { label: "7d", days: 7 },
                { label: "30d", days: 30 },
                { label: "90d", days: 90 },
                { label: "All", days: null },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p.label, p.days)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium",
                    preset === p.label ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <Calendar className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="date"
                  value={onboardingFrom}
                  onChange={(e) => {
                    setOnboardingFrom(e.target.value)
                    setPreset(null)
                  }}
                  className="h-8 rounded-lg border border-input bg-transparent pl-7 pr-2 text-xs"
                />
              </div>
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={onboardingTo}
                onChange={(e) => {
                  setOnboardingTo(e.target.value)
                  setPreset(null)
                }}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs"
              />
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Stat
            label="Onboarding completed"
            value={stats?.onboarding.completed ?? "—"}
            subtitle={
              stats?.users.total
                ? `${Math.round(((stats.onboarding.completed ?? 0) / stats.users.total) * 100)}% of ${stats.users.total} users`
                : undefined
            }
          />
        </div>
        {stats?.onboarding.bySource?.length ? (
          <div className="mt-4">
            <BarList title="How users found us" icon={Megaphone} items={stats.onboarding.bySource} />
          </div>
        ) : null}
        {stats?.onboarding.byRole?.length ? (
          <div className="mt-4">
            <BarList title="User roles" icon={Briefcase} items={stats.onboarding.byRole} tone="bg-emerald-500/60" />
          </div>
        ) : null}
        {stats?.onboarding.bySignalType?.length ? (
          <div className="mt-4 rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <Globe className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium">What users are building</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {stats.onboarding.bySignalType.map((s) => (
                <span key={s.label} className="rounded-full border border-border px-3 py-1 text-sm">
                  {s.label === "url" ? "Website mirroring" : s.label === "idea" ? "From scratch" : s.label}
                  <span className="ml-2 font-mono text-xs text-muted-foreground">{s.count}</span>
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {stats?.onboarding.byIntent?.length ? (
          <div className="mt-4">
            <BarList title="How they want to use Atai" icon={Briefcase} items={stats.onboarding.byIntent} tone="bg-sky-500/60" />
          </div>
        ) : null}
        {stats?.onboarding.byRevenueTarget?.length ? (
          <div className="mt-4">
            <BarList title="Revenue target" icon={Megaphone} items={stats.onboarding.byRevenueTarget} />
          </div>
        ) : null}
        {stats?.onboarding.byTargetUsers?.length ? (
          <div className="mt-4">
            <BarList title="Users they want" icon={Globe} items={stats.onboarding.byTargetUsers} tone="bg-emerald-500/60" />
          </div>
        ) : null}
        {stats?.onboarding.byEffortScale?.length ? (
          <div className="mt-4">
            <BarList title="Effort (1–10)" icon={Briefcase} items={stats.onboarding.byEffortScale} />
          </div>
        ) : null}
        {stats?.onboarding.byHoursPerDay?.length ? (
          <div className="mt-4">
            <BarList title="Hours per day" icon={Calendar} items={stats.onboarding.byHoursPerDay} tone="bg-sky-500/60" />
          </div>
        ) : null}
        {stats?.onboarding.bySelectedPlan?.length ? (
          <div className="mt-4">
            <BarList title="Plan chosen in onboarding" icon={Megaphone} items={stats.onboarding.bySelectedPlan} />
          </div>
        ) : null}
      </section>

      {stats ? (
        <section className="mt-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Publishing</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total publishes" value={stats.publishing.total} />
            <Stat label="Succeeded" value={stats.publishing.succeeded} />
            <Stat label="Failed" value={stats.publishing.failed} />
            <Stat
              label="Credits spent"
              value={stats.publishing.creditsSpent.toLocaleString()}
              subtitle={stats.publishing.avgDurationMs > 0 ? `Avg ${Math.round(stats.publishing.avgDurationMs / 1000)}s` : undefined}
            />
          </div>
          {stats.publishing.byDay.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-border bg-card p-4">
              <p className="mb-3 text-sm font-medium">Publishes over 30 days</p>
              <div className="flex h-24 items-end gap-1">
                {stats.publishing.byDay.map((day) => {
                  const maxCount = Math.max(...stats.publishing.byDay.map((d) => d.count), 1)
                  const height = (day.count / maxCount) * 100
                  return (
                    <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-sm bg-primary/60"
                        style={{ height: `${Math.max(height, 4)}%` }}
                        title={`${day.date}: ${day.count} publishes (${day.succeeded} succeeded)`}
                      />
                      <span className="w-full truncate text-center text-[9px] text-muted-foreground">{day.date.slice(5)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
          {stats.publishing.recentEvents.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-border bg-card p-4">
              <p className="mb-3 text-sm font-medium">Recent publishes</p>
              <ul className="space-y-2">
                {stats.publishing.recentEvents.map((e) => (
                  <li key={e.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          e.status === "success" ? "bg-emerald-500" : e.status === "failed" ? "bg-destructive" : "bg-primary",
                        )}
                      />
                      {e.projectName}
                      <span className="text-xs text-muted-foreground">{e.status}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {e.durationMs ? `${Math.round(e.durationMs / 1000)}s · ` : ""}
                      {new Date(e.createdAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {stats?.infrastructure ? (
        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Infrastructure</p>
            <Link href="/admin/infrastructure" className="text-xs text-primary hover:underline">
              Full dashboard
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Managed applications" value={stats.infrastructure.totalManaged} />
            <Stat
              label="Storage used"
              value={`${(stats.infrastructure.totalStorageUsed / (1024 * 1024 * 1024)).toFixed(1)} GB`}
              subtitle={`of ${(stats.infrastructure.totalStorageCapacity / (1024 * 1024 * 1024)).toFixed(1)} GB`}
            />
            <Stat label="Infra usage" value={`${stats.infrastructure.totalInfraUsed.toLocaleString()} / ${stats.infrastructure.totalInfraCap.toLocaleString()}`} />
            <Stat label="Est. gross profit" value={stats.infrastructure.estimatedGrossProfit.toLocaleString()} />
          </div>
          {stats.infrastructure.byPlan.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {stats.infrastructure.byPlan.map((p) => (
                <span key={p.planId} className="rounded-full border border-border px-3 py-1 text-xs">
                  {p.planId} · {p.count}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="mt-10 rounded-2xl border border-border bg-card p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Operator utility</p>
        <p className="mt-1 text-sm text-muted-foreground">Grant yourself credits for testing. Also on /admin/tools.</p>
        <AdminSelfCredit />
      </section>
    </div>
  )
}
