"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import useSWR from "swr"
import {
  Loader2, AlertTriangle, Shield, Search, Download, Users, Coins,
  DollarSign, CreditCard, TrendingUp, ArrowUpRight, ArrowDownLeft,
  RefreshCw, ShoppingCart, Package, CheckCircle2,
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

export default function AdminUserBillingPage() {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [selectedUser, setSelectedUser] = useState<UserBillingProfile | null>(null)
  const limit = 50

  const { data, error, isLoading, mutate } = useSWR<{ users: UserBillingProfile[]; total: number; hasMore: boolean }>(
    `/api/admin/billing/user-billing?limit=${limit}&offset=${page * limit}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
    jsonFetcher,
    { refreshInterval: 30000 },
  )

  const handleExport = useCallback(() => {
    if (!data?.users) return
    const headers = [
      "User", "Email", "Credits", "Total Granted", "Total Charged", "Total Refunded",
      "Net Credits", "Top-Ups", "Top-Up Revenue", "Credits Purchased",
      "Projects", "Active Projects", "Failed Projects",
      "Builds", "Successful Builds", "Build Success Rate", "Build Credits Spent",
    ]
    const rows = data.users.map((u) => [
      u.name, u.email, u.credits, u.billing.totalGranted, u.billing.totalCharged,
      u.billing.totalRefunded, u.billing.netCredits, u.topUps.total,
      u.topUps.totalSpent, u.topUps.totalCreditsPurchased, u.projects.total,
      u.projects.active, u.projects.failed, u.builds.total, u.builds.successful,
      `${u.builds.successRate}%`, u.builds.totalCreditsSpent,
    ])
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `user-billing-profiles-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${data.users.length} user billing profiles`)
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
  const totalRevenue = users.reduce((sum, u) => sum + u.topUps.totalSpent, 0)
  const totalCreditsHeld = users.reduce((sum, u) => sum + u.credits, 0)
  const totalCreditsCharged = users.reduce((sum, u) => sum + u.billing.totalCharged, 0)

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
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">User Billing Profiles</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Detailed billing profiles for each user with spending analytics.
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
              <p className="text-xs text-muted-foreground">Total Users</p>
              <p className="mt-2 text-2xl font-semibold">{data?.total ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="mt-2 text-2xl font-semibold text-green-500">{totalRevenue.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Credits Held</p>
              <p className="mt-2 text-2xl font-semibold text-primary">{totalCreditsHeld.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Credits Charged</p>
              <p className="mt-2 text-2xl font-semibold text-red-500">{totalCreditsCharged.toLocaleString()}</p>
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
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              className="pl-10"
            />
          </div>
        </div>

        {/* ── User Billing List ── */}
        <div className="mt-6">
          {users.length === 0 ? (
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
            <div className="space-y-2">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className="w-full text-left rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-accent/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{user.name}</span>
                        {user.isAdmin && (
                          <Badge variant="secondary" className="gap-1 text-[10px]">
                            <Shield className="size-2.5" />
                            Admin
                          </Badge>
                        )}
                        {user.suspended && (
                          <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">Suspended</Badge>
                        )}
                        {user.banned && (
                          <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">Banned</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-lg font-semibold text-primary">{user.credits.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">credits</p>
                    </div>
                  </div>

                  {/* Mini billing stats */}
                  <div className="mt-3 grid grid-cols-5 gap-2 text-[11px]">
                    <div>
                      <p className="text-muted-foreground">Revenue</p>
                      <p className="font-mono font-medium text-green-500">{user.topUps.totalSpent.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Purchased</p>
                      <p className="font-mono font-medium">{user.topUps.totalCreditsPurchased.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Charged</p>
                      <p className="font-mono font-medium text-red-500">{user.billing.totalCharged.toLocaleString()}</p>
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

        {/* ── Pagination ── */}
        {data && (data.total > limit || page > 0) && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {page * limit + 1}–{Math.min((page + 1) * limit, data.total)} of {data.total}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={!data.hasMore}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── User Billing Detail Dialog ── */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedUser && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedUser.name}
                  {selectedUser.isAdmin && (
                    <Badge variant="secondary" className="gap-1 text-xs"><Shield className="size-3" /> Admin</Badge>
                  )}
                </DialogTitle>
                <DialogDescription>{selectedUser.email}</DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                {/* Credit Balance */}
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Coins className="size-4 text-primary" />
                    Credit Balance
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Current Balance</p>
                      <p className="mt-1 text-2xl font-bold text-primary">{selectedUser.credits.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Granted</p>
                      <p className="mt-1 text-2xl font-bold text-green-500">+{selectedUser.billing.totalGranted.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Charged</p>
                      <p className="mt-1 text-2xl font-bold text-red-500">-{selectedUser.billing.totalCharged.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Spending Analysis */}
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="size-4 text-primary" />
                    Spending Analysis
                  </p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Top-Ups</span>
                      <span className="font-mono">{selectedUser.topUps.total} ({selectedUser.topUps.approved} approved)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Revenue Generated</span>
                      <span className="font-mono font-semibold text-green-500">{selectedUser.topUps.totalSpent.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Credits Purchased</span>
                      <span className="font-mono">{selectedUser.topUps.totalCreditsPurchased.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pending Top-Ups</span>
                      <span className="font-mono">{selectedUser.topUps.pending}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2">
                      <span className="text-muted-foreground">Net Credit Flow</span>
                      <span className={`font-mono font-semibold ${selectedUser.billing.netCredits >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {selectedUser.billing.netCredits >= 0 ? "+" : ""}{selectedUser.billing.netCredits.toLocaleString()}
                      </span>
                    </div>
                  </div>
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
                        <span className="text-muted-foreground">Projects</span>
                        <span className="font-mono">{selectedUser.projects.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Active</span>
                        <span className="font-mono text-blue-500">{selectedUser.projects.active}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Failed</span>
                        <span className="font-mono text-red-500">{selectedUser.projects.failed}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Builds</span>
                        <span className="font-mono">{selectedUser.builds.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Successful</span>
                        <span className="font-mono text-green-500">{selectedUser.builds.successful}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Build Credits Spent</span>
                        <span className="font-mono">{selectedUser.builds.totalCreditsSpent.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Top-Ups */}
                {selectedUser.topUps.recent.length > 0 && (
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <ShoppingCart className="size-4 text-primary" />
                      Recent Top-Ups
                    </p>
                    <div className="mt-3 space-y-1.5">
                      {selectedUser.topUps.recent.map((t) => (
                        <div key={t.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
                          <div className="flex items-center gap-2">
                            <span className={`size-1.5 rounded-full ${
                              t.status === "approved" ? "bg-green-500" :
                              t.status === "rejected" ? "bg-red-500" : "bg-amber-500"
                            }`} />
                            <span className="font-mono">{t.packageId}</span>
                            <span className="text-muted-foreground">{t.paymentNetwork?.toUpperCase()}</span>
                            <Badge variant="outline" className={`text-[10px] ${
                              t.status === "approved" ? "text-green-500 border-green-500/30" :
                              t.status === "rejected" ? "text-red-500 border-red-500/30" : "text-amber-500 border-amber-500/30"
                            }`}>{t.status}</Badge>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-green-500">{t.credits.toLocaleString()} cr</span>
                            <span className="font-mono text-muted-foreground">{t.expectedAmount.toLocaleString()}</span>
                            <span className="text-muted-foreground">{timeAgo(t.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Transactions */}
                {selectedUser.recentTransactions.length > 0 && (
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <CreditCard className="size-4 text-primary" />
                      Recent Transactions
                    </p>
                    <div className="mt-3 space-y-1.5">
                      {selectedUser.recentTransactions.map((tx) => (
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
                <Button variant="outline" onClick={() => setSelectedUser(null)}>Close</Button>
                <Link href="/admin/users">
                  <Button variant="outline">Manage User</Button>
                </Link>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  )
}
