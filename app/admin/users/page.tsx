"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowLeft, Users, Loader2, Search, Shield, CheckCircle2, XCircle, CreditCard, AlertTriangle, Ban, Clock, Trash2, LogOut, Megaphone, Briefcase, Globe, X, Filter, Calendar, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { postJson, patchJson, jsonFetcher } from "@/lib/client/api"
import { toast } from "sonner"
import { AdminNav } from "@/components/admin-nav"

interface AdminUser {
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
  onboarding?: {
    source?: string
    role?: string
    signalType?: string
    completedAt?: number
  }
}

interface UserTransaction {
  id: string
  type: string
  amount: number
  reason: string
  createdAt: number
}

interface UserDetail {
  user: AdminUser
  transactions: UserTransaction[]
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

export default function AdminUsersPage() {
  const { data, error, isLoading, mutate } = useSWR<{ users: AdminUser[] }>(
    "/api/admin/users",
    jsonFetcher,
    { refreshInterval: 30000 },
  )

  const [search, setSearch] = useState("")
  const [filterSource, setFilterSource] = useState("")
  const [filterRole, setFilterRole] = useState("")
  const [filterSignal, setFilterSignal] = useState("")
  const [dateMode, setDateMode] = useState<"joined" | "onboarding">("joined")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [datePreset, setDatePreset] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [adjustAction, setAdjustAction] = useState<"grant" | "deduct">("grant")
  const [adjustAmount, setAdjustAmount] = useState("")
  const [adjustReason, setAdjustReason] = useState("")
  const [adjustBusy, setAdjustBusy] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionDialog, setActionDialog] = useState<"suspend" | "ban" | "delete" | null>(null)
  const [actionReason, setActionReason] = useState("")

  const loadUserDetail = useCallback(async (user: AdminUser) => {
    setSelectedUser(user)
    setLoadingDetail(true)
    try {
      const result = await jsonFetcher<UserDetail>(`/api/admin/users/${user.id}`)
      setUserDetail(result)
    } catch {
      setUserDetail(null)
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  const handleAdjustClick = useCallback(() => {
    if (!selectedUser || !adjustAmount) return
    const amount = parseInt(adjustAmount, 10)
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount")
      return
    }
    // Require a reason for grants
    if (adjustAction === "grant" && !adjustReason.trim()) {
      toast.error("A reason is required when granting credits.")
      return
    }
    setShowConfirm(true)
  }, [selectedUser, adjustAction, adjustAmount, adjustReason])

  const handleAdjust = useCallback(async () => {
    if (!selectedUser || !adjustAmount) return
    const amount = parseInt(adjustAmount, 10)
    setShowConfirm(false)
    setAdjustBusy(true)
    try {
      const result = await postJson<{ message: string; newBalance: number }>(
        `/api/admin/users/${selectedUser.id}`,
        {
          action: adjustAction,
          amount,
          reason: adjustReason || undefined,
        },
      )
      toast.success(result.message)
      setSelectedUser(null)
      setUserDetail(null)
      setAdjustAmount("")
      setAdjustReason("")
      await mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to adjust credits")
    } finally {
      setAdjustBusy(false)
    }
  }, [selectedUser, adjustAction, adjustAmount, adjustReason, mutate])

  const handleUserAction = useCallback(async () => {
    if (!selectedUser || !actionDialog) return
    setActionBusy(true)
    try {
      const result = await patchJson<{ message: string }>(
        `/api/admin/users/${selectedUser.id}`,
        {
          action: actionDialog,
          reason: actionReason || undefined,
        },
      )
      toast.success(result.message)
      setActionDialog(null)
      setActionReason("")
      setSelectedUser(null)
      setUserDetail(null)
      await mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed")
    } finally {
      setActionBusy(false)
    }
  }, [selectedUser, actionDialog, actionReason, mutate])

  const handleRevokeSessions = useCallback(async () => {
    if (!selectedUser) return
    setActionBusy(true)
    try {
      const result = await patchJson<{ message: string }>(
        `/api/admin/users/${selectedUser.id}`,
        { action: "revoke_sessions" },
      )
      toast.success(result.message)
      setActionBusy(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed")
      setActionBusy(false)
    }
  }, [selectedUser])

  const handleToggleSuspend = useCallback(async () => {
    if (!selectedUser) return
    setActionBusy(true)
    try {
      const action = selectedUser.suspended ? "unsuspend" : "suspend"
      const result = await patchJson<{ message: string }>(
        `/api/admin/users/${selectedUser.id}`,
        { action },
      )
      toast.success(result.message)
      setSelectedUser(null)
      setUserDetail(null)
      await mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed")
    } finally {
      setActionBusy(false)
    }
  }, [selectedUser, mutate])

  const handleToggleBan = useCallback(async () => {
    if (!selectedUser) return
    setActionBusy(true)
    try {
      const action = selectedUser.banned ? "unban" : "ban"
      const result = await patchJson<{ message: string }>(
        `/api/admin/users/${selectedUser.id}`,
        { action },
      )
      toast.success(result.message)
      setSelectedUser(null)
      setUserDetail(null)
      await mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed")
    } finally {
      setActionBusy(false)
    }
  }, [selectedUser, mutate])

  const users = data?.users ?? []

  // Derive unique onboarding values for filter dropdowns
  const uniqueSources = [...new Set(users.map((u) => u.onboarding?.source).filter(Boolean))] as string[]
  const uniqueRoles = [...new Set(users.map((u) => u.onboarding?.role).filter(Boolean))] as string[]
  const uniqueSignals = [...new Set(users.map((u) => u.onboarding?.signalType).filter(Boolean))] as string[]

  const hasActiveFilters = filterSource || filterRole || filterSignal || dateFrom || dateTo

  function applyDatePreset(name: string, days: number | null) {
    setDatePreset(name)
    if (days === null) {
      setDateFrom("")
      setDateTo("")
    } else {
      const now = new Date()
      const from = new Date(now)
      from.setDate(from.getDate() - days)
      setDateFrom(from.toISOString().slice(0, 10))
      setDateTo(now.toISOString().slice(0, 10))
    }
  }

  function clearDateFilter() {
    setDateFrom("")
    setDateTo("")
    setDatePreset(null)
  }

  const filtered = users.filter((u) => {
    if (search) {
      const q = search.toLowerCase()
      const match =
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
      if (!match) return false
    }
    if (filterSource && u.onboarding?.source !== filterSource) return false
    if (filterRole && u.onboarding?.role !== filterRole) return false
    if (filterSignal && u.onboarding?.signalType !== filterSignal) return false
    // Date range filter
    if (dateFrom || dateTo) {
      const fromMs = dateFrom ? new Date(dateFrom).getTime() : 0
      const toMs = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 : Infinity
      if (dateMode === "joined") {
        if (u.createdAt < fromMs || u.createdAt > toMs) return false
      } else {
        if (!u.onboarding?.completedAt) return false
        if (u.onboarding.completedAt < fromMs || u.onboarding.completedAt > toMs) return false
      }
    }
    return true
  })

  // Loading / Error States
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
        <div className="mx-auto max-w-5xl px-6 py-10">
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

  const totalCredits = users.reduce((sum, u) => sum + u.credits, 0)
  const adminCount = users.filter((u) => u.isAdmin).length

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AdminNav />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex items-start justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Admin</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">User Management</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              View users, manage credits, and review account details.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              const headers = ["Name","Email","ID","Auth Provider","Verified","Credits","Admin","Suspended","Banned","Joined","Last Login","Onboarding Source","Onboarding Role","Signal Type","Onboarding Completed"]
              const rows = filtered.map((u) => [
                u.name,
                u.email,
                u.id,
                u.authProvider,
                u.emailVerified ? "Yes" : "No",
                u.credits,
                u.isAdmin ? "Yes" : "No",
                u.suspended ? "Yes" : "No",
                u.banned ? "Yes" : "No",
                new Date(u.createdAt).toISOString().slice(0, 10),
                u.lastLoginAt ? new Date(u.lastLoginAt).toISOString().slice(0, 10) : "",
                u.onboarding?.source ?? "",
                u.onboarding?.role ?? "",
                u.onboarding?.signalType ?? "",
                u.onboarding?.completedAt ? new Date(u.onboarding.completedAt).toISOString().slice(0, 10) : "",
              ])
              const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '\"')}"`).join(",")).join("\n")
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
              const url = URL.createObjectURL(blob)
              const a = document.createElement("a")
              a.href = url
              a.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`
              a.click()
              URL.revokeObjectURL(url)
              toast.success(`Exported ${filtered.length} users to CSV`)
            }} className="gap-1.5">
              <Download className="size-3.5" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => mutate()} className="gap-1.5">
              Refresh
            </Button>
          </div>
        </header>

        {/* Summary Cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Total Users</p>
              <p className="mt-2 text-2xl font-semibold">{users.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Total Credits Held</p>
              <p className="mt-2 text-2xl font-semibold text-primary">{totalCredits.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Admins</p>
              <p className="mt-2 text-2xl font-semibold">{adminCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filters */}
        <div className="mt-6 space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          {/* Onboarding Filters */}
          {(uniqueSources.length > 0 || uniqueRoles.length > 0 || uniqueSignals.length > 0) && (
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="size-3.5 text-muted-foreground" />
              {uniqueSources.length > 0 && (
                <select
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value)}
                  className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground"
                >
                  <option value="">All sources</option>
                  {uniqueSources.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}
              {uniqueRoles.length > 0 && (
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground"
                >
                  <option value="">All roles</option>
                  {uniqueRoles.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              )}
              {uniqueSignals.length > 0 && (
                <select
                  value={filterSignal}
                  onChange={(e) => setFilterSignal(e.target.value)}
                  className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground"
                >
                  <option value="">All types</option>
                  {uniqueSignals.map((s) => (
                    <option key={s} value={s}>{s === "url" ? "Website mirroring" : s === "idea" ? "From scratch" : s}</option>
                  ))}
                </select>
              )}
              {hasActiveFilters && (
                <button
                  onClick={() => { setFilterSource(""); setFilterRole(""); setFilterSignal(""); clearDateFilter() }}
                  className="h-8 rounded-md border border-border bg-card px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center gap-1"
                >
                  <X className="size-3" />
                  Clear filters
                </button>
              )}
              <span className="text-xs text-muted-foreground">
                {filtered.length} of {users.length} users
              </span>
            </div>
          )}

          {/* Date Range Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="size-3.5 text-muted-foreground" />
            {/* Mode toggle */}
            <div className="flex rounded-md border border-border overflow-hidden">
              <button
                onClick={() => setDateMode("joined")}
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                  dateMode === "joined"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                Joined
              </button>
              <button
                onClick={() => setDateMode("onboarding")}
                className={`px-2.5 py-1 text-xs font-medium transition-colors border-l border-border ${
                  dateMode === "onboarding"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                Onboarding
              </button>
            </div>
            {/* Preset buttons */}
            <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
              {[{ label: "7d", days: 7 }, { label: "30d", days: 30 }, { label: "90d", days: 90 }, { label: "All", days: null }].map((p) => (
                <button
                  key={p.label}
                  onClick={() => applyDatePreset(p.label, p.days)}
                  className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                    datePreset === p.label
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {/* Custom date inputs */}
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setDatePreset(null) }}
                  className="h-8 rounded-md border border-border bg-card pl-7 pr-2 text-xs text-foreground"
                />
              </div>
              <span className="text-xs text-muted-foreground">to</span>
              <div className="relative">
                <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setDatePreset(null) }}
                  className="h-8 rounded-md border border-border bg-card pl-7 pr-2 text-xs text-foreground"
                />
              </div>
              {(dateFrom || dateTo) && (
                <button
                  onClick={clearDateFilter}
                  className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  title="Clear date filter"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Users List */}
        <div className="mt-6">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="size-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-lg font-medium">No users found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hasActiveFilters ? "No users match the current filters." : search ? "Try a different search term." : "No users registered yet."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((user) => (
                <button
                  key={user.id}
                  onClick={() => loadUserDetail(user)}
                  className="w-full text-left rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-accent/50"
                >
                  <div className="flex items-center justify-between gap-4">
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
                        {user.emailVerified ? (
                          <Badge variant="outline" className="gap-1 text-xs text-green-500 border-green-500/30">
                            <CheckCircle2 className="size-3" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                            <XCircle className="size-3" />
                            Unverified
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{user.email}</span>
                        <span className="font-mono text-xs">{user.authProvider}</span>
                        <span className="text-xs">Joined {timeAgo(user.createdAt)}</span>
                      </div>
                      {user.onboarding && (
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          {user.onboarding.source && (
                            <Badge variant="secondary" className="gap-1 text-[10px] px-1.5 py-0">
                              <Megaphone className="size-2.5" />
                              {user.onboarding.source}
                            </Badge>
                          )}
                          {user.onboarding.role && (
                            <Badge variant="secondary" className="gap-1 text-[10px] px-1.5 py-0">
                              <Briefcase className="size-2.5" />
                              {user.onboarding.role}
                            </Badge>
                          )}
                          {user.onboarding.signalType && (
                            <Badge variant="secondary" className="gap-1 text-[10px] px-1.5 py-0">
                              <Globe className="size-2.5" />
                              {user.onboarding.signalType === "url" ? "Website" : user.onboarding.signalType === "idea" ? "From scratch" : user.onboarding.signalType}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-lg font-semibold text-primary">{user.credits.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">credits</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* User Detail Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => { if (!open) { setSelectedUser(null); setUserDetail(null) } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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

              <div className="space-y-4">
                {/* User Info */}
                <div className="grid gap-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">User ID</span><span className="font-mono text-xs">{selectedUser.id}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Credits</span><span className="font-mono font-semibold text-primary">{selectedUser.credits.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Auth provider</span><span>{selectedUser.authProvider}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Email verified</span><span>{selectedUser.emailVerified ? "Yes" : "No"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Joined</span><span>{formatDate(selectedUser.createdAt)}</span></div>
                  {selectedUser.onboarding?.completedAt && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Onboarding completed</span><span>{formatDate(selectedUser.onboarding.completedAt)}</span></div>
                  )}
                  {selectedUser.onboarding?.source && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Found via</span><span>{selectedUser.onboarding.source}</span></div>
                  )}
                  {selectedUser.onboarding?.role && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Role</span><span>{selectedUser.onboarding.role}</span></div>
                  )}
                  {selectedUser.onboarding?.signalType && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Building</span><span>{selectedUser.onboarding.signalType === "url" ? "Website mirroring" : selectedUser.onboarding.signalType === "idea" ? "From scratch" : selectedUser.onboarding.signalType}</span></div>
                  )}
                  {selectedUser.lastLoginAt && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Last login</span><span>{formatDate(selectedUser.lastLoginAt)}</span></div>
                  )}
                </div>

                {/* Recent Transactions */}
                {loadingDetail ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="size-4 animate-spin" /> Loading transactions...
                  </div>
                ) : userDetail?.transactions && userDetail.transactions.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium mb-2">Recent Transactions</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {userDetail.transactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-muted-foreground text-xs">{tx.reason}</p>
                          </div>
                          <span className={`font-mono text-xs shrink-0 ml-4 ${tx.amount >= 0 ? "text-green-500" : "text-destructive"}`}>
                            {tx.amount >= 0 ? "+" : ""}{tx.amount.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* User Actions */}
                {!selectedUser.isAdmin && (
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Shield className="size-4 text-primary" />
                      User Actions
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleToggleSuspend}
                        disabled={actionBusy}
                        className={selectedUser.suspended ? "text-green-500 hover:text-green-600" : "text-amber-500 hover:text-amber-600"}
                      >
                        <Clock className="size-3.5 mr-1" />
                        {selectedUser.suspended ? "Unsuspend" : "Suspend"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleToggleBan}
                        disabled={actionBusy}
                        className={selectedUser.banned ? "text-green-500 hover:text-green-600" : "text-destructive hover:text-destructive"}
                      >
                        <Ban className="size-3.5 mr-1" />
                        {selectedUser.banned ? "Unban" : "Ban"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRevokeSessions}
                        disabled={actionBusy}
                        className="text-orange-500 hover:text-orange-600"
                      >
                        <LogOut className="size-3.5 mr-1" />
                        Revoke Sessions
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActionDialog("delete")}
                        disabled={actionBusy}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3.5 mr-1" />
                        Delete User
                      </Button>
                    </div>
                  </div>
                )}

                {/* Credit Adjustment */}
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <CreditCard className="size-4 text-primary" />
                    Adjust Credits
                  </p>
                  <div className="mt-3 space-y-3">
                    <div className="flex gap-2">
                      <Button
                        variant={adjustAction === "grant" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAdjustAction("grant")}
                      >
                        Grant
                      </Button>
                      <Button
                        variant={adjustAction === "deduct" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAdjustAction("deduct")}
                        className={adjustAction === "deduct" ? "bg-destructive hover:bg-destructive/90" : ""}
                      >
                        Deduct
                      </Button>
                    </div>
                    <div>
                      <Label className="text-xs">Amount (credits)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={adjustAmount}
                        onChange={(e) => setAdjustAmount(e.target.value)}
                        className="mt-1"
                        placeholder="e.g. 1000"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Reason {adjustAction === "grant" ? "(required)" : "(optional)"}</Label>
                      <Textarea
                        value={adjustReason}
                        onChange={(e) => setAdjustReason(e.target.value)}
                        className="mt-1"
                        rows={2}
                        placeholder="e.g. Manual credit grant for promotion"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setSelectedUser(null); setUserDetail(null) }} disabled={adjustBusy}>
                  Close
                </Button>
                <Button
                  onClick={handleAdjustClick}
                  disabled={adjustBusy || !adjustAmount || parseInt(adjustAmount, 10) <= 0}
                  className={adjustAction === "deduct" ? "bg-destructive hover:bg-destructive/90" : ""}
                >
                  {adjustAction === "grant" ? "Grant" : "Deduct"} Credits
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(open) => { if (!open) { setActionDialog(null); setActionReason("") } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm {actionDialog === "delete" ? "Deletion" : actionDialog === "suspend" ? "Suspension" : "Ban"}</DialogTitle>
            <DialogDescription>
              {actionDialog === "delete" ? (
                <>You are about to permanently delete <strong>{selectedUser?.name}</strong>. This action cannot be undone.</>
              ) : actionDialog === "suspend" ? (
                <>You are about to suspend <strong>{selectedUser?.name}</strong>. They will be logged out and unable to sign in.</>
              ) : (
                <>You are about to ban <strong>{selectedUser?.name}</strong>. They will be logged out and permanently blocked.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Reason {actionDialog === "delete" ? "(optional)" : "(recommended)"}</Label>
              <Textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="mt-1"
                rows={2}
                placeholder="e.g. Violation of terms of service"
              />
            </div>
            {actionDialog === "delete" && (
              <p className="text-xs text-destructive">
                This will soft-delete the user. Their projects will remain but the account will be removed.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog(null); setActionReason("") }} disabled={actionBusy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleUserAction}
              disabled={actionBusy}
            >
              {actionBusy ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Confirm {actionDialog === "delete" ? "Delete" : actionDialog === "suspend" ? "Suspend" : "Ban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit Adjustment Confirmation */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm {adjustAction === "grant" ? "Grant" : "Deduction"}</DialogTitle>
            <DialogDescription>
              You are about to {adjustAction} <strong>{parseInt(adjustAmount || "0", 10).toLocaleString()}</strong> credits
              {selectedUser ? <> to <strong>{selectedUser.name}</strong></> : null}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Action</span>
                <span className={adjustAction === "grant" ? "text-green-500 font-medium" : "text-destructive font-medium"}>
                  {adjustAction === "grant" ? "+" : "-"}{parseInt(adjustAmount || "0", 10).toLocaleString()} credits
                </span>
              </div>
              {adjustReason && (
                <div className="mt-2 flex justify-between">
                  <span className="text-muted-foreground">Reason</span>
                  <span className="text-right max-w-[200px] truncate">{adjustReason}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              This action will be recorded in the transaction history.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={adjustBusy}>
              Cancel
            </Button>
            <Button
              onClick={handleAdjust}
              disabled={adjustBusy}
              className={adjustAction === "deduct" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {adjustBusy ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Confirm {adjustAction === "grant" ? "Grant" : "Deduction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
