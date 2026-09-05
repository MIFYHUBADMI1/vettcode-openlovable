"use client"

import Link from "next/link"
import useSWR from "swr"
import {
  Loader2, AlertTriangle, Shield, Package, CreditCard, DollarSign,
  Coins, RefreshCw, CheckCircle2, X,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { jsonFetcher } from "@/lib/client/api"
import { AdminNav } from "@/components/admin-nav"

interface PlanConfig {
  id: string
  name: string
  tagline: string
  priceUSD: number
  mirrorCredits: number
  interval: string
  active: boolean
  custom?: boolean
  popular?: boolean
  features: string[]
  notIncluded: string[]
}

interface CreditPack {
  id: string
  credits: number
  priceUSD: number
  label: string
}

interface BillingConfig {
  subscriptionPlans: PlanConfig[]
  permanentCreditPacks: CreditPack[]
  conversionRate: {
    mirrorsiteCreditsPerBaselineUnit: number
    description: string
  }
  systemConfig: {
    currency: string
    creditUnit: string
    welcomeBonusCredits: number
    referralVerificationReward: number
    referralMilestoneReward: number
    referralMilestoneThreshold: number
  }
  dodoConfig: {
    apiKeyConfigured: boolean
    webhookKeyConfigured: boolean
    environment: string
  }
}

export default function AdminPlansPage() {
  const { data: config, error, isLoading, mutate } = useSWR<BillingConfig>(
    "/api/admin/billing/configuration",
    jsonFetcher,
    { refreshInterval: 60000 },
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
        <AdminNav />
        <div className="mx-auto max-w-6xl px-6 py-10 text-center">
          <AlertTriangle className="size-10 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-semibold">Access Denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">You don&apos;t have permission to access this page.</p>
        </div>
      </main>
    )
  }

  const plans = config?.subscriptionPlans ?? []
  const packs = config?.permanentCreditPacks ?? []

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
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Subscription Plans</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              View and configure subscription plans, pricing, and credit allocations.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => mutate()} className="gap-1.5">
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </header>

        {/* ── Dodo Integration Status ── */}
        <section className="mt-8">
          <Card>
            <CardContent className="py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${config?.dodoConfig.apiKeyConfigured ? "bg-green-500/10" : "bg-amber-500/10"}`}>
                    <CreditCard className={`size-4 ${config?.dodoConfig.apiKeyConfigured ? "text-green-500" : "text-amber-500"}`} />
                  </div>
                  <div>
                    <p className="font-medium">Dodo Payments Integration</p>
                    <p className="text-xs text-muted-foreground">
                      {config?.dodoConfig.apiKeyConfigured ? "API key configured" : "API key not configured"} ·
                      {config?.dodoConfig.webhookKeyConfigured ? " Webhook configured" : " Webhook not configured"} ·
                      Environment: {config?.dodoConfig.environment}
                    </p>
                  </div>
                </div>
                <Badge variant={config?.dodoConfig.apiKeyConfigured ? "default" : "outline"}>
                  {config?.dodoConfig.apiKeyConfigured ? "Connected" : "Not Configured"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Subscription Plans ── */}
        <section className="mt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Subscription Plans</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.id} className={plan.popular ? "border-primary/50" : plan.custom ? "border-primary/30" : ""}>
                <CardContent className="py-5">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-lg font-semibold">{plan.name}</p>
                        {plan.popular && (
                          <Badge className="text-[10px]">Most Popular</Badge>
                        )}
                        {plan.custom && (
                          <Badge variant="secondary" className="text-[10px]">Enterprise</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{plan.tagline}</p>
                    </div>
                    <Badge variant={plan.active ? "default" : "outline"} className="shrink-0">
                      {plan.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  {/* Price + stats */}
                  <div className="mt-4 pb-4 border-b border-border">
                    <p className="text-2xl font-bold text-primary">
                      ${plan.priceUSD}
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </p>
                    <div className="mt-2 space-y-1.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Coins className="size-3" />
                          Credits / month
                        </span>
                        <span className="font-mono font-semibold">{plan.mirrorCredits.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Package className="size-3" />
                          Interval
                        </span>
                        <span className="capitalize">{plan.interval}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <DollarSign className="size-3" />
                          Per 1K credits
                        </span>
                        <span className="font-mono">
                          ${plan.priceUSD > 0 ? (plan.priceUSD / plan.mirrorCredits * 1000).toFixed(4) : "0"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Included features */}
                  <div className="mt-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Included:</p>
                    <ul className="space-y-1.5">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-1.5 text-xs">
                          <CheckCircle2 className="size-3 text-green-500 mt-0.5 shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Not included */}
                  {plan.notIncluded.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Not included:</p>
                      <ul className="space-y-1.5">
                        {plan.notIncluded.map((f) => (
                          <li key={f} className="flex items-start gap-1.5 text-xs">
                            <X className="size-3 text-muted-foreground/40 mt-0.5 shrink-0" />
                            <span className="text-muted-foreground/60 line-through decoration-muted-foreground/30">{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ── Permanent Credit Packs ── */}
        <section className="mt-10">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Permanent Credit Packs</p>
          <Card>
            <CardContent className="py-5">
              <p className="text-sm text-muted-foreground mb-4">
                Permanent credits never expire and remain available after subscription cancellation.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-xs font-mono uppercase text-muted-foreground">Pack</th>
                      <th className="text-right py-2 text-xs font-mono uppercase text-muted-foreground">Credits</th>
                      <th className="text-right py-2 text-xs font-mono uppercase text-muted-foreground">Price (USD)</th>
                      <th className="text-right py-2 text-xs font-mono uppercase text-muted-foreground">Price per Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packs.map((pack) => (
                      <tr key={pack.id} className="border-b border-border last:border-0">
                        <td className="py-3 font-medium">{pack.label}</td>
                        <td className="py-3 text-right font-mono">{pack.credits.toLocaleString()}</td>
                        <td className="py-3 text-right font-mono">${pack.priceUSD}</td>
                        <td className="py-3 text-right font-mono text-muted-foreground">
                          ${(pack.priceUSD / pack.credits).toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Conversion Rate ── */}
        <section className="mt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Internal Configuration</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="py-5">
                <p className="text-xs text-muted-foreground">Provider Conversion Rate</p>
                <p className="mt-2 text-2xl font-semibold">1 : {config?.conversionRate.mirrorsiteCreditsPerBaselineUnit.toLocaleString()}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {config?.conversionRate.description}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-5">
                <p className="text-xs text-muted-foreground">Referral Rewards</p>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Signup Reward</span>
                    <span className="font-mono font-semibold text-green-500">+{config?.systemConfig.welcomeBonusCredits.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Referral Verification</span>
                    <span className="font-mono font-semibold text-green-500">+{config?.systemConfig.referralVerificationReward.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Referral Milestone</span>
                    <span className="font-mono font-semibold text-green-500">+{config?.systemConfig.referralMilestoneReward.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Milestone Threshold</span>
                    <span className="font-mono">{config?.systemConfig.referralMilestoneThreshold.toLocaleString()} credits</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  )
}
