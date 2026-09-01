"use client"

import { useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Loader2, Search, AlertTriangle, DollarSign } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { jsonFetcher } from "@/lib/client/api"
import { AdminNav } from "@/components/admin-nav"

interface TransactionItem {
  id: string
  userId: string
  userName?: string
  userEmail?: string
  type: string
  amount: number
  reason: string
  createdAt: number
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function typeColor(type: string) {
  switch (type) {
    case "grant": return "bg-green-500/10 text-green-500 border-green-500/30"
    case "charge": return "bg-blue-500/10 text-blue-500 border-blue-500/30"
    case "deduction": return "bg-red-500/10 text-red-500 border-red-500/30"
    case "refund": return "bg-amber-500/10 text-amber-500 border-amber-500/30"
    default: return "bg-muted text-muted-foreground"
  }
}

export default function AdminTransactionsPage() {
  const { data, error, isLoading } = useSWR<{ transactions: TransactionItem[] }>(
    "/api/admin/transactions",
    jsonFetcher,
    { refreshInterval: 15000 },
  )

  const [search, setSearch] = useState("")

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

  const transactions = data?.transactions ?? []
  const filtered = search
    ? transactions.filter(
        (tx) =>
          tx.userName?.toLowerCase().includes(search.toLowerCase()) ||
          tx.userEmail?.toLowerCase().includes(search.toLowerCase()) ||
          tx.reason.toLowerCase().includes(search.toLowerCase()) ||
          tx.type.toLowerCase().includes(search.toLowerCase()),
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
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Admin</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Credit Transactions</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              View all credit activity across all users.
            </p>
          </div>
        </header>

        {/* Summary */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Total Transactions</p>
              <p className="mt-2 text-2xl font-semibold">{transactions.length}</p>
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
              <p className="mt-2 text-2xl font-semibold text-destructive">-{totalCharged.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by user, type, or reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Transactions Table */}
        <div className="mt-6">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <DollarSign className="size-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-lg font-medium">No transactions found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search ? "Try a different search term." : "No credit transactions yet."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              {/* Header */}
              <div className="hidden sm:grid grid-cols-[1fr_1.2fr_1fr_auto_auto] gap-4 bg-muted/60 px-4 py-3 text-xs font-mono uppercase tracking-wider text-muted-foreground border-b border-border">
                <span>User</span>
                <span>Reason</span>
                <span>Date</span>
                <span>Type</span>
                <span className="text-right">Amount</span>
              </div>
              {/* Rows */}
              <div className="divide-y divide-border">
                {filtered.map((tx) => (
                  <div
                    key={tx.id}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_1.2fr_1fr_auto_auto] gap-2 sm:gap-4 px-4 py-3 text-sm hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{tx.userName ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground truncate">{tx.userEmail}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-muted-foreground text-xs">{tx.reason}</p>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(tx.createdAt)}
                    </div>
                    <div>
                      <Badge variant="outline" className={`text-xs ${typeColor(tx.type)}`}>
                        {tx.type}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <span className={`font-mono text-sm font-semibold ${tx.amount >= 0 ? "text-green-500" : "text-destructive"}`}>
                        {tx.amount >= 0 ? "+" : ""}{tx.amount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
