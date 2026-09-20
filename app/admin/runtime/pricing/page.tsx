"use client"

import useSWR from "swr"
import { useState, useEffect } from "react"
import {
  Loader2, AlertTriangle, Shield, RefreshCw, CheckCircle2, XCircle,
  Route, Plus, Power, Coins, Zap, Info,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { jsonFetcher, postJson, patchJson } from "@/lib/client/api"
import { AdminNav } from "@/components/admin-nav"
import { toast } from "sonner"

interface PricingRule {
  id: string
  provider: string
  capability: string
  operation: string
  mode: "fixed_per_request" | "per_1k_tokens"
  credits?: number
  inputPer1k?: number
  outputPer1k?: number
  active: boolean
  createdBy?: string
  createdAt: number
  updatedAt: number
}

interface PricingConfig {
  rules: PricingRule[]
  capabilities: { id: string; operations: string[] }[]
  providers: string[]
  pricingVersion: string
  resolution: string
}

const EMPTY_FORM = {
  provider: "",
  capability: "",
  operation: "",
  mode: "fixed_per_request" as "fixed_per_request" | "per_1k_tokens",
  credits: "",
  inputPer1k: "",
  outputPer1k: "",
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

function RuleForm({
  config,
  onSaved,
}: {
  config: PricingConfig
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const selectedCap = config.capabilities.find((c) => c.id === form.capability)
  const valid =
    form.provider !== "" &&
    selectedCap !== undefined &&
    selectedCap.operations.includes(form.operation) &&
    (form.mode === "fixed_per_request"
      ? Number.isInteger(Number(form.credits)) && Number(form.credits) >= 0
      : Number.isInteger(Number(form.inputPer1k)) && Number(form.inputPer1k) >= 0 &&
        Number.isInteger(Number(form.outputPer1k)) && Number(form.outputPer1k) >= 0)

  async function save() {
    if (!valid || saving) return
    setSaving(true)
    try {
      await postJson("/api/admin/runtime/pricing", {
        provider: form.provider,
        capability: form.capability,
        operation: form.operation,
        mode: form.mode,
        ...(form.mode === "fixed_per_request"
          ? { credits: Number(form.credits) }
          : { inputPer1k: Number(form.inputPer1k), outputPer1k: Number(form.outputPer1k) }),
      })
      toast.success("Pricing rule created.")
      setForm(EMPTY_FORM)
      setOpen(false)
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the pricing rule.")
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="size-3.5" />
        New pricing rule
      </Button>
    )
  }

  return (
    <Card className="w-full">
      <CardContent className="py-5">
        <div className="flex items-center gap-2 mb-4">
          <Coins className="size-4 text-primary" />
          <p className="font-medium">New runtime pricing rule</p>
          <Badge variant="secondary" className="ml-auto text-[10px]">Applies to future requests</Badge>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="rule-provider" className="text-xs text-muted-foreground">Provider</label>
            <select
              id="rule-provider"
              value={form.provider}
              onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Select provider…</option>
              {config.providers.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rule-capability" className="text-xs text-muted-foreground">Capability</label>
            <select
              id="rule-capability"
              value={form.capability}
              onChange={(e) => setForm((f) => ({ ...f, capability: e.target.value, operation: "" }))}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Select capability…</option>
              {config.capabilities.map((c) => (
                <option key={c.id} value={c.id}>{c.id}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rule-operation" className="text-xs text-muted-foreground">Operation</label>
            <select
              id="rule-operation"
              value={form.operation}
              onChange={(e) => setForm((f) => ({ ...f, operation: e.target.value }))}
              disabled={!selectedCap}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
            >
              <option value="">Select operation…</option>
              {selectedCap?.operations.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rule-mode" className="text-xs text-muted-foreground">Pricing mode</label>
            <select
              id="rule-mode"
              value={form.mode}
              onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value as typeof f.mode }))}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="fixed_per_request">Fixed — credits per request</option>
              <option value="per_1k_tokens">Usage — credits per 1k tokens</option>
            </select>
          </div>
          {form.mode === "fixed_per_request" ? (
            <div>
              <label htmlFor="rule-credits" className="text-xs text-muted-foreground">Charge (credits per request)</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="rule-credits"
                  type="number" min={0} max={1000000} step={1}
                  value={form.credits}
                  onChange={(e) => setForm((f) => ({ ...f, credits: e.target.value }))}
                  className="w-28 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="text-xs text-muted-foreground">0 = free</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="rule-input" className="text-xs text-muted-foreground">Credits / 1k input</label>
                <input
                  id="rule-input"
                  type="number" min={0} max={1000000} step={1}
                  value={form.inputPer1k}
                  onChange={(e) => setForm((f) => ({ ...f, inputPer1k: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label htmlFor="rule-output" className="text-xs text-muted-foreground">Credits / 1k output</label>
                <input
                  id="rule-output"
                  type="number" min={0} max={1000000} step={1}
                  value={form.outputPer1k}
                  onChange={(e) => setForm((f) => ({ ...f, outputPer1k: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" onClick={save} disabled={!valid || saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            Create rule
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setOpen(false); setForm(EMPTY_FORM) }}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminRuntimePricingPage() {
  const { data: config, error, isLoading, mutate } = useSWR<PricingConfig>(
    "/api/admin/runtime/pricing",
    jsonFetcher,
    { refreshInterval: 60000 },
  )
  const [busyRuleId, setBusyRuleId] = useState<string | null>(null)

  async function toggleRule(rule: PricingRule) {
    setBusyRuleId(rule.id)
    try {
      await patchJson(`/api/admin/runtime/pricing/${rule.id}`, { active: !rule.active })
      toast.success(rule.active ? "Rule deactivated — future requests will fall back to default pricing." : "Rule activated.")
      mutate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the rule.")
    } finally {
      setBusyRuleId(null)
    }
  }

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

  const rules = config?.rules ?? []

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AdminNav />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Admin</p>
              <Badge variant="secondary" className="gap-1 text-xs">
                <Shield className="size-3" />
                Runtime
              </Badge>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Runtime Pricing</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure what each runtime operation costs in Atai credits. No deploy required.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RuleForm config={config ?? { rules: [], capabilities: [], providers: [], pricingVersion: "", resolution: "" }} onSaved={() => mutate()} />
            <Button variant="outline" size="sm" onClick={() => mutate()} className="gap-1.5">
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
          </div>
        </header>

        <div className="mt-6 flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3">
          <Info className="mt-0.5 size-3.5 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            Resolution: {config?.resolution ?? "—"}. Operations with no matching rule and no default pricing are
            <strong> denied</strong> (never silently free). Charges are snapshotted onto each usage record — editing
            pricing never rewrites history. Provider cost data is recorded for analytics but never treated as credits.
          </p>
        </div>

        <section className="mt-8">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">Pricing Rules ({rules.length})</p>
          {rules.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Route className="size-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-lg font-medium">No pricing rules yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Runtime operations fall back to the built-in default pricing until you add provider-specific rules.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 text-xs font-mono uppercase text-muted-foreground">Provider</th>
                        <th className="text-left py-3 text-xs font-mono uppercase text-muted-foreground">Capability</th>
                        <th className="text-left py-3 text-xs font-mono uppercase text-muted-foreground">Operation</th>
                        <th className="text-left py-3 text-xs font-mono uppercase text-muted-foreground">Charge</th>
                        <th className="text-left py-3 text-xs font-mono uppercase text-muted-foreground">Status</th>
                        <th className="text-left py-3 text-xs font-mono uppercase text-muted-foreground">Updated</th>
                        <th className="text-right py-3 text-xs font-mono uppercase text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules.map((rule) => (
                        <tr key={rule.id} className="border-b border-border last:border-0">
                          <td className="py-3 font-mono text-xs">{rule.provider}</td>
                          <td className="py-3 font-mono text-xs">{rule.capability}</td>
                          <td className="py-3 font-mono text-xs">{rule.operation}</td>
                          <td className="py-3 font-mono text-primary">
                            {rule.mode === "fixed_per_request" ? (
                              <span>{(rule.credits ?? 0).toLocaleString()} / request{rule.credits === 0 && <span className="ml-1 text-[10px] text-muted-foreground">(free)</span>}</span>
                            ) : (
                              <span>{rule.inputPer1k ?? 0} in / {rule.outputPer1k ?? 0} out per 1k</span>
                            )}
                          </td>
                          <td className="py-3">
                            <Badge variant={rule.active ? "default" : "outline"}>
                              {rule.active ? "Active" : "Disabled"}
                            </Badge>
                          </td>
                          <td className="py-3 text-xs text-muted-foreground" title={formatDate(rule.updatedAt)}>{formatDate(rule.updatedAt)}</td>
                          <td className="py-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              disabled={busyRuleId === rule.id}
                              onClick={() => toggleRule(rule)}
                            >
                              {busyRuleId === rule.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : rule.active ? (
                                <><Power className="size-3.5" /> Disable</>
                              ) : (
                                <><Zap className="size-3.5" /> Enable</>
                              )}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
            {rules.some((r) => !r.active) && <><XCircle className="size-3" /> Disabled rules are kept for audit and can be re-enabled — they never apply to future requests.</>}
          </p>
        </section>
      </div>
    </main>
  )
}
