"use client"

import { useState } from "react"
import useSWR from "swr"
import { Loader2, AlertTriangle, Shield, Users, Search, Download, Gift, Rocket, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { jsonFetcher } from "@/lib/client/api"
import { AdminNav } from "@/components/admin-nav"
import { toast } from "sonner"

interface AdminReferral {
  id: string
  referrerUserId: string
  referrerName: string
  referredUserId: string
  referredName: string
  referredEmailVerified: boolean
  referralCode: string
  status: string
  verificationRewardIssued: boolean
  milestoneRewardIssued: boolean
  eligibleUsage: number
  fraudFlags?: string[]
  createdAt: number
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  registered: { label: "Joined", color: "text-muted-foreground", icon: Users },
  verified: { label: "Verified", color: "text-green-500", icon: CheckCircle2 },
  active: { label: "Building", color: "text-blue-500", icon: Rocket },
  milestone_reached: { label: "Milestone Reached", color: "text-primary", icon: Rocket },
  blocked: { label: "Blocked", color: "text-destructive", icon: AlertCircle },
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function AdminReferralsPage() {
  const { data, error, isLoading } = useSWR<{ referrals: AdminReferral[]; total: number }>(
    "/api/admin/referrals",
    jsonFetcher,
    { refreshInterval: 30000 },
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
        <AdminNav />
        <div className="mx-auto max-w-6xl px-6 py-10 text-center">
          <AlertTriangle className="size-10 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-semibold">Access Denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">You don&apos;t have permission to access this page.</p>
        </div>
      </main>
    )
  }

  const referrals = data?.referrals ?? []
  const filtered = referrals.filter((r) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.referrerName.toLowerCase().includes(q) ||
      r.referredName.toLowerCase().includes(q) ||
      r.referralCode.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q)
    )
  })

  const totalCreditsAwarded = referrals.reduce((sum, r) => {
    let credits = 0
    if (r.verificationRewardIssued) credits += 500
    if (r.milestoneRewardIssued) credits += 1500
    return sum + credits
  }, 0)

  const flagged = referrals.filter((r) => r.fraudFlags && r.fraudFlags.length > 0)

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
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Referral Management</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              View and manage referral relationships, rewards, and fraud flags.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const headers = ["ID", "Referrer", "Referred", "Code", "Status", "Verification Reward", "Milestone Reward", "Eligible Usage", "Fraud Flags", "Created"]
              const rows = filtered.map((r) => [
                r.id,
                r.referrerName,
                r.referredName,
                r.referralCode,
                r.status,
                r.verificationRewardIssued ? "Yes" : "No",
                r.milestoneRewardIssued ? "Yes" : "No",
                String(r.eligibleUsage),
                r.fraudFlags?.join(", ") ?? "",
                new Date(r.createdAt).toISOString().slice(0, 10),
              ])
              const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
              const url = URL.createObjectURL(blob)
              const a = document.createElement("a")
              a.href = url
              a.download = `referrals-export-${new Date().toISOString().slice(0, 10)}.csv`
              a.click()
              URL.revokeObjectURL(url)
              toast.success(`Exported ${filtered.length} referrals to CSV`)
            }}
            className="gap-1.5"
          >
            <Download className="size-3.5" />
            Export CSV
          </Button>
        </header>

        {/* Summary Cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Total Referrals</p>
              <p className="mt-2 text-2xl font-semibold">{data?.total ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Total Credits Awarded</p>
              <p className="mt-2 text-2xl font-semibold text-green-500">+{totalCreditsAwarded.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <p className="text-xs text-muted-foreground">Verification Rewards</p>
              <p className="mt-2 text-2xl font-semibold">{referrals.filter((r) => r.verificationRewardIssued).length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Fraud Flags</p>
                {flagged.length > 0 && (
                  <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/30">
                    {flagged.length} flagged
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-2xl font-semibold">{flagged.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, code, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Referral List */}
        <div className="mt-6">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="size-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-lg font-medium">No referrals found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search ? "Try a different search term." : "No referrals have been created yet."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((r) => {
                const status = STATUS_LABELS[r.status] ?? { label: r.status, color: "text-muted-foreground", icon: Users }
                const StatusIcon = status.icon
                const totalReward = (r.verificationRewardIssued ? 500 : 0) + (r.milestoneRewardIssued ? 1500 : 0)
                const hasFlags = r.fraudFlags && r.fraudFlags.length > 0

                return (
                  <div
                    key={r.id}
                    className={`rounded-lg border bg-card p-4 ${hasFlags ? "border-amber-500/50" : "border-border"}`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{r.referrerName}</span>
                          <span className="text-muted-foreground text-xs">referred</span>
                          <span className="font-medium">{r.referredName}</span>
                          <Badge variant="outline" className={`gap-1 text-xs ${status.color}`}>
                            <StatusIcon className="size-3" />
                            {status.label}
                          </Badge>
                          {hasFlags && (
                            <Badge variant="outline" className="gap-1 text-xs text-amber-500 border-amber-500/30">
                              <AlertCircle className="size-3" />
                              {r.fraudFlags!.join(", ")}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="font-mono text-xs">Code: {r.referralCode}</span>
                          <span className="font-mono text-xs">Usage: {r.eligibleUsage.toLocaleString()}</span>
                          <span className="text-xs">{formatDate(r.createdAt)}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {totalReward > 0 ? (
                          <p className="font-mono text-lg font-semibold text-green-500">+{totalReward.toLocaleString()}</p>
                        ) : (
                          <p className="font-mono text-lg font-semibold text-muted-foreground">Pending</p>
                        )}
                        <div className="flex items-center gap-2 justify-end mt-1">
                          {r.verificationRewardIssued && (
                            <Badge variant="secondary" className="gap-1 text-[10px]">
                              <Gift className="size-2.5" />
                              +500
                            </Badge>
                          )}
                          {r.milestoneRewardIssued && (
                            <Badge variant="secondary" className="gap-1 text-[10px]">
                              <Rocket className="size-2.5" />
                              +1,500
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
