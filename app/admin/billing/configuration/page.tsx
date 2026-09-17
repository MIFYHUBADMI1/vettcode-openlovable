"use client"

import useSWR from "swr"
import { useEffect, useState } from "react"
import {
  Loader2, AlertTriangle, Shield, Settings, Coins, DollarSign, Package,
  RefreshCw, CreditCard, Webhook, Key, ArrowRight, CheckCircle2, XCircle,
  TrendingUp, Star, Zap, MessageSquare, Brain,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { jsonFetcher, patchJson } from "@/lib/client/api"
import { AdminNav } from "@/components/admin-nav"
import { toast } from "sonner"

interface BillingConfig {
  currency: string
  permanentCreditPacks: {
    id: string
    credits: number
    priceUSD: number
    pricePerCredit: number
    label: string
    popular: boolean
  }[]
  applicationTiers: {
    id: string
    credits: number
    label: string
    description: string
  }[]
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
  subscriptionPlans: {
    id: string
    name: string
    priceUSD: number
    mirrorCredits: number
    interval: string
    active: boolean
    custom?: boolean
  }[]
  baselineCostModel: {
    version: string
    tiers: { units: number; costUSD: number }[]
    creditsPerBaselineUnit: number
  }
  conversionRate: {
    AtaiCreditsPerBaselineUnit: number
    description: string
  }
  collaborateCosts: {
    chatMessageCost: number
    planAnalysisCost: number
    defaults: { chatMessageCost: number; planAnalysisCost: number }
  }
}

// ── Collaborate AI costs — editable card ─────────────────────────────────────

function CollaborateCostsCard({
  costs,
  onSaved,
}: {
  costs: BillingConfig["collaborateCosts"]
  onSaved: () => void
}) {
  const [chat, setChat] = useState(String(costs.chatMessageCost))
  const [analyze, setAnalyze] = useState(String(costs.planAnalysisCost))
  const [saving, setSaving] = useState(false)

  // Re-sync fields when fresh data arrives (e.g. after save or refresh).
  useEffect(() => {
    setChat(String(costs.chatMessageCost))
    setAnalyze(String(costs.planAnalysisCost))
  }, [costs.chatMessageCost, costs.planAnalysisCost])

  const chatNum = Number(chat)
  const analyzeNum = Number(analyze)
  const valid =
    Number.isInteger(chatNum) && chatNum >= 0 && chatNum <= 10000 &&
    Number.isInteger(analyzeNum) && analyzeNum >= 0 && analyzeNum <= 100000
  const dirty = chatNum !== costs.chatMessageCost || analyzeNum !== costs.planAnalysisCost

  async function save() {
    if (!valid || !dirty || saving) return
    setSaving(true)
    try {
      await patchJson("/api/admin/billing/configuration", {
        collaborate: { chatMessageCost: chatNum, planAnalysisCost: analyzeNum },
      })
      toast.success("Collaborate costs updated.")
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update costs.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="size-4 text-primary" />
          <p className="font-medium">Collaborate AI Co-Founder</p>
          <Badge variant="secondary" className="ml-auto text-[10px]">Runtime-editable</Badge>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Credits charged per AI action in the project Collaborate workspace. Set 0 to make an action free.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="collab-chat-cost" className="text-xs text-muted-foreground">Chat message cost</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="collab-chat-cost"
                type="number"
                min={0}
                max={10000}
                step={1}
                value={chat}
                onChange={(e) => setChat(e.target.value)}
                className="w-24 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="text-xs text-muted-foreground">credits / message</span>
            </div>
            {chatNum !== costs.defaults.chatMessageCost && (
              <p className="mt-1 text-[10px] text-muted-foreground">Default: {costs.defaults.chatMessageCost}</p>
            )}
          </div>
          <div>
            <label htmlFor="collab-analyze-cost" className="text-xs text-muted-foreground">Plan analysis cost</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="collab-analyze-cost"
                type="number"
                min={0}
                max={100000}
                step={1}
                value={analyze}
                onChange={(e) => setAnalyze(e.target.value)}
                className="w-24 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="text-xs text-muted-foreground">credits / analysis</span>
            </div>
            {analyzeNum !== costs.defaults.planAnalysisCost && (
              <p className="mt-1 text-[10px] text-muted-foreground">Default: {costs.defaults.planAnalysisCost}</p>
            )}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" onClick={save} disabled={!valid || !dirty || saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            Save changes
          </Button>
          {dirty && valid && <span className="text-[11px] text-amber-500">Unsaved changes</span>}
          {!valid && <span className="text-[11px] text-destructive">Costs must be whole numbers ≥ 0</span>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminConfigurationPage() {
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
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Billing Configuration</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              View and manage billing system configuration, pricing, and integration settings.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => mutate()} className="gap-1.5">
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </header>

        {/* ── Dodo Integration ── */}
        <section className="mt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Payment Integration</p>
          <Card>
            <CardContent className="py-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${config?.dodoConfig.apiKeyConfigured ? "bg-green-500/10" : "bg-amber-500/10"}`}>
                    {config?.dodoConfig.apiKeyConfigured ? (
                      <CheckCircle2 className="size-4 text-green-500" />
                    ) : (
                      <XCircle className="size-4 text-amber-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">Dodo API Key</p>
                    <p className="text-xs text-muted-foreground">{config?.dodoConfig.apiKeyConfigured ? "Configured" : "Not configured"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${config?.dodoConfig.webhookKeyConfigured ? "bg-green-500/10" : "bg-amber-500/10"}`}>
                    {config?.dodoConfig.webhookKeyConfigured ? (
                      <CheckCircle2 className="size-4 text-green-500" />
                    ) : (
                      <XCircle className="size-4 text-amber-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">Webhook Secret</p>
                    <p className="text-xs text-muted-foreground">{config?.dodoConfig.webhookKeyConfigured ? "Configured" : "Not configured"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${config?.dodoConfig.environment === "live_mode" ? "bg-green-500/10" : "bg-amber-500/10"}`}>
                    <Key className={`size-4 ${config?.dodoConfig.environment === "live_mode" ? "text-green-500" : "text-amber-500"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Environment</p>
                    <p className="text-xs text-muted-foreground capitalize">{config?.dodoConfig.environment ?? "Not configured"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── System Configuration ── */}
        <section className="mt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">System Configuration</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="py-5">
                <div className="flex items-center gap-2 mb-4">
                  <Coins className="size-4 text-primary" />
                  <p className="font-medium">Credit System</p>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Currency</span>
                    <span className="font-mono">{config?.systemConfig.currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Credit Unit</span>
                    <span className="font-mono text-xs">{config?.systemConfig.creditUnit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Welcome Bonus</span>
                    <span className="font-mono text-green-500">+{config?.systemConfig.welcomeBonusCredits.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Billing Currency</span>
                    <span className="font-mono">{config?.currency ?? "USD"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="size-4 text-primary" />
                  <p className="font-medium">Referral Rewards</p>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Verification Reward</span>
                    <span className="font-mono text-green-500">+{config?.systemConfig.referralVerificationReward.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Milestone Reward</span>
                    <span className="font-mono text-green-500">+{config?.systemConfig.referralMilestoneReward.toLocaleString()}</span>
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

        {/* ── Collaborate AI Costs (runtime-editable) ── */}
        <section className="mt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">AI Collaboration Costs</p>
          {config?.collaborateCosts && (
            <CollaborateCostsCard costs={config.collaborateCosts} onSaved={() => mutate()} />
          )}
        </section>

        {/* ── Conversion Rate ── */}
        <section className="mt-8">
          <Card>
            <CardContent className="py-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="size-4 text-primary" />
                <p className="font-medium">Credit Conversion</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary">1</p>
                  <p className="text-xs text-muted-foreground">Baseline Unit</p>
                </div>
                <ArrowRight className="size-6 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary">{config?.conversionRate.AtaiCreditsPerBaselineUnit.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Atai Credits</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{config?.conversionRate.description}</p>
            </CardContent>
          </Card>
        </section>

        {/* ── Application Build Costs ── */}
        <section className="mt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Application Build Costs</p>
          <Card>
            <CardContent className="py-5">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-xs font-mono uppercase text-muted-foreground">Complexity</th>
                      <th className="text-left py-2 text-xs font-mono uppercase text-muted-foreground">Label</th>
                      <th className="text-right py-2 text-xs font-mono uppercase text-muted-foreground">Customer Cost</th>
                      <th className="text-right py-2 text-xs font-mono uppercase text-muted-foreground">Provider Budget</th>
                      <th className="text-left py-2 text-xs font-mono uppercase text-muted-foreground">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config?.applicationTiers.map((tier) => (
                      <tr key={tier.id} className="border-b border-border last:border-0">
                        <td className="py-3 font-mono font-medium capitalize">{tier.id}</td>
                        <td className="py-3">{tier.label}</td>
                        <td className="py-3 text-right font-mono font-semibold text-primary">{tier.credits.toLocaleString()} credits</td>
                        <td className="py-3 text-right font-mono text-muted-foreground">{Math.round(tier.credits / (config?.conversionRate.AtaiCreditsPerBaselineUnit ?? 1000))}</td>
                        <td className="py-3 text-xs text-muted-foreground max-w-[200px]">{tier.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>



        {/* ── Subscription Plans ── */}
        <section className="mt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Subscription Plans</p>
          <Card>
            <CardContent className="py-5">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-xs font-mono uppercase text-muted-foreground">Plan</th>
                      <th className="text-right py-2 text-xs font-mono uppercase text-muted-foreground">Price</th>
                      <th className="text-right py-2 text-xs font-mono uppercase text-muted-foreground">Credits</th>
                      <th className="text-right py-2 text-xs font-mono uppercase text-muted-foreground">Baseline Units</th>
                      <th className="text-left py-2 text-xs font-mono uppercase text-muted-foreground">Interval</th>
                      <th className="text-left py-2 text-xs font-mono uppercase text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config?.subscriptionPlans.map((plan) => (
                      <tr key={plan.id} className="border-b border-border last:border-0">
                        <td className="py-3 font-medium">
                          {plan.name}
                          {plan.custom && <Badge variant="secondary" className="ml-2 text-[10px]">Custom</Badge>}
                        </td>
                        <td className="py-3 text-right font-mono">${plan.priceUSD}/mo</td>
                        <td className="py-3 text-right font-mono text-primary">{plan.mirrorCredits.toLocaleString()}</td>
                        <td className="py-3 text-right font-mono text-muted-foreground">{Math.round(plan.mirrorCredits / (config?.conversionRate.AtaiCreditsPerBaselineUnit ?? 1000)).toLocaleString()}</td>
                        <td className="py-3 capitalize">{plan.interval}</td>
                        <td className="py-3">
                          <Badge variant={plan.active ? "default" : "outline"}>
                            {plan.active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Permanent Credit Packs ── */}
        <section className="mt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Permanent Credit Packs</p>
          <Card>
            <CardContent className="py-5">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-xs font-mono uppercase text-muted-foreground">Pack</th>
                      <th className="text-right py-2 text-xs font-mono uppercase text-muted-foreground">Credits</th>
                      <th className="text-right py-2 text-xs font-mono uppercase text-muted-foreground">Price</th>
                      <th className="text-right py-2 text-xs font-mono uppercase text-muted-foreground">Per Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config?.permanentCreditPacks.map((pack) => (
                      <tr key={pack.id} className="border-b border-border last:border-0">
                        <td className="py-3 font-medium">{pack.label}</td>
                        <td className="py-3 text-right font-mono">{pack.credits.toLocaleString()}</td>
                        <td className="py-3 text-right font-mono">${pack.priceUSD}</td>
                        <td className="py-3 text-right font-mono text-muted-foreground">${(pack.priceUSD / pack.credits).toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>


      </div>
    </main>
  )
}
