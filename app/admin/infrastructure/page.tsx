"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import useSWR from "swr"
import {
  Loader2, AlertTriangle, Database, Search, Download, HardDrive, Zap,
  AlertCircle, CheckCircle2, ExternalLink, RefreshCw, Shield, DollarSign,
  TrendingUp, Clock, Ban, ArrowRight, FolderKanban, BarChart3,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { jsonFetcher, postJson } from "@/lib/client/api"
import { AdminNav } from "@/components/admin-nav"
import { toast } from "sonner"

interface ProjectInfra {
  projectId: string
  projectName: string
  userId: string
  userName: string
  userEmail: string
  totalumProjectId: string | null
  planId: string
  planName: string
  storageLimitBytes: number
  storageUsedBytes: number
  totalumCap: number
  totalumUsed: number
  status: string
  overQuota: boolean
  syncStatus: string
  startedAt: number | null
  expiresAt: number | null
  state: string
  developmentUrl?: string
  deploymentUrl?: string
}

interface InfraStats {
  totalManaged: number
  byPlan: { planId: string; planName: string; count: number }[]
  totalStorageUsed: number
  totalStorageCapacity: number
  totalInfraUsed: number
  totalInfraCap: number
  projectsNearStorageLimit: number
  projectsOverStorageLimit: number
  expiredSubscriptions: number
  syncFailures: number
  totalInfraRevenue: number
  estimatedInfraCost: number
  estimatedGrossProfit: number
}

interface AuditEntry {
  id: string
  adminUserEmail: string
  action: string
  projectId: string
  projectName: string
  previousValue: string
  newValue: string
  reason: string
  result: string
  createdAt: number
}

function formatBytes(bytes: number): string {
  if (bytes === Infinity || bytes === 0) return "—"
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  return `${bytes} B`
}

function formatDate(ts: number | null): string {
  if (!ts) return "—"
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function StorageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit === 0 || limit === Infinity ? 0 : Math.min((used / limit) * 100, 100)
  const color = pct > 95 ? "bg-red-500" : pct > 85 ? "bg-amber-500" : pct > 70 ? "bg-yellow-500" : "bg-primary"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[80px]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{formatBytes(used)} / {formatBytes(limit)}</span>
    </div>
  )
}

function InfraBar({ used, cap }: { used: number; cap: number }) {
  const pct = cap === 0 ? 0 : Math.min((used / cap) * 100, 100)
  const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-green-500"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[80px]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{used}/{cap}</span>
    </div>
  )
}

export default function AdminInfrastructurePage() {
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState("projects")
  const [syncing, setSyncing] = useState<string | null>(null)
  const [changingPlan, setChangingPlan] = useState<string | null>(null)
  const [auditOffset, setAuditOffset] = useState(0)

  const { data: projectsData, error: projectsError, isLoading: projectsLoading, mutate: refreshProjects } = useSWR<{ projects: ProjectInfra[]; total: number }>(
    "/api/admin/infrastructure",
    jsonFetcher,
    { refreshInterval: 30000 },
  )

  const { data: auditData, mutate: refreshAudit } = useSWR<{ logs: AuditEntry[]; total: number }>(
    `/api/admin/audit-logs?limit=50&offset=${auditOffset}`,
    jsonFetcher,
  )

  const projects = projectsData?.projects ?? []
  const filtered = projects.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.projectName.toLowerCase().includes(q) ||
      p.userName.toLowerCase().includes(q) ||
      p.userEmail.toLowerCase().includes(q) ||
      p.projectId.toLowerCase().includes(q) ||
      (p.totalumProjectId ?? "").toLowerCase().includes(q)
    )
  })

  // Aggregate stats from projects
  const totalStorage = projects.reduce((s, p) => s + p.storageUsedBytes, 0)
  const totalCap = projects.reduce((s, p) => s + p.totalumCap, 0)
  const totalUsed = projects.reduce((s, p) => s + p.totalumUsed, 0)
  const overQuota = projects.filter((p) => p.overQuota).length
  const syncFailed = projects.filter((p) => p.syncStatus === "failed").length
  const expired = projects.filter((p) => p.expiresAt && p.expiresAt < Date.now() && p.planId !== "testing").length
  const nearStorage = projects.filter((p) => {
    if (p.storageLimitBytes === 0 || p.storageLimitBytes === Infinity) return false
    return (p.storageUsedBytes / p.storageLimitBytes) > 0.85
  }).length
  const nearInfra = projects.filter((p) => {
    if (p.totalumCap === 0) return false
    return (p.totalumUsed / p.totalumCap) > 0.85
  }).length

  // Plan distribution
  const planCounts = projects.reduce((acc, p) => {
    acc[p.planId] = (acc[p.planId] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const handleSync = useCallback(async (projectId: string) => {
    setSyncing(projectId)
    try {
      await postJson(`/api/admin/infrastructure/${projectId}/sync`)
      toast.success("Infrastructure synchronized")
      await refreshProjects()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed")
    } finally {
      setSyncing(null)
    }
  }, [refreshProjects])

  const handlePlanChange = useCallback(async (projectId: string, planId: string) => {
    setChangingPlan(projectId)
    try {
      await postJson(`/api/admin/infrastructure/${projectId}/plan`, { planId })
      toast.success("Plan changed successfully")
      await refreshProjects()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Plan change failed")
    } finally {
      setChangingPlan(null)
    }
  }, [refreshProjects])

  if (projectsLoading) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    )
  }

  if (projectsError) {
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
                Infrastructure
              </Badge>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Infrastructure Control</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Monitor, manage, and control all MirrorSite-managed application infrastructure.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refreshProjects()} className="gap-1.5">
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </header>

        {/* ── Overview Stats ── */}
        <section className="mt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Overview</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="py-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Managed Applications</p>
                    <p className="mt-2 text-3xl font-semibold tabular-nums">{projects.length}</p>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-2"><FolderKanban className="size-4 text-primary" /></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Storage Used</p>
                    <p className="mt-2 text-3xl font-semibold tabular-nums text-primary">{formatBytes(totalStorage)}</p>
                  </div>
                  <div className="rounded-lg bg-primary/10 p-2"><HardDrive className="size-4 text-primary" /></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Infrastructure Usage</p>
                    <p className="mt-2 text-3xl font-semibold tabular-nums text-green-500">{totalUsed.toLocaleString()} / {totalCap.toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg bg-green-500/10 p-2"><Zap className="size-4 text-green-500" /></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Estimated Gross Profit</p>
                    <p className="mt-2 text-3xl font-semibold tabular-nums text-green-500">
                      {(projectsData && (projectsData as unknown as { infra?: InfraStats }).infra?.estimatedGrossProfit)
                        ? `${((projectsData as unknown as { infra?: InfraStats }).infra!.estimatedGrossProfit).toLocaleString()}`
                        : "—"
                      }
                    </p>
                  </div>
                  <div className="rounded-lg bg-green-500/10 p-2"><TrendingUp className="size-4 text-green-500" /></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ── Alerts ── */}
        {(overQuota > 0 || syncFailed > 0 || expired > 0 || nearStorage > 0 || nearInfra > 0) && (
          <section className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="size-4 text-amber-500" />
              <p className="font-mono text-xs uppercase tracking-widest text-amber-500">Alerts</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {overQuota > 0 && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                  <p className="text-sm font-medium text-red-500">{overQuota} projects over storage quota</p>
                </div>
              )}
              {nearStorage > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="text-sm font-medium text-amber-500">{nearStorage} projects near storage limit</p>
                </div>
              )}
              {nearInfra > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="text-sm font-medium text-amber-500">{nearInfra} projects near infra limit</p>
                </div>
              )}
              {syncFailed > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-sm font-medium text-destructive">{syncFailed} sync failures</p>
                </div>
              )}
              {expired > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="text-sm font-medium text-amber-500">{expired} expired subscriptions</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Plan Distribution ── */}
        {projects.length > 0 && (
          <section className="mt-6">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">Plan Distribution</p>
            <div className="flex gap-3 flex-wrap">
              {["testing", "basic", "starter", "pro", "business", "enterprise"].map((plan) => (
                <div key={plan} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                  <span className="text-sm font-medium capitalize">{plan}</span>
                  <Badge variant="secondary" className="font-mono text-xs">{planCounts[plan] ?? 0}</Badge>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Search ── */}
        <div className="mt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by project, user, ID, or Totalum ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* ── Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="alerts">Alerts & Issues</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          </TabsList>

          {/* ── Projects Tab ── */}
          <TabsContent value="projects" className="mt-4">
            {filtered.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Database className="size-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-lg font-medium">No projects found</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {search ? "Try a different search term." : "No infrastructure subscriptions yet."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filtered.map((p) => {
                  const isSyncFailed = p.syncStatus === "failed"
                  const isOverQuota = p.overQuota
                  const isExpired = p.expiresAt && p.expiresAt < Date.now() && p.planId !== "testing"
                  return (
                    <div
                      key={p.projectId}
                      className={`rounded-lg border bg-card p-4 ${
                        isSyncFailed ? "border-destructive/50" : isOverQuota ? "border-amber-500/50" : "border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link href={`/project/${p.projectId}`} className="font-medium hover:text-primary hover:underline">
                              {p.projectName}
                            </Link>
                            <Badge variant="outline" className="text-xs capitalize">{p.planName}</Badge>
                            {isSyncFailed && <Badge variant="outline" className="text-xs text-destructive"><AlertCircle className="size-3 mr-1" />Sync failed</Badge>}
                            {isOverQuota && <Badge variant="outline" className="text-xs text-amber-500">Over quota</Badge>}
                            {isExpired && <Badge variant="outline" className="text-xs text-amber-500"><Clock className="size-3 mr-1" />Expired</Badge>}
                            {p.syncStatus === "synced" && <Badge variant="outline" className="text-xs text-green-500"><CheckCircle2 className="size-3 mr-1" />Synced</Badge>}
                          </div>
                          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            <span>{p.userName} ({p.userEmail})</span>
                            <span className="font-mono">{p.projectId}</span>
                            {p.totalumProjectId && <span className="font-mono text-[10px]">TU: {p.totalumProjectId}</span>}
                          </div>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <StorageBar used={p.storageUsedBytes} limit={p.storageLimitBytes} />
                            <InfraBar used={p.totalumUsed} cap={p.totalumCap} />
                          </div>
                          {/* Links */}
                          <div className="mt-2 flex items-center gap-3 text-xs">
                            <Link href={`/project/${p.projectId}`} className="text-primary hover:underline inline-flex items-center gap-1">
                              <FolderKanban className="size-3" /> Project
                            </Link>
                            <Link href={`/project/${p.projectId}/database`} className="text-primary hover:underline inline-flex items-center gap-1">
                              <Database className="size-3" /> Database
                            </Link>
                            {p.developmentUrl && (
                              <a href={p.developmentUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                                <ExternalLink className="size-3" /> App
                              </a>
                            )}
                            {p.deploymentUrl && (
                              <a href={p.deploymentUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                                <ExternalLink className="size-3" /> Deploy
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="shrink-0 flex flex-col gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-xs h-7"
                            disabled={syncing === p.projectId || !p.totalumProjectId}
                            onClick={() => handleSync(p.projectId)}
                          >
                            {syncing === p.projectId ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                            Sync
                          </Button>
                          <select
                            value={p.planId}
                            onChange={(e) => handlePlanChange(p.projectId, e.target.value)}
                            disabled={changingPlan === p.projectId}
                            className="h-7 rounded-md border border-border bg-card px-2 text-xs text-foreground"
                          >
                            {["testing", "basic", "starter", "pro", "business"].map((plan) => (
                              <option key={plan} value={plan}>{plan.charAt(0).toUpperCase() + plan.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {p.expiresAt && (
                        <p className="mt-2 text-[10px] text-muted-foreground">
                          Expires: {formatDate(p.expiresAt)}
                          {isExpired && " (EXPIRED)"}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* ── Alerts Tab ── */}
          <TabsContent value="alerts" className="mt-4">
            <div className="space-y-3">
              {/* Over quota */}
              {filtered.filter((p) => p.overQuota).map((p) => (
                <div key={p.projectId} className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
                  <div className="flex items-center gap-2">
                    <Ban className="size-4 text-red-500" />
                    <span className="text-sm font-medium text-red-500">Storage exceeded</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {p.projectName} ({p.userName}) — {formatBytes(p.storageUsedBytes)} / {formatBytes(p.storageLimitBytes)}
                  </p>
                </div>
              ))}

              {/* Near limits */}
              {filtered.filter((p) => !p.overQuota && p.storageLimitBytes > 0 && p.storageLimitBytes !== Infinity && (p.storageUsedBytes / p.storageLimitBytes) > 0.85).map((p) => (
                <div key={`near-${p.projectId}`} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="size-4 text-amber-500" />
                    <span className="text-sm font-medium text-amber-500">Approaching storage limit</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {p.projectName} ({p.userName}) — {formatBytes(p.storageUsedBytes)} / {formatBytes(p.storageLimitBytes)}
                  </p>
                </div>
              ))}

              {/* Sync failures */}
              {filtered.filter((p) => p.syncStatus === "failed").map((p) => (
                <div key={`sync-${p.projectId}`} className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="size-4 text-destructive" />
                        <span className="text-sm font-medium text-destructive">Totalum sync failed</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {p.projectName} — Plan: {p.planName}, Cap: {p.totalumCap}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs"
                      disabled={syncing === p.projectId}
                      onClick={() => handleSync(p.projectId)}
                    >
                      <RefreshCw className="size-3" /> Retry
                    </Button>
                  </div>
                </div>
              ))}

              {/* Expired */}
              {filtered.filter((p) => p.expiresAt && p.expiresAt < Date.now() && p.planId !== "testing").map((p) => (
                <div key={`exp-${p.projectId}`} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-amber-500" />
                    <span className="text-sm font-medium text-amber-500">Expired subscription</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {p.projectName} ({p.userName}) — Was: {p.planName}, expired {formatDate(p.expiresAt)}
                  </p>
                </div>
              ))}

              {filtered.filter((p) => p.overQuota || p.syncStatus === "failed" || (p.expiresAt && p.expiresAt < Date.now() && p.planId !== "testing")).length === 0 && (
                <div className="rounded-lg border border-border bg-card p-8 text-center">
                  <CheckCircle2 className="size-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-medium">No alerts</p>
                  <p className="text-xs text-muted-foreground mt-1">All infrastructure systems are operating normally.</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Audit Log Tab ── */}
          <TabsContent value="audit" className="mt-4">
            {auditData?.logs && auditData.logs.length > 0 ? (
              <div className="space-y-2">
                {auditData.logs.map((log) => (
                  <div key={log.id} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] ${
                          log.result === "success" ? "text-green-500" : log.result === "failure" ? "text-red-500" : "text-amber-500"
                        }`}>
                          {log.result}
                        </Badge>
                        <span className="text-sm font-medium">{log.action}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</span>
                    </div>
                    {log.projectName && <p className="mt-1 text-xs text-muted-foreground">Project: {log.projectName}</p>}
                    {log.previousValue && log.newValue && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{log.previousValue} → {log.newValue}</p>
                    )}
                    {log.reason && <p className="mt-0.5 text-xs text-muted-foreground">Reason: {log.reason}</p>}
                  </div>
                ))}
                {auditData.total > 50 && (
                  <div className="flex justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={auditOffset === 0}
                      onClick={() => setAuditOffset(Math.max(0, auditOffset - 50))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={auditOffset + 50 >= auditData.total}
                      onClick={() => setAuditOffset(auditOffset + 50)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-card p-8 text-center">
                <BarChart3 className="size-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium">No audit entries yet</p>
                <p className="text-xs text-muted-foreground mt-1">Infrastructure actions will appear here.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ── Export ── */}
        <div className="mt-6 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              const headers = ["Project", "Owner", "Email", "Plan", "Storage Used", "Storage Limit", "Infra Used", "Infra Cap", "Status", "Sync", "Over Quota", "Totalum ID", "Expires"]
              const rows = filtered.map((p) => [
                p.projectName, p.userName, p.userEmail, p.planName,
                formatBytes(p.storageUsedBytes), formatBytes(p.storageLimitBytes),
                String(p.totalumUsed), String(p.totalumCap),
                p.status, p.syncStatus, p.overQuota ? "Yes" : "No",
                p.totalumProjectId ?? "", p.expiresAt ? new Date(p.expiresAt).toISOString().slice(0, 10) : "",
              ])
              const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
              const url = URL.createObjectURL(blob)
              const a = document.createElement("a")
              a.href = url
              a.download = `infrastructure-export-${new Date().toISOString().slice(0, 10)}.csv`
              a.click()
              URL.revokeObjectURL(url)
              toast.success(`Exported ${filtered.length} projects`)
            }}
          >
            <Download className="size-3.5" />
            Export CSV
          </Button>
        </div>
      </div>
    </main>
  )
}
