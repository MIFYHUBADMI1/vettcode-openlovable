"use client"

import { useState } from "react"
import useSWR from "swr"
import { Check, Database, HardDrive, Zap, ArrowRight, Loader2, AlertCircle, ExternalLink } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { jsonFetcher, postJson, useSession } from "@/lib/client/api"

import { toast } from "sonner"

interface PlanInfo {
  id: string
  name: string
  storageLabel: string
  storageBytes: number
  mirrorSitePrice: number
  description: string
  isPaid: boolean
  isCurrent: boolean
}

interface Subscription {
  planId: string
  planName: string
  storageLimitBytes: number
  totalumInfrastructureCreditLimit: number
  status: string
  startedAt: number
  expiresAt: number
  totalumCreditsUsed?: number
  storageUsedBytes?: number
  overQuota?: boolean
  syncStatus?: string
}

interface InfrastructureInfo {
  subscription: Subscription | null
  plans: PlanInfo[]
  hasTotalumProject: boolean
}

function formatBytes(bytes: number): string {
  if (bytes === Infinity) return "Custom"
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  return `${bytes} B`
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const pct = limit === Infinity ? 0 : Math.min((used / limit) * 100, 100)
  const isHigh = pct > 80
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">
          {formatBytes(used)} / {formatBytes(limit)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isHigh ? "bg-amber-500" : "bg-primary"}`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
    </div>
  )
}

export function InfrastructureManager({ projectId }: { projectId: string }) {
  const { data, error, isLoading, mutate } = useSWR<InfrastructureInfo>(
    `/api/projects/${projectId}/infrastructure`,
    jsonFetcher,
  )
  const { refresh: refreshSession } = useSession()
  const [purchasing, setPurchasing] = useState<string | null>(null)

  async function handleSubscribe(planId: string) {
    setPurchasing(planId)
    try {
      await postJson(`/api/projects/${projectId}/infrastructure`, { planId })
      toast.success("Plan activated successfully! Credits deducted.")
      // Force revalidate infrastructure data AND the user session (credit balance)
      await Promise.all([mutate(), refreshSession()])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to activate plan")
    } finally {
      setPurchasing(null)
    }
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 rounded-lg bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <AlertCircle className="size-8 text-destructive mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Failed to load infrastructure information.</p>
      </div>
    )
  }

  if (!data) return null

  const { subscription, plans } = data

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      {subscription ? (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Current Plan</p>
                <h2 className="mt-1 text-2xl font-semibold">{subscription.planName}</h2>
              </div>
              <Badge variant={subscription.status === "active" ? "default" : "outline"}>
                {subscription.status}
              </Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              <div>
                <UsageBar
                  used={subscription.storageUsedBytes ?? 0}
                  limit={subscription.storageLimitBytes}
                  label="Storage"
                />
              </div>
              <div>
                <UsageBar
                  used={subscription.totalumCreditsUsed ?? 0}
                  limit={subscription.totalumInfrastructureCreditLimit}
                  label="Infrastructure Usage"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-6 text-sm text-muted-foreground">
              <span>Plan expires: <span className="text-foreground font-medium">{formatDate(subscription.expiresAt)}</span></span>
              {subscription.overQuota && (
                <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/30">
                  Over quota
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-center">
            <Database className="size-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No infrastructure plan configured yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Build your project to get started with a free Testing plan.</p>
          </CardContent>
        </Card>
      )}

      {/* Plan Selection */}
      {!data.hasTotalumProject ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <HardDrive className="size-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium">Build your project first</p>
          <p className="text-xs text-muted-foreground mt-1">
            Infrastructure plans are available after your project is built.
          </p>
        </div>
      ) : (
        <div>
          <h3 className="text-lg font-semibold mb-4">Infrastructure Plans</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.filter((p) => p.id !== "enterprise").map((plan) => {
              const isCurrent = plan.isCurrent
              const isPurchasing = purchasing === plan.id
              return (
                <Card
                  key={plan.id}
                  className={`relative ${isCurrent ? "border-primary" : ""}`}
                >
                  <CardContent className="py-5">
                    {isCurrent && (
                      <Badge className="absolute -top-2.5 left-4 text-[10px]">Current</Badge>
                    )}
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-lg font-semibold">{plan.name}</h4>
                      {plan.id === "starter" && !isCurrent && (
                        <Badge variant="secondary" className="text-[10px]">Recommended</Badge>
                      )}
                    </div>
                    <p className="text-2xl font-bold mb-1">
                      {plan.mirrorSitePrice === 0 ? "Free" : `${plan.mirrorSitePrice.toLocaleString()}`}
                      {plan.mirrorSitePrice > 0 && (
                        <span className="text-sm font-normal text-muted-foreground"> credits/mo</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">{plan.description}</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <HardDrive className="size-3.5 text-muted-foreground" />
                        <span>{plan.storageLabel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Zap className="size-3.5 text-muted-foreground" />
                        <span>Infrastructure included</span>
                      </div>
                    </div>
                    {!isCurrent && plan.id !== "enterprise" && (
                      <Button
                        className="w-full mt-4"
                        variant={plan.id === "starter" ? "default" : "outline"}
                        size="sm"
                        disabled={isPurchasing || purchasing !== null}
                        onClick={() => handleSubscribe(plan.id)}
                      >
                        {isPurchasing ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : isCurrent ? (
                          "Current Plan"
                        ) : plan.mirrorSitePrice === 0 ? (
                          "Activate"
                        ) : (
                          <>
                            Upgrade
                            <ArrowRight className="size-3.5 ml-1" />
                          </>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Policy Link */}
      <div className="text-center">
        <a
          href="/database-terms"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          Database Usage Terms & Policies
          <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  )
}
