"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import useSWR from "swr"
import {
  ArrowRight, CreditCard, DollarSign, Users, ShoppingCart, TrendingUp,
  TrendingDown, RefreshCw, AlertTriangle, Loader2, BarChart3, Coins,
  ArrowUpRight, ArrowDownLeft, Package, Shield, Calendar, Download,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { jsonFetcher } from "@/lib/client/api"
import { AdminNav } from "@/components/admin-nav"

interface BillingOverview {
  summary: {
    totalUsers: number
    totalProjects: number
    totalBuilds: number
    successfulBuilds: number
    failedBuilds: number
    buildSuccessRate: number
  }
  credits: {
    totalHeld: number
    totalSubscriptionCredits: number
    totalPermanentCredits: number
    totalGranted: number
    totalCharged: number
    totalRefunded: number
    netCredits: number
  }
  revenue: {
    total: number
    today: number
    thisWeek: number
    thisMonth: number
    currency: string
  }
  payments: {
    total: number
    successful: number
    failed: number
    refunded: number
  }
  subscriptions: {
    total: number
    active: number
    cancelled: number
  }
  paymentTypeDistribution: { type: string; count: number; totalRevenue: number }[]
  topUsers: { id: string; name: string; email: string; credits: number; subscriptionCredits: number; permanentCredits: number }[]
  revenueByDay: { date: string; count: number; revenue: number; credits: number }[]
  transactionTypes: { type: string; count: number; totalAmount: number }[]
  buildCosts: { reason: string; count: number; totalCredits: number }[]
}

function StatCard({ label, value, subtitle, icon: Icon, color, trend }: {
  label: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  color: string
  trend?: { value: string; positive: boolean }
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
          <div className={`rounded-lg p-2 ${
            color === "text-green-500" ? "bg-green-500/10" :
            color === "text-red-500" ? "bg-red-500/10" :
            color === "text-amber-500" ? "bg-amber-500/10" :
            color === "text-blue-500" ? "bg-blue-500/10" :
            "bg-primary/10"
          }`}>
            <Icon className={`size-4 ${color}`} />
          </div>
        </div>
        {trend && (
          <div className="mt-2 flex items-center gap-1">
            {trend.positive ? (
              <TrendingUp className="size-3 text-green-500" />
            ) : (
              <TrendingDown className="size-3 text-red-500" />
            )}
            <span className={`text-xs ${trend.positive ? "text-green-500" : "text-red-500"}`}>
              {trend.value}
            </span>
          </div>
        )}
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

export default function AdminBillingPage() {
  const { data: overview, error, isLoading, mutate } = useSWR<BillingOverview>(
    "/api/admin/billing/overview",
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
        <div className="mx-auto max-w-6xl px-6 py-10">
          <AdminNav />
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
                Billing
              </Badge>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Billing Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Comprehensive overview of revenue, credits, payments, and billing health.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => mutate()} className="gap-1.5">
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </header>

        {/* ── Revenue Overview ── */}
        <section className="mt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Revenue</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Revenue"
              value={`$${(overview?.revenue.total ?? 0).toLocaleString()}`}
              icon={DollarSign}
              color="text-green-500"
            />
            <StatCard
              label="Today"
              value={`$${(overview?.revenue.today ?? 0).toLocaleString()}`}
              icon={Calendar}
              color="text-foreground"
            />
            <StatCard
              label="This Week"
              value={`$${(overview?.revenue.thisWeek ?? 0).toLocaleString()}`}
              icon={Calendar}
              color="text-blue-500"
            />
            <StatCard
              label="This Month"
              value={`$${(overview?.revenue.thisMonth ?? 0).toLocaleString()}`}
              icon={Calendar}
              color="text-primary"
            />
          </div>
        </section>

        {/* ── Credits Overview ── */}
        <section className="mt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Credits</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Held by Users"
              value={(overview?.credits.totalHeld ?? 0).toLocaleString()}
              icon={Coins}
              color="text-primary"
            />
            <StatCard
              label="Total Granted"
              value={`+${(overview?.credits.totalGranted ?? 0).toLocaleString()}`}
              icon={ArrowDownLeft}
              color="text-green-500"
            />
            <StatCard
              label="Total Charged"
              value={`-${(overview?.credits.totalCharged ?? 0).toLocaleString()}`}
              icon={ArrowUpRight}
              color="text-red-500"
            />
            <StatCard
              label="Total Refunded"
              value={`+${(overview?.credits.totalRefunded ?? 0).toLocaleString()}`}
              icon={CreditCard}
              color="text-amber-500"
            />
          </div>
        </section>

        {/* ── Payments (Dodo) ── */}
        <section className="mt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Payments (Dodo)</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Successful"
              value={overview?.payments.successful ?? 0}
              icon={ShoppingCart}
              color="text-green-500"
            />
            <StatCard
              label="Failed"
              value={overview?.payments.failed ?? 0}
              icon={ShoppingCart}
              color="text-red-500"
            />
            <StatCard
              label="Refunded"
              value={overview?.payments.refunded ?? 0}
              icon={ShoppingCart}
              color="text-amber-500"
            />
            <StatCard
              label="Total Payments"
              value={overview?.payments.total ?? 0}
              icon={ShoppingCart}
              color="text-foreground"
            />
          </div>
        </section>

        {/* ── Build Health ── */}
        <section className="mt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Build Health</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Builds"
              value={overview?.summary.totalBuilds ?? 0}
              icon={BarChart3}
              color="text-foreground"
            />
            <StatCard
              label="Succeeded"
              value={overview?.summary.successfulBuilds ?? 0}
              icon={BarChart3}
              color="text-green-500"
            />
            <StatCard
              label="Failed"
              value={overview?.summary.failedBuilds ?? 0}
              icon={BarChart3}
              color="text-red-500"
            />
            <StatCard
              label="Success Rate"
              value={`${overview?.summary.buildSuccessRate ?? 0}%`}
              icon={TrendingUp}
              color="text-primary"
            />
          </div>
        </section>

        {/* ── Revenue Chart ── */}
        {overview?.revenueByDay && overview.revenueByDay.length > 0 && (
          <section className="mt-8">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Revenue Trend (30 Days)</p>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-end gap-1 h-32">
                  {overview.revenueByDay.map((day) => {
                    const maxRevenue = Math.max(...overview.revenueByDay.map((d) => d.revenue))
                    const height = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0
                    return (
                      <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-sm bg-green-500/60 hover:bg-green-500 transition-colors"
                          style={{ height: `${Math.max(height, 4)}%` }}
                          title={`${day.date}: $${day.revenue.toLocaleString()} (${day.count} payments, ${day.credits.toLocaleString()} credits)`}
                        />
                        <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                          {day.date.slice(5)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* ── Payment Type Distribution ── */}
        {overview?.paymentTypeDistribution && overview.paymentTypeDistribution.length > 0 && (
          <section className="mt-8">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Payment Types</p>
            <Card>
              <CardContent className="p-5">
                <div className="space-y-3">
                  {overview.paymentTypeDistribution.map((pt) => {
                    const maxCount = Math.max(...overview.paymentTypeDistribution.map((p) => p.count))
                    const pct = maxCount > 0 ? (pt.count / maxCount) * 100 : 0
                    return (
                      <div key={pt.type} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-32 truncate" title={pt.type}>{pt.type}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="font-mono text-xs text-muted-foreground w-32 text-right">
                          {pt.count} payments · ${pt.totalRevenue.toLocaleString()}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* ── Top Users by Credits ── */}
        {overview?.topUsers && overview.topUsers.length > 0 && (
          <section className="mt-8">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Top Users by Credits</p>
            <Card>
              <CardContent className="p-5">
                <div className="space-y-2">
                  {overview.topUsers.map((user, idx) => (
                    <div key={user.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-muted-foreground w-6">#{idx + 1}</span>
                        <div>
                          <p className="text-sm font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <span className="font-mono text-sm font-semibold text-primary">
                        {user.credits.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* ── Transaction Types ── */}
        {overview?.transactionTypes && overview.transactionTypes.length > 0 && (
          <section className="mt-8">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Transaction Types</p>
            <Card>
              <CardContent className="p-5">
                <div className="space-y-3">
                  {overview.transactionTypes.map((tx) => {
                    const maxCount = Math.max(...overview.transactionTypes.map((t) => t.count))
                    const pct = maxCount > 0 ? (tx.count / maxCount) * 100 : 0
                    const color = tx.type === "grant" ? "bg-green-500/60" :
                      tx.type === "consume" || tx.type === "charge" ? "bg-red-500/60" :
                      tx.type === "reserve" ? "bg-amber-500/60" :
                      tx.type === "refund" ? "bg-blue-500/60" : "bg-primary/60"
                    return (
                      <div key={tx.type} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-24 truncate capitalize">{tx.type}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="font-mono text-xs text-muted-foreground w-32 text-right">
                          {tx.count} txs · {tx.totalAmount.toLocaleString()} credits
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* ── Quick Links ── */}
        <section className="mt-10">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Billing Management</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <QuickLink
              href="/admin/payments"
              title="Payment Records"
              description="View Dodo payment records and webhook events."
              icon={ShoppingCart}
            />
            <QuickLink
              href="/admin/billing/subscriptions"
              title="Subscriptions"
              description="View and manage all user subscriptions and plans."
              icon={CreditCard}
            />
            <QuickLink
              href="/admin/billing/plans"
              title="Subscription Plans"
              description="View and configure subscription plan details and pricing."
              icon={Package}
            />
            <QuickLink
              href="/admin/billing/credit-packs"
              title="Credit Packs"
              description="Manage permanent credit packs and their pricing."
              icon={Coins}
            />
            <QuickLink
              href="/admin/billing/audit"
              title="Billing Audit Log"
              description="Full audit trail of all credit transactions and billing events."
              icon={BarChart3}
            />
            <QuickLink
              href="/admin/billing/user-billing"
              title="User Billing Profiles"
              description="Detailed billing profiles for each user with spending analytics."
              icon={Users}
            />
            <QuickLink
              href="/admin/billing/webhooks"
              title="Webhook Events"
              description="View Dodo payment webhook events and their processing status."
              icon={BarChart3}
            />
            <QuickLink
              href="/admin/billing/configuration"
              title="Billing Configuration"
              description="View and manage billing system configuration and pricing."
              icon={Shield}
            />
            <QuickLink
              href="/admin/transactions"
              title="All Transactions"
              description="Raw credit transaction feed across all users."
              icon={CreditCard}
            />
          </div>
        </section>
      </div>
    </main>
  )
}
