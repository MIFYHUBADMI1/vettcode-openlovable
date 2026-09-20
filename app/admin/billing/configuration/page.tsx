"use client"

import useSWR from "swr"
import { useEffect, useState } from "react"
import {
  Loader2, AlertTriangle, Shield, Settings, Coins, DollarSign, Package,
  RefreshCw, CreditCard, Webhook, Key, ArrowRight, CheckCircle2, XCircle,
  TrendingUp, Star, Zap, MessageSquare, Brain, Hammer, Globe, Rocket, GitFork, Database, Gift,
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
    autoCompleteSectionCost: number
    defaults: { chatMessageCost: number; planAnalysisCost: number; autoCompleteSectionCost: number }
  }
  buildTierCosts: {
    simple: number
    medium: number
    complex: number
    defaults: { simple: number; medium: number; complex: number }
  }
  mirrorPipelineCosts: {
    scrapeCost: number
    heavyScrapeCost: number
    planCost: number
    heavyPlanCost: number
    deepCrawlCost: number
    heavyDeepCrawlCost: number
    defaults: {
      scrapeCost: number; heavyScrapeCost: number; planCost: number
      heavyPlanCost: number; deepCrawlCost: number; heavyDeepCrawlCost: number
    }
  }
  deploymentCosts: {
    deployCost: number
    defaults: { deployCost: number }
  }
  forkPricing: {
    simpleForkCost: number
    mediumForkCost: number
    complexForkCost: number
    simpleOwnerRoyalty: number
    mediumOwnerRoyalty: number
    complexOwnerRoyalty: number
    defaults: {
      simpleForkCost: number; mediumForkCost: number; complexForkCost: number
      simpleOwnerRoyalty: number; mediumOwnerRoyalty: number; complexOwnerRoyalty: number
    }
  }
  infrastructurePrices: {
    basicPrice: number
    starterPrice: number
    proPrice: number
    businessPrice: number
    defaults: { basicPrice: number; starterPrice: number; proPrice: number; businessPrice: number }
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
  const [autoComplete, setAutoComplete] = useState(String(costs.autoCompleteSectionCost))
  const [saving, setSaving] = useState(false)

  // Re-sync fields when fresh data arrives (e.g. after save or refresh).
  useEffect(() => {
    setChat(String(costs.chatMessageCost))
    setAnalyze(String(costs.planAnalysisCost))
    setAutoComplete(String(costs.autoCompleteSectionCost))
  }, [costs.chatMessageCost, costs.planAnalysisCost, costs.autoCompleteSectionCost])

  const chatNum = Number(chat)
  const analyzeNum = Number(analyze)
  const autoCompleteNum = Number(autoComplete)
  const valid =
    Number.isInteger(chatNum) && chatNum >= 0 && chatNum <= 10000 &&
    Number.isInteger(analyzeNum) && analyzeNum >= 0 && analyzeNum <= 100000 &&
    Number.isInteger(autoCompleteNum) && autoCompleteNum >= 0 && autoCompleteNum <= 10000
  const dirty =
    chatNum !== costs.chatMessageCost ||
    analyzeNum !== costs.planAnalysisCost ||
    autoCompleteNum !== costs.autoCompleteSectionCost

  async function save() {
    if (!valid || !dirty || saving) return
    setSaving(true)
    try {
      await patchJson("/api/admin/billing/configuration", {
        collaborate: { chatMessageCost: chatNum, planAnalysisCost: analyzeNum, autoCompleteSectionCost: autoCompleteNum },
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
                className="w-24 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-medium font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="text-xs text-muted-foreground">credits / analysis</span>
            </div>
            {analyzeNum !== costs.defaults.planAnalysisCost && (
              <p className="mt-1 text-[10px] text-muted-foreground">Default: {costs.defaults.planAnalysisCost}</p>
            )}
          </div>
          <div>
            <label htmlFor="collab-autocomplete-cost" className="text-xs text-muted-foreground">Auto-complete section cost</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="collab-autocomplete-cost"
                type="number"
                min={0}
                max={10000}
                step={1}
                value={autoComplete}
                onChange={(e) => setAutoComplete(e.target.value)}
                className="w-24 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="text-xs text-muted-foreground">credits / section</span>
            </div>
            {autoCompleteNum !== costs.defaults.autoCompleteSectionCost && (
              <p className="mt-1 text-[10px] text-muted-foreground">Default: {costs.defaults.autoCompleteSectionCost}</p>
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

// ── Build tier costs — editable card ─────────────────────────────────────────

function BuildTierCostsCard({
  costs,
  onSaved,
}: {
  costs: BillingConfig["buildTierCosts"]
  onSaved: () => void
}) {
  const [simple, setSimple] = useState(String(costs.simple))
  const [medium, setMedium] = useState(String(costs.medium))
  const [complex, setComplex] = useState(String(costs.complex))
  const [saving, setSaving] = useState(false)

  // Re-sync fields when fresh data arrives (e.g. after save or refresh).
  useEffect(() => {
    setSimple(String(costs.simple))
    setMedium(String(costs.medium))
    setComplex(String(costs.complex))
  }, [costs.simple, costs.medium, costs.complex])

  const simpleNum = Number(simple)
  const mediumNum = Number(medium)
  const complexNum = Number(complex)
  const valid =
    Number.isInteger(simpleNum) && simpleNum >= 0 && simpleNum <= 10_000_000 &&
    Number.isInteger(mediumNum) && mediumNum >= 0 && mediumNum <= 10_000_000 &&
    Number.isInteger(complexNum) && complexNum >= 0 && complexNum <= 10_000_000
  const dirty =
    simpleNum !== costs.simple || mediumNum !== costs.medium || complexNum !== costs.complex

  async function save() {
    if (!valid || !dirty || saving) return
    setSaving(true)
    try {
      await patchJson("/api/admin/billing/configuration", {
        buildTiers: { simple: simpleNum, medium: mediumNum, complex: complexNum },
      })
      toast.success("Build tier costs updated.")
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update build costs.")
    } finally {
      setSaving(false)
    }
  }

  const tiers = [
    { id: "simple", label: "Simple", value: simple, set: setSimple, num: simpleNum, def: costs.defaults.simple },
    { id: "medium", label: "Medium", value: medium, set: setMedium, num: mediumNum, def: costs.defaults.medium },
    { id: "complex", label: "Complex", value: complex, set: setComplex, num: complexNum, def: costs.defaults.complex },
  ]

  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-center gap-2 mb-1">
          <Hammer className="size-4 text-primary" />
          <p className="font-medium">Application Build Tiers</p>
          <Badge variant="secondary" className="ml-auto text-[10px]">Runtime-editable</Badge>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Credits charged for initial builds and follow-up AI edits, per complexity tier. Set 0 to make builds free.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {tiers.map((t) => (
            <div key={t.id}>
              <label htmlFor={`build-tier-${t.id}`} className="text-xs text-muted-foreground">{t.label} tier</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id={`build-tier-${t.id}`}
                  type="number"
                  min={0}
                  max={10000000}
                  step={1}
                  value={t.value}
                  onChange={(e) => t.set(e.target.value)}
                  className="w-28 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="text-xs text-muted-foreground">credits</span>
              </div>
              {t.num !== t.def && (
                <p className="mt-1 text-[10px] text-muted-foreground">Default: {t.def.toLocaleString()}</p>
              )}
            </div>
          ))}
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

// ── Mirror/crawl pipeline costs — editable card ────────────────────────────

function MirrorPipelineCostsCard({
  costs,
  onSaved,
}: {
  costs: BillingConfig["mirrorPipelineCosts"]
  onSaved: () => void
}) {
  const fields = [
    { key: "scrapeCost", label: "Website scrape (legacy)", max: 100_000 },
    { key: "heavyScrapeCost", label: "Website scrape (heavy)", max: 100_000 },
    { key: "planCost", label: "Plan generation (legacy)", max: 100_000 },
    { key: "heavyPlanCost", label: "Plan generation (heavy)", max: 100_000 },
    { key: "deepCrawlCost", label: "Deep crawl (legacy)", max: 1_000_000 },
    { key: "heavyDeepCrawlCost", label: "Deep crawl (heavy)", max: 1_000_000 },
  ] as const

  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, String(costs[f.key])])),
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValues(Object.fromEntries(fields.map((f) => [f.key, String(costs[f.key])])))
  }, [costs])

  const nums = Object.fromEntries(fields.map((f) => [f.key, Number(values[f.key])]))
  const valid = fields.every(
    (f) => Number.isInteger(nums[f.key]) && nums[f.key] >= 0 && nums[f.key] <= f.max,
  )
  const dirty = fields.some((f) => nums[f.key] !== costs[f.key])

  async function save() {
    if (!valid || !dirty || saving) return
    setSaving(true)
    try {
      await patchJson("/api/admin/billing/configuration", {
        mirrorPipeline: Object.fromEntries(fields.map((f) => [f.key, nums[f.key]])),
      })
      toast.success("Mirror pipeline costs updated.")
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update mirror costs.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-center gap-2 mb-1">
          <Globe className="size-4 text-primary" />
          <p className="font-medium">Mirror & Crawl Pipeline</p>
          <Badge variant="secondary" className="ml-auto text-[10px]">Runtime-editable</Badge>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Credits charged for website mirroring: scrape, plan generation, and full-site deep crawl — per pipeline mode. Set 0 to make an action free.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {fields.map((f) => (
            <div key={f.key}>
              <label htmlFor={`mirror-${f.key}`} className="text-xs text-muted-foreground">{f.label}</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id={`mirror-${f.key}`}
                  type="number"
                  min={0}
                  max={f.max}
                  step={1}
                  value={values[f.key]}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="w-24 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="text-xs text-muted-foreground">credits</span>
              </div>
              {nums[f.key] !== costs.defaults[f.key] && (
                <p className="mt-1 text-[10px] text-muted-foreground">Default: {costs.defaults[f.key]}</p>
              )}
            </div>
          ))}
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

// ── Deployment cost — editable card ─────────────────────────────────────────

function DeploymentCostsCard({
  costs,
  onSaved,
}: {
  costs: BillingConfig["deploymentCosts"]
  onSaved: () => void
}) {
  const [deploy, setDeploy] = useState(String(costs.deployCost))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDeploy(String(costs.deployCost))
  }, [costs.deployCost])

  const deployNum = Number(deploy)
  const valid = Number.isInteger(deployNum) && deployNum >= 0 && deployNum <= 1_000_000
  const dirty = deployNum !== costs.deployCost

  async function save() {
    if (!valid || !dirty || saving) return
    setSaving(true)
    try {
      await patchJson("/api/admin/billing/configuration", {
        deployment: { deployCost: deployNum },
      })
      toast.success("Deployment cost updated.")
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update deployment cost.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-center gap-2 mb-1">
          <Rocket className="size-4 text-primary" />
          <p className="font-medium">Deployment</p>
          <Badge variant="secondary" className="ml-auto text-[10px]">Runtime-editable</Badge>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Credits charged per production deployment (lifetime hosting). Set 0 to make deploys free.
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="deploy-cost" className="text-xs text-muted-foreground">Cost per deploy</label>
          <input
            id="deploy-cost"
            type="number"
            min={0}
            max={1000000}
            step={1}
            value={deploy}
            onChange={(e) => setDeploy(e.target.value)}
            className="w-28 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <span className="text-xs text-muted-foreground">credits</span>
          {deployNum !== costs.defaults.deployCost && (
            <span className="text-[10px] text-muted-foreground">Default: {costs.defaults.deployCost.toLocaleString()}</span>
          )}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" onClick={save} disabled={!valid || !dirty || saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            Save changes
          </Button>
          {dirty && valid && <span className="text-[11px] text-amber-500">Unsaved changes</span>}
          {!valid && <span className="text-[11px] text-destructive">Cost must be a whole number ≥ 0</span>}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Fork pricing — editable card ─────────────────────────────────────────

function ForkPricingCard({
  costs,
  onSaved,
}: {
  costs: BillingConfig["forkPricing"]
  onSaved: () => void
}) {
  const fields = [
    { key: "simpleForkCost", label: "Simple — fork cost" },
    { key: "mediumForkCost", label: "Medium — fork cost" },
    { key: "complexForkCost", label: "Complex — fork cost" },
    { key: "simpleOwnerRoyalty", label: "Simple — owner royalty" },
    { key: "mediumOwnerRoyalty", label: "Medium — owner royalty" },
    { key: "complexOwnerRoyalty", label: "Complex — owner royalty" },
  ] as const

  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, String(costs[f.key])])),
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValues(Object.fromEntries(fields.map((f) => [f.key, String(costs[f.key])])))
  }, [costs])

  const nums = Object.fromEntries(fields.map((f) => [f.key, Number(values[f.key])]))
  const valid = fields.every((f) => Number.isInteger(nums[f.key]) && nums[f.key] >= 0 && nums[f.key] <= 10_000_000)
  const dirty = fields.some((f) => nums[f.key] !== costs[f.key])

  async function save() {
    if (!valid || !dirty || saving) return
    setSaving(true)
    try {
      await patchJson("/api/admin/billing/configuration", {
        forkPricing: Object.fromEntries(fields.map((f) => [f.key, nums[f.key]])),
      })
      toast.success("Fork pricing updated.")
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update fork pricing.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-center gap-2 mb-1">
          <GitFork className="size-4 text-primary" />
          <p className="font-medium">Marketplace Forks</p>
          <Badge variant="secondary" className="ml-auto text-[10px]">Runtime-editable</Badge>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Credits charged to fork a public project, and the royalty granted to the original owner, per tier.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {fields.map((f) => (
            <div key={f.key}>
              <label htmlFor={`fork-${f.key}`} className="text-xs text-muted-foreground">{f.label}</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id={`fork-${f.key}`}
                  type="number"
                  min={0}
                  max={10000000}
                  step={1}
                  value={values[f.key]}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="w-24 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="text-xs text-muted-foreground">credits</span>
              </div>
              {nums[f.key] !== costs.defaults[f.key] && (
                <p className="mt-1 text-[10px] text-muted-foreground">Default: {costs.defaults[f.key].toLocaleString()}</p>
              )}
            </div>
          ))}
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

// ── Infrastructure plan prices — editable card ────────────────────────────

function InfrastructurePricesCard({
  costs,
  onSaved,
}: {
  costs: BillingConfig["infrastructurePrices"]
  onSaved: () => void
}) {
  const fields = [
    { key: "basicPrice", label: "Basic" },
    { key: "starterPrice", label: "Starter" },
    { key: "proPrice", label: "Pro" },
    { key: "businessPrice", label: "Business" },
  ] as const

  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, String(costs[f.key])])),
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValues(Object.fromEntries(fields.map((f) => [f.key, String(costs[f.key])])))
  }, [costs])

  const nums = Object.fromEntries(fields.map((f) => [f.key, Number(values[f.key])]))
  const valid = fields.every((f) => Number.isInteger(nums[f.key]) && nums[f.key] >= 0 && nums[f.key] <= 10_000_000)
  const dirty = fields.some((f) => nums[f.key] !== costs[f.key])

  async function save() {
    if (!valid || !dirty || saving) return
    setSaving(true)
    try {
      await patchJson("/api/admin/billing/configuration", {
        infrastructurePrices: Object.fromEntries(fields.map((f) => [f.key, nums[f.key]])),
      })
      toast.success("Infrastructure prices updated.")
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update infrastructure prices.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-center gap-2 mb-1">
          <Database className="size-4 text-primary" />
          <p className="font-medium">Infrastructure Plans (monthly)</p>
          <Badge variant="secondary" className="ml-auto text-[10px]">Runtime-editable</Badge>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Monthly credits charged for each project infrastructure plan. Set 0 to make a plan free.
        </p>
        <div className="grid gap-4 sm:grid-cols-4">
          {fields.map((f) => (
            <div key={f.key}>
              <label htmlFor={`infra-${f.key}`} className="text-xs text-muted-foreground">{f.label}</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id={`infra-${f.key}`}
                  type="number"
                  min={0}
                  max={10000000}
                  step={1}
                  value={values[f.key]}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="w-24 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="text-xs text-muted-foreground">/mo</span>
              </div>
              {nums[f.key] !== costs.defaults[f.key] && (
                <p className="mt-1 text-[10px] text-muted-foreground">Default: {costs.defaults[f.key].toLocaleString()}</p>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" onClick={save} disabled={!valid || !dirty || saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            Save changes
          </Button>
          {dirty && valid && <span className="text-[11px] text-amber-500">Unsaved changes</span>}
          {!valid && <span className="text-[11px] text-destructive">Prices must be whole numbers ≥ 0</span>}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Rewards — editable card ──────────────────────────────────────────────

function RewardsCard({
  system,
  onSaved,
}: {
  system: BillingConfig["systemConfig"]
  onSaved: () => void
}) {
  const fields = [
    { key: "welcomeBonusCredits", label: "Welcome bonus (on email verification)" },
    { key: "referralVerificationReward", label: "Referral — verification reward" },
    { key: "referralMilestoneReward", label: "Referral — milestone reward" },
    { key: "referralMilestoneThreshold", label: "Referral — milestone usage threshold" },
  ] as const

  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, String(system[f.key])])),
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValues(Object.fromEntries(fields.map((f) => [f.key, String(system[f.key])])))
  }, [system])

  const nums = Object.fromEntries(fields.map((f) => [f.key, Number(values[f.key])]))
  const valid = fields.every((f) => Number.isInteger(nums[f.key]) && nums[f.key] >= 0 && nums[f.key] <= 100_000_000)
  const dirty = fields.some((f) => nums[f.key] !== system[f.key])

  async function save() {
    if (!valid || !dirty || saving) return
    setSaving(true)
    try {
      await patchJson("/api/admin/billing/configuration", {
        rewards: {
          welcomeBonus: nums.welcomeBonusCredits,
          referralVerificationReward: nums.referralVerificationReward,
          referralMilestoneReward: nums.referralMilestoneReward,
          referralMilestoneThreshold: nums.referralMilestoneThreshold,
        },
      })
      toast.success("Reward settings updated.")
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update reward settings.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="py-5">
        <div className="flex items-center gap-2 mb-1">
          <Gift className="size-4 text-primary" />
          <p className="font-medium">Welcome Bonus & Referral Rewards</p>
          <Badge variant="secondary" className="ml-auto text-[10px]">Runtime-editable</Badge>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Credits granted to users: signup welcome bonus and referral rewards. Applies to future grants only.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key}>
              <label htmlFor={`reward-${f.key}`} className="text-xs text-muted-foreground">{f.label}</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id={`reward-${f.key}`}
                  type="number"
                  min={0}
                  max={100000000}
                  step={1}
                  value={values[f.key]}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="w-28 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="text-xs text-muted-foreground">credits</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" onClick={save} disabled={!valid || !dirty || saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            Save changes
          </Button>
          {dirty && valid && <span className="text-[11px] text-amber-500">Unsaved changes</span>}
          {!valid && <span className="text-[11px] text-destructive">Values must be whole numbers ≥ 0</span>}
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

        {/* ── Runtime-Editable Costs ── */}
        <section className="mt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Build Costs</p>
          {config?.buildTierCosts && (
            <BuildTierCostsCard costs={config.buildTierCosts} onSaved={() => mutate()} />
          )}
        </section>

        <section className="mt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Mirror & Crawl Costs</p>
          {config?.mirrorPipelineCosts && (
            <MirrorPipelineCostsCard costs={config.mirrorPipelineCosts} onSaved={() => mutate()} />
          )}
        </section>

        <section className="mt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Marketplace Forks</p>
          {config?.forkPricing && (
            <ForkPricingCard costs={config.forkPricing} onSaved={() => mutate()} />
          )}
        </section>

        <section className="mt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Infrastructure Plan Prices</p>
          {config?.infrastructurePrices && (
            <InfrastructurePricesCard costs={config.infrastructurePrices} onSaved={() => mutate()} />
          )}
        </section>

        <section className="mt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Deployment Cost</p>
          {config?.deploymentCosts && (
            <DeploymentCostsCard costs={config.deploymentCosts} onSaved={() => mutate()} />
          )}
        </section>

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
                        <td className="py-3 text-right font-mono font-semibold text-primary">
                          {(config?.buildTierCosts
                            ? config.buildTierCosts[tier.id as "simple" | "medium" | "complex"] ?? tier.credits
                            : tier.credits
                          ).toLocaleString()} credits
                          {config?.buildTierCosts && config.buildTierCosts[tier.id as "simple" | "medium" | "complex"] !== tier.credits && (
                            <span className="ml-1 text-[10px] text-muted-foreground">(default {tier.credits.toLocaleString()})</span>
                          )}
                        </td>
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
