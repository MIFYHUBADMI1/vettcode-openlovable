"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import useSWR from "swr"
import {
  ArrowLeft, Loader2, AlertTriangle, Shield, CreditCard, Search,
  Download, RefreshCw, CheckCircle2, XCircle, Clock, Ban, ArrowUpRight,
  ArrowDownLeft, DollarSign, Calendar, Package, Users,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { jsonFetcher } from "@/lib/client/api"
import { toast } from "sonner"
import { AdminNav } from "@/components/admin-nav"

interface UserBillingProfile {
  id: string
  email: string
  name: string
  authProvider: string
  emailVerified: boolean
  credits: number
  isAdmin: boolean
  suspended?: boolean
  banned?: boolean
  createdAt: number
  lastLoginAt?: number
  billing: {
    totalGranted: number
    totalCharged: number
    totalRefunded: number
    grantCount: number
    chargeCount: number
    refundCount: number
    netCredits: number
  }
  topUps: {
    total: number
    approved: number
    pending: number
    totalSpent: number
    totalCreditsPurchased: number
    recent: {
      id: string
      packageId: string
      credits: number
      expectedAmount: number
      paymentNetwork: string
      status: string
      createdAt: number
    }[]
  }
  projects: {
    total: number
    active: number
    failed: number
  }
  builds: {
    total: number
    successful: number
    totalCreditsSpent: number
    successRate: number
  }
  recentTransactions: {
    id: string
    type: string
    amount: number
    reason: string
    createdAt: number
  }[]
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function AdminSubscriptionsPage() {
  const [search, setSearch] = useState("")
  const [selectedSub, setSelectedSub] = useState<UserBillingProfile | null>(null)

  const { data, error, isLoading, mutate } = useSWR<{ users: UserBillingProfile[]; total: number }>(
    "/api/admin/billing/user-billing",
    jsonFetcher,
    { refreshInterval: 30000 },
  )

  const handleExport = useCallback(() => {
    if (!data?.users) return
    const headers = ["User", "Email", "Credits", "Total Granted", "Total Charged", "Total Refunded", "Top-Ups", "Top-Up Revenue", "Projects", "Builds", "Build Success Rate"]
    const rows = data.users.map((u: UserBillingProfile) => [
      u.name,
      u.email,
      u.credits,
      u.billing.totalGranted,
      u.billing.totalCharged,
      u.billing.totalRefunded,
      u.topUps.total,
      u.topUps.totalSpent,
      u.projects.total,
      u.builds.total,
      `${u.builds.successRate}%`,
    ])
    const csv = [headers, ...rows].map((r: (string | number)[]) => r.map((c: string | number) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `user-billing-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported billing data for ${data.users.length} users`)
  }, [data])

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
          <p className="mt-2 text-sm text-muted-foreground">You don&apos;t have permission to access this page.</p>
        </div>
      </main>
    )
  }

  const users = data?.users ?? []
  const filtered = users.filter((u: UserBillingProfile) => {
    if (!search) return true
    const q = search.toLowerCase()
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)
  })

  const totalRevenue = users.reduce((sum: number, u: UserBillingProfile) => sum + u.topUps.totalSpent, 0)
  const totalCreditsPurchased = users.reduce((sum: number, u: UserBillingProfile) => sum + u.topUps.totalCreditsPurchased, 0)
  const totalCreditsHeld = users.reduce((sum: number, u: UserBillingProfile) => sum + u.credits, 0)
  const totalCreditsCharged = users.reduce((sum: number, u: UserBillingProfile) => sum + u.billing.totalCharged, 0)

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
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Subscriptions & Billing</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              View and manage user subscriptions, credit balances, and billing activity.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
              <Download className="size-3.5" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => mutate()} className="gap-1.5">
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
          </div>
        </header>

        {/* ── Summary Cards ── */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="mt-2 text-2xl font-semibold text-green-500">${totalRevenue.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Credits Held by Users</p>
              <p className="mt-2 text-2xl font-semibold text-primary">{totalCreditsHeld.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Total Credits Charged</p>
              <p className="mt-2 text-2xl font-semibold text-red-500">{totalCreditsCharged.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Total Users</p>
              <p className="mt-2 text-2xl font-semibold">{data?.total ?? 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Search ── */}
        <div className="mt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search users by name, email, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* ── User Billing List ── */}
        <div className="mt-6">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="size-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-lg font-medium">No users found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search ? "Try a different search term." : "No users registered yet."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((user: UserBillingProfile) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedSub(user)}
                  className="w-full text-left rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-accent/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{user.name}</span>
                        {user.isAdmin && (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Shield className="size-3" />
                            Admin
                          </Badge>
                        )}
                        {user.suspended && (
                          <Badge variant="outline" className="gap-1 text-xs text-amber-500 border-amber-500/30">
                            <Clock className="size-3" />
                            Suspended
                          </Badge>
                        )}
                        {user.banned && (
                          <Badge variant="outline" className="gap-1 text-xs text-destructive border-destructive/30">
                            <Ban className="size-3" />
                            Banned
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <span>{user.email}</span>
                        <span className="font-mono text-xs">{user.authProvider}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-lg font-semibold text-primary">{user.credits.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">credits</p>
                    </div>
                  </div>

                  {/* Mini stats */}
                  <div className="mt-3 grid grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Revenue</p>
                      <p className="font-mono font-medium text-green-500">${user.topUps.totalSpent.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Top-Ups</p>
                      <p className="font-mono font-medium">{user.topUps.total}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Projects</p>
                      <p className="font-mono font-medium">{user.projects.total}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Builds</p>
                      <p className="font-mono font-medium">{user.builds.total} <span className="text-muted-foreground">({user.builds.successRate}%)</span></p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── User Billing Detail Dialog ── */}
      <Dialog open={!!selectedSub} onOpenChange={(open) => !open && setSelectedSub(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedSub && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedSub.name}
                  {selectedSub.isAdmin && (
                    <Badge variant="secondary" className="gap-1 text-xs"><Shield className="size-3" /> Admin</Badge>
                  )}
                </DialogTitle>
                <DialogDescription>{selectedSub.email}</DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                {/* Credit Balance */}
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <CreditCard className="size-4 text-primary" />
                    Credit Balance
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Credits</p>
                      <p className="mt-1 text-2xl font-bold text-primary">{selectedSub.credits.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Net Credits</p>
                      <p className="mt-1 text-2xl font-bold">{selectedSub.billing.netCredits.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Refunded</p>
                      <p className="mt-1 text-2xl font-bold text-amber-500">{selectedSub.billing.totalRefunded.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Billing Summary */}
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="size-4 text-primary" />
                    Billing Summary
                  </p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Granted</span>
                      <span className="font-mono text-green-500">+{selectedSub.billing.totalGranted.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Charged</span>
                      <span className="font-mono text-red-500">-{selectedSub.billing.totalCharged.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Refunded</span>
                      <span className="font-mono text-amber-500">+{selectedSub.billing.totalRefunded.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2">
                      <span className="text-muted-foreground">Net Credits</span>
                      <span className="font-mono font-semibold">{selectedSub.billing.netCredits.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Top-Up History */}
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <CreditCard className="size-4 text-primary" />
                    Top-Up History
                  </p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Top-Ups</span>
                      <span className="font-mono">{selectedSub.topUps.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Spent</span>
                      <span className="font-mono font-semibold text-green-500">{selectedSub.topUps.totalSpent.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Credits Purchased</span>
                      <span className="font-mono">{selectedSub.topUps.totalCreditsPurchased.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pending</span>
                      <span className="font-mono">{selectedSub.topUps.pending}</span>
                    </div>
                  </div>
                  {selectedSub.topUps.recent.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-xs text-muted-foreground">Recent Top-Ups</p>
                      {selectedSub.topUps.recent.map((t: UserBillingProfile["topUps"]["recent"][0]) => (
                        <div key={t.id} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
                          <div className="flex items-center gap-2">
                            <span className={`size-1.5 rounded-full ${t.status === "approved" ? "bg-green-500" : t.status === "rejected" ? "bg-red-500" : "bg-amber-500"}`} />
                            <span className="font-mono">{t.packageId}</span>
                            <span className="text-muted-foreground">{t.paymentNetwork?.toUpperCase()}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-green-500">{t.credits.toLocaleString()} cr</span>
                            <span className="text-muted-foreground">{timeAgo(t.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Projects & Builds */}
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Package className="size-4 text-primary" />
                    Projects & Builds
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Projects</span>
                        <span className="font-mono">{selectedSub.projects.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Active</span>
                        <span className="font-mono text-blue-500">{selectedSub.projects.active}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Failed</span>
                        <span className="font-mono text-red-500">{selectedSub.projects.failed}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Builds</span>
                        <span className="font-mono">{selectedSub.builds.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Successful</span>
                        <span className="font-mono text-green-500">{selectedSub.builds.successful}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Credits Spent on Builds</span>
                        <span className="font-mono">{selectedSub.builds.totalCreditsSpent.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Transactions */}
                {selectedSub.recentTransactions.length > 0 && (
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Clock className="size-4 text-primary" />
                      Recent Transactions
                    </p>
                    <div className="mt-3 space-y-1.5">
                      {selectedSub.recentTransactions.map((tx: UserBillingProfile["recentTransactions"][0]) => (
                        <div key={tx.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {tx.amount >= 0 ? (
                              <ArrowDownLeft className="size-3 text-green-500 shrink-0" />
                            ) : (
                              <ArrowUpRight className="size-3 text-red-500 shrink-0" />
                            )}
                            <span className="truncate text-muted-foreground">{tx.reason}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-3">
                            <span className={`font-mono text-xs ${tx.amount >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {tx.amount >= 0 ? "+" : ""}{tx.amount.toLocaleString()}
                            </span>
                            <span className="text-muted-foreground">{timeAgo(tx.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedSub(null)}>
                  Close
                </Button>
                <Link href="/admin/users">
                  <Button variant="outline">
                    View in User Management
                  </Button>
                </Link>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  )
}
