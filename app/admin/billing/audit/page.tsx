"use client"

import { useState, useCallback } from "react"
import useSWR from "swr"
import {
  Loader2, AlertTriangle, Shield, RefreshCw, Search, Download, Filter,
  ArrowDownLeft, ArrowUpRight, Clock, CreditCard, X,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { jsonFetcher } from "@/lib/client/api"
import { toast } from "sonner"
import { AdminNav } from "@/components/admin-nav"

interface AuditEntry {
  id: string
  userId: string
  userName?: string
  userEmail?: string
  type: string
  amount: number
  reason: string
  buildRunId?: string
  createdAt: number
  topUp?: {
    id: string
    packageId: string
    credits: number
    expectedAmount: number
    paymentNetwork: string
    status: string
  }
}

const TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "grant", label: "Grants" },
  { value: "charge", label: "Charges" },
  { value: "consume", label: "Consumption" },
  { value: "reserve", label: "Reservations" },
  { value: "refund", label: "Refunds" },
  { value: "deduction", label: "Deductions" },
]

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatFullDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
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

function typeColor(type: string) {
  switch (type) {
    case "grant": return "bg-green-500/10 text-green-500 border-green-500/30"
    case "charge": return "bg-blue-500/10 text-blue-500 border-blue-500/30"
    case "consume": return "bg-red-500/10 text-red-500 border-red-500/30"
    case "reserve": return "bg-amber-500/10 text-amber-500 border-amber-500/30"
    case "refund": return "bg-purple-500/10 text-purple-500 border-purple-500/30"
    case "deduction": return "bg-orange-500/10 text-orange-500 border-orange-500/30"
    default: return "bg-muted text-muted-foreground"
  }
}

export default function AdminAuditPage() {
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("")
  const [page, setPage] = useState(0)
  const limit = 50

  const { data, error, isLoading, mutate } = useSWR<{ transactions: AuditEntry[]; total: number; hasMore: boolean }>(
    `/api/admin/billing/audit-log?limit=${limit}&offset=${page * limit}${filterType ? `&type=${filterType}` : ""}`,
    jsonFetcher,
    { refreshInterval: 15000 },
  )

  const handleExport = useCallback(() => {
    if (!data?.transactions) return
    const headers = ["ID", "User", "Email", "Type", "Amount", "Reason", "Build Run ID", "Top-Up ID", "Top-Up Package", "Top-Up Status", "Date"]
    const rows = data.transactions.map((tx) => [
      tx.id,
      tx.userName ?? "Unknown",
      tx.userEmail ?? "",
      tx.type,
      tx.amount,
      tx.reason,
      tx.buildRunId ?? "",
      tx.topUp?.id ?? "",
      tx.topUp?.packageId ?? "",
      tx.topUp?.status ?? "",
      new Date(tx.createdAt).toISOString(),
    ])
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `billing-audit-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${data.transactions.length} audit entries`)
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

  const transactions = data?.transactions ?? []
  const filtered = search
    ? transactions.filter((tx) =>
        tx.userName?.toLowerCase().includes(search.toLowerCase()) ||
        tx.userEmail?.toLowerCase().includes(search.toLowerCase()) ||
        tx.reason.toLowerCase().includes(search.toLowerCase()) ||
        tx.type.toLowerCase().includes(search.toLowerCase()) ||
        tx.id.toLowerCase().includes(search.toLowerCase())
      )
    : transactions

  const totalGranted = transactions.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
  const totalCharged = transactions.filter((t) => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0)

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
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Billing Audit Log</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete audit trail of all credit transactions and billing events.
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
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Total Transactions</p>
              <p className="mt-2 text-2xl font-semibold">{data?.total ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Total Granted</p>
              <p className="mt-2 text-2xl font-semibold text-green-500">+{totalGranted.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Total Charged</p>
              <p className="mt-2 text-2xl font-semibold text-red-500">-{totalCharged.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Filters ── */}
        <div className="mt-6 space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by user, reason, or type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="size-3.5 text-muted-foreground" />
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setFilterType(opt.value); setPage(0) }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  filterType === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {opt.label}
              </button>
            ))}
            {filterType && (
              <button
                onClick={() => { setFilterType(""); setPage(0) }}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Transaction List ── */}
        <div className="mt-6">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CreditCard className="size-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-lg font-medium">No transactions found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search || filterType ? "Try adjusting your filters." : "No transactions have been recorded yet."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((tx) => (
                <div
                  key={tx.id}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${typeColor(tx.type)}`}>
                          {tx.type}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">{tx.id.slice(0, 16)}...</span>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-sm flex-wrap">
                        <span className="font-medium">{tx.userName ?? "Unknown"}</span>
                        <span className="text-muted-foreground text-xs">{tx.userEmail}</span>
                        <span className="text-muted-foreground text-xs">{tx.reason}</span>
                      </div>
                      {tx.topUp && (
                        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Top-Up: {tx.topUp.packageId}</span>
                          <span>{tx.topUp.paymentNetwork.toUpperCase()}</span>
                          <Badge variant="outline" className={`text-[10px] ${
                            tx.topUp.status === "approved" ? "text-green-500 border-green-500/30" :
                            tx.topUp.status === "rejected" ? "text-red-500 border-red-500/30" :
                            "text-muted-foreground"
                          }`}>{tx.topUp.status}</Badge>
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-mono text-lg font-semibold ${tx.amount >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {tx.amount >= 0 ? "+" : ""}{tx.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">{timeAgo(tx.createdAt)}</p>
                    </div>
                  </div>
                </div>
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={!data.hasMore}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
