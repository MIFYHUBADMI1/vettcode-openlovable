"use client"

import useSWR from "swr"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  AlertTriangle, CheckCircle2, Coins, Info, Layers, Loader2, PencilLine, Plus,
  RefreshCw, Route, Search, Shield, SlidersHorizontal, Zap,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { jsonFetcher, patchJson, postJson } from "@/lib/client/api"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

/**
 * Atai Admin — runtime pricing.
 *
 * Follows the in-house admin language: the AdminShell layout supplies the
 * sidebar and page title, so this surface never repeats them. Data-dense
 * sections are anchored by an in-page rail, every figure comes from the
 * server-resolved matrix (never guessed client-side), and pricing identity
 * (provider + capability + operation) is auto-resolved from the live runtime
 * registries rather than typed by the admin.
 */

type PricingMode = "fixed_per_request" | "per_1k_tokens"
type PriceSource = "rule" | "legacy" | "unconfigured" | "non_billable"

interface PricingRule {
  id: string
  provider: string
  capability: string
  operation: string
  mode: PricingMode
  credits?: number
  inputPer1k?: number
  outputPer1k?: number
  active: boolean
  createdAt: number
  updatedAt: number
}

/** One capability×operation cell, with its provider auto-resolved server-side. */
interface PricingMatrixEntry {
  capability: string
  operation: string
  provider: string | null
  wired: boolean
  suggestedMode: PricingMode
  effective: {
    source: PriceSource
    mode?: PricingMode
    credits?: number
    inputPer1k?: number
    outputPer1k?: number
    ruleId?: string
  }
  rule: {
    id: string
    active: boolean
    mode: PricingMode
    credits?: number
    inputPer1k?: number
    outputPer1k?: number
  } | null
}

interface PricingConfig {
  rules: PricingRule[]
  capabilities: { id: string; operations: string[] }[]
  providers: string[]
  matrix?: PricingMatrixEntry[]
  pricingVersion: string
  resolution: string
}

interface BulkRow {
  key: string
  provider: string
  capability: string
  operation: string
  mode: PricingMode
  /** Set when an ACTIVE rule already fixes the mode (mode is immutable). */
  lockedMode: PricingMode | null
  credits: string
  inputPer1k: string
  outputPer1k: string
  checked: boolean
}

interface BulkResult {
  created: number
  updated: number
  unchanged: number
  rejected: number
  rows: { capability: string; operation: string; provider: string; outcome: string; error?: string }[]
}

const MAX_RATE = 1_000_000

const RAIL = [
  { id: "pricing-coverage", label: "Coverage" },
  { id: "pricing-bulk", label: "Bulk apply" },
  { id: "pricing-rules", label: "Active rules" },
]

const SOURCE_PILL: Record<PriceSource, string> = {
  rule: "border-primary/30 bg-primary/10 text-primary",
  legacy: "border-border bg-muted text-muted-foreground",
  unconfigured: "border-destructive/30 bg-destructive/10 text-destructive",
  non_billable: "border-border bg-muted/50 text-muted-foreground",
}

const SOURCE_LABEL: Record<PriceSource, string> = {
  rule: "Rule",
  legacy: "Default",
  unconfigured: "Denied",
  non_billable: "Not billable",
}

const fieldClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
const rateClass =
  "h-9 w-24 rounded-lg border border-input bg-transparent px-2.5 text-sm font-mono tabular-nums outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

function formatStamp(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

/** "12 / request" or "2 in · 8 out per 1k" — the shape the admin reads. */
function rateLabel(mode: PricingMode, credits?: number, inputPer1k?: number, outputPer1k?: number): string {
  return mode === "fixed_per_request"
    ? `${(credits ?? 0).toLocaleString()} / request`
    : `${(inputPer1k ?? 0).toLocaleString()} in · ${(outputPer1k ?? 0).toLocaleString()} out per 1k`
}

function SourcePill({ source }: { source: PriceSource }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        SOURCE_PILL[source],
      )}
    >
      {SOURCE_LABEL[source]}
    </span>
  )
}

/** What the runtime charges for this operation RIGHT NOW. */
function ChargeCell({ entry }: { entry: PricingMatrixEntry }) {
  const e = entry.effective
  if (e.source === "unconfigured") {
    return (
      <span className="text-xs text-destructive" title="No rule and no legacy default — the runtime denies this operation before any provider spend.">
        denied
      </span>
    )
  }
  if (e.source === "non_billable") {
    return <span className="text-xs text-muted-foreground">not billable</span>
  }
  return (
    <span className="font-mono text-xs tabular-nums text-foreground">
      {rateLabel(e.mode ?? "fixed_per_request", e.credits, e.inputPer1k, e.outputPer1k)}
    </span>
  )
}

function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string
  value: number
  hint: string
  tone?: "default" | "primary" | "destructive"
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tabular-nums tracking-tight",
          tone === "primary" && "text-primary",
          tone === "destructive" && value > 0 && "text-destructive",
        )}
      >
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

/** Docs-style in-page rail: highlights the section currently in view. */
function SectionRail() {
  const [activeId, setActiveId] = useState(RAIL[0].id)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActiveId(entry.target.id)
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    )
    for (const { id } of RAIL) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  return (
    <nav aria-label="Runtime pricing sections" className="flex flex-col gap-0.5">
      {RAIL.map((item) => {
        const active = item.id === activeId
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={cn(
              "border-l-2 py-1.5 pl-4 text-sm transition-colors",
              active
                ? "border-primary bg-primary/5 font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            {item.label}
          </a>
        )
      })}
    </nav>
  )
}

function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  icon: Icon,
  aside,
}: {
  id: string
  eyebrow: string
  title: string
  description: string
  icon: typeof Coins
  aside?: ReactNode
}) {
  return (
    <div id={id} className="mb-4 flex scroll-mt-24 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p>
        <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Icon className="size-4 text-primary" />
          {title}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      {aside}
    </div>
  )
}

/* ─── Price dialog (create a rule, or adjust an existing one's rates) ─────── */

function PriceDialog({
  matrix,
  initial,
  onOpenChange,
  onSaved,
}: {
  matrix: PricingMatrixEntry[]
  initial: { capability: string; operation: string } | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [capability, setCapability] = useState("")
  const [operation, setOperation] = useState("")
  const [mode, setMode] = useState<PricingMode>("fixed_per_request")
  const [credits, setCredits] = useState("")
  const [inputPer1k, setInputPer1k] = useState("")
  const [outputPer1k, setOutputPer1k] = useState("")
  const [saving, setSaving] = useState(false)

  const open = initial !== null
  const entry = matrix.find((m) => m.capability === capability && m.operation === operation) ?? null
  const activeRule = entry?.rule?.active ? entry.rule : null
  // Mode is immutable while a rule is active — the server enforces the same rule.
  const effectiveMode = activeRule ? activeRule.mode : mode

  const whole = (v: string) => v.trim() !== "" && Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= MAX_RATE
  const rateOk =
    effectiveMode === "fixed_per_request" ? whole(credits) : whole(inputPer1k) && whole(outputPer1k)
  const canSave = Boolean(entry?.provider) && rateOk && !saving

  // Seeding runs whenever the selected triple changes, so the form always
  // starts from what billing actually resolves for that operation.
  useEffect(() => {
    if (!open || !initial) return
    setCapability(initial.capability)
    setOperation(initial.operation)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.capability, initial?.operation])

  useEffect(() => {
    if (!open) return
    const target = matrix.find((m) => m.capability === capability && m.operation === operation)
    if (!target) return
    const active = target.rule?.active ? target.rule : null
    const rule = target.rule
    setMode(active?.mode ?? target.suggestedMode)
    setCredits(String(active?.credits ?? rule?.credits ?? target.effective.credits ?? ""))
    setInputPer1k(String(active?.inputPer1k ?? rule?.inputPer1k ?? target.effective.inputPer1k ?? ""))
    setOutputPer1k(String(active?.outputPer1k ?? rule?.outputPer1k ?? target.effective.outputPer1k ?? ""))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capability, operation, open])

  async function save() {
    if (!canSave || !entry?.provider) return
    setSaving(true)
    try {
      if (activeRule) {
        await patchJson(`/api/admin/runtime/pricing/${activeRule.id}`, {
          ...(effectiveMode === "fixed_per_request" ? { credits: Number(credits) } : { inputPer1k: Number(inputPer1k), outputPer1k: Number(outputPer1k) }),
        })
        toast.success(`${entry.capability}/${entry.operation} repriced.`)
      } else {
        await postJson("/api/admin/runtime/pricing", {
          provider: entry.provider,
          capability: entry.capability,
          operation: entry.operation,
          mode: effectiveMode,
          ...(effectiveMode === "fixed_per_request"
            ? { credits: Number(credits) }
            : { inputPer1k: Number(inputPer1k), outputPer1k: Number(outputPer1k) }),
        })
        toast.success(`Pricing rule created for ${entry.capability}/${entry.operation}.`)
      }
      onSaved()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the pricing rule.")
    } finally {
      setSaving(false)
    }
  }

  const capabilities = useMemo(() => [...new Set(matrix.filter((m) => m.provider !== null).map((m) => m.capability))], [matrix])
  const operations = useMemo(() => matrix.filter((m) => m.capability === capability && m.provider !== null), [matrix, capability])

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onOpenChange(false)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="size-4 text-primary" />
            {activeRule ? "Adjust pricing rule" : "New pricing rule"}
          </DialogTitle>
          <DialogDescription>
            {activeRule
              ? "Rates update in place. Provider, capability, operation and pricing mode stay immutable on an active rule."
              : "The provider is resolved from the live runtime registry — pick the operation, not the wiring."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">Capability</span>
            <select value={capability} onChange={(e) => { setCapability(e.target.value); setOperation("") }} className={fieldClass}>
              <option value="">Select capability…</option>
              {capabilities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs text-muted-foreground">Operation</span>
            <select value={operation} onChange={(e) => setOperation(e.target.value)} disabled={!capability} className={fieldClass}>
              <option value="">Select operation…</option>
              {operations.map((o) => (
                <option key={o.operation} value={o.operation}>{o.operation}</option>
              ))}
            </select>
          </label>
        </div>

        {entry ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
            <Badge variant="outline" className="font-mono text-[11px]">{entry.provider ?? "unwired"}</Badge>
            <span className="font-mono text-xs text-muted-foreground">{entry.capability}/{entry.operation}</span>
            <span className="ml-auto flex items-center gap-2">
              <SourcePill source={entry.effective.source} />
              <ChargeCell entry={entry} />
            </span>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
            Pick a capability and operation to resolve its provider and current charge.
          </p>
        )}

        <label className="grid gap-1.5">
          <span className="text-xs text-muted-foreground">Pricing mode</span>
          <select value={effectiveMode} onChange={(e) => setMode(e.target.value as PricingMode)} disabled={activeRule !== null} className={fieldClass}>
            <option value="fixed_per_request">Fixed — credits per request</option>
            <option value="per_1k_tokens">Usage — credits per 1k tokens</option>
          </select>
          {activeRule ? (
            <span className="text-[11px] text-muted-foreground">
              Mode is locked while this rule is active. Disable it in Active rules to switch modes.
            </span>
          ) : null}
        </label>

        {effectiveMode === "fixed_per_request" ? (
          <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
            <span className="text-sm">Credits per request</span>
            <span className="flex items-center gap-2">
              <input type="number" min={0} max={MAX_RATE} step={1} value={credits} onChange={(e) => setCredits(e.target.value)} className={rateClass} />
              <span className="text-[11px] text-muted-foreground">0 = free</span>
            </span>
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2.5">
              <span className="text-sm">Per 1k input</span>
              <input type="number" min={0} max={MAX_RATE} step={1} value={inputPer1k} onChange={(e) => setInputPer1k(e.target.value)} className={rateClass} />
            </label>
            <label className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2.5">
              <span className="text-sm">Per 1k output</span>
              <input type="number" min={0} max={MAX_RATE} step={1} value={outputPer1k} onChange={(e) => setOutputPer1k(e.target.value)} className={rateClass} />
            </label>
          </div>
        )}

        {!rateOk && entry?.provider ? (
          <p className="text-[11px] text-destructive">Enter whole-number rates between 0 and {MAX_RATE.toLocaleString()}.</p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!canSave} className="gap-1.5">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            {activeRule ? "Save rates" : "Create rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Coverage matrix ─────────────────────────────────────────────────────── */

type SourceFilter = "all" | PriceSource

function CoverageSection({
  matrix,
  onPick,
}: {
  matrix: PricingMatrixEntry[]
  onPick: (entry: { capability: string; operation: string }) => void
}) {
  const [query, setQuery] = useState("")
  const [source, setSource] = useState<SourceFilter>("all")

  const wired = useMemo(() => matrix.filter((m) => m.provider !== null), [matrix])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return wired.filter((m) => {
      if (source !== "all" && m.effective.source !== source) return false
      if (!q) return true
      return `${m.provider} ${m.capability} ${m.operation}`.toLowerCase().includes(q)
    })
  }, [wired, query, source])

  const groups = useMemo(() => {
    const byCap = new Map<string, PricingMatrixEntry[]>()
    for (const m of filtered) {
      const list = byCap.get(m.capability)
      if (list) list.push(m)
      else byCap.set(m.capability, [m])
    }
    return [...byCap.entries()]
  }, [filtered])

  const filters: { id: SourceFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "rule", label: "By rule" },
    { id: "legacy", label: "Default" },
    { id: "unconfigured", label: "Denied" },
  ]

  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find an operation…"
              aria-label="Filter operations"
              className={cn(fieldClass, "pl-9")}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <SlidersHorizontal className="size-3.5 text-muted-foreground" />
            {filters.map((f) => {
              const active = f.id === source
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSource(f.id)}
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    active ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                  )}
                >
                  {f.label}
                  <span className="ml-1.5 font-mono tabular-nums text-[10px] opacity-70">
                    {f.id === "all" ? wired.length : wired.filter((m) => m.effective.source === f.id).length}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {groups.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {wired.length === 0
              ? "No provider adapter is registered yet, so there is nothing to price."
              : "No operation matches this filter."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground">Operation</th>
                  <th className="pb-2 font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground">Provider (auto)</th>
                  <th className="pb-2 font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground">Charge today</th>
                  <th className="pb-2 font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground">Source</th>
                  <th className="pb-2 text-right font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground">Action</th>
                </tr>
              </thead>
              {groups.map(([cap, entries]) => (
                <tbody key={cap} className="border-b border-border/60 last:border-0">
                  <tr>
                    <td colSpan={5} className="pt-3 pb-1">
                      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{cap}</span>
                    </td>
                  </tr>
                  {entries.map((m) => (
                    <tr key={`${m.provider}/${m.capability}/${m.operation}`} className="align-middle hover:bg-accent/30">
                      <td className="py-2 pr-3 font-mono text-xs">{m.operation}</td>
                      <td className="py-2 pr-3 font-mono text-[11px] text-muted-foreground">{m.provider}</td>
                      <td className="py-2 pr-3">
                        <ChargeCell entry={m} />
                        {m.rule && !m.rule.active ? (
                          <span className="ml-2 text-[10px] text-muted-foreground">rule disabled</span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3">
                        <SourcePill source={m.effective.source} />
                      </td>
                      <td className="py-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => onPick(m)} className="gap-1.5 px-2.5">
                          {m.rule?.active ? <PencilLine className="size-3.5" /> : <Plus className="size-3.5" />}
                          {m.rule?.active ? "Adjust" : "Price"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ─── Bulk apply ──────────────────────────────────────────────────────────── */

function BulkSection({
  matrix,
  onApplied,
}: {
  matrix: PricingMatrixEntry[]
  onApplied: () => void
}) {
  const [capabilities, setCapabilities] = useState<string[]>([])
  const [skipPriced, setSkipPriced] = useState(true)
  const [draftMode, setDraftMode] = useState<PricingMode>("fixed_per_request")
  const [draftCredits, setDraftCredits] = useState("5")
  const [draftIn, setDraftIn] = useState("2")
  const [draftOut, setDraftOut] = useState("8")
  const [rows, setRows] = useState<Record<string, BulkRow>>({})
  const [rejections, setRejections] = useState<Record<string, string>>({})
  const [applying, setApplying] = useState(false)

  const wired = useMemo(() => matrix.filter((m) => m.provider !== null), [matrix])
  const providersByCapability = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of wired) if (!map.has(m.capability)) map.set(m.capability, m.provider as string)
    return map
  }, [wired])

  const visible = useMemo(() => wired.filter((m) => capabilities.includes(m.capability)), [wired, capabilities])

  // Rows derive from the server matrix, so edits survive re-selection and
  // dropping a capability drops its rows.
  useEffect(() => {
    setRows((prev) => {
      const next: Record<string, BulkRow> = {}
      for (const m of visible) {
        const key = `${m.provider}/${m.capability}/${m.operation}`
        if (prev[key]) {
          next[key] = prev[key]
          continue
        }
        const active = m.rule?.active ? m.rule : null
        const isFixed = (active?.mode ?? m.suggestedMode) === "fixed_per_request"
        next[key] = {
          key,
          provider: m.provider as string,
          capability: m.capability,
          operation: m.operation,
          mode: active?.mode ?? m.suggestedMode,
          lockedMode: active?.mode ?? null,
          credits: isFixed ? String(active?.credits ?? m.effective.credits ?? draftCredits) : "",
          inputPer1k: isFixed ? "" : String(active?.inputPer1k ?? m.effective.inputPer1k ?? draftIn),
          outputPer1k: isFixed ? "" : String(active?.outputPer1k ?? m.effective.outputPer1k ?? draftOut),
          checked: active ? !skipPriced : true,
        }
      }
      return next
    })
    // draft*/skipPriced only seed NEW rows; re-running on their change would
    // reset rows the admin is editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.map((r) => `${r.capability}/${r.operation}`).join("|"), skipPriced])

  const selected = Object.values(rows).filter((r) => r.checked)
  const invalidSelected = selected.filter((r) => {
    const whole = (v: string) => v.trim() !== "" && Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= MAX_RATE
    return r.mode === "fixed_per_request"
      ? !whole(r.credits)
      : !whole(r.inputPer1k) || !whole(r.outputPer1k)
  })

  function toggleCapability(id: string) {
    setCapabilities((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
  }

  function stampDraft() {
    setRows((prev) => {
      const next = { ...prev }
      for (const row of Object.values(next)) {
        if (!row.checked) continue
        const mode = row.lockedMode ?? draftMode
        next[row.key] = {
          ...row,
          mode,
          credits: mode === "fixed_per_request" ? draftCredits || "0" : "",
          inputPer1k: mode === "per_1k_tokens" ? draftIn || "0" : "",
          outputPer1k: mode === "per_1k_tokens" ? draftOut || "0" : "",
        }
      }
      return next
    })
  }

  function setAllChecked(checked: boolean) {
    setRows((prev) => Object.fromEntries(Object.entries(prev).map(([k, r]) => [k, { ...r, checked }])))
  }

  async function apply() {
    if (selected.length === 0 || invalidSelected.length > 0 || applying) return
    setApplying(true)
    try {
      const result = await postJson<BulkResult>("/api/admin/runtime/pricing/bulk", {
        rules: selected.map((r) => ({
          provider: r.provider,
          capability: r.capability,
          operation: r.operation,
          mode: r.mode,
          ...(r.mode === "fixed_per_request"
            ? { credits: Number(r.credits) }
            : { inputPer1k: Number(r.inputPer1k), outputPer1k: Number(r.outputPer1k) }),
        })),
      })
      const nextRejections: Record<string, string> = {}
      for (const row of result.rows) {
        if (row.outcome !== "rejected" || !row.error) continue
        // The server echoes the triple that row keys are built from.
        nextRejections[`${row.provider}/${row.capability}/${row.operation}`] = row.error
      }
      setRejections(nextRejections)
      if (result.rejected > 0) {
        const first = result.rows.find((row) => row.outcome === "rejected")
        toast.error(`${result.rejected} row${result.rejected === 1 ? "" : "s"} rejected — ${first?.error ?? "see the row errors"}`)
      } else {
        toast.success(`Applied ${result.created + result.updated} rule${result.created + result.updated === 1 ? "" : "s"} · ${result.created} created, ${result.updated} updated, ${result.unchanged} already set.`)
      }
      onApplied()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not apply the bulk pricing.")
    } finally {
      setApplying(false)
    }
  }

  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-4 py-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Capabilities</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[...new Set(wired.map((m) => m.capability))].map((id) => {
              const active = capabilities.includes(id)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleCapability(id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors",
                    active ? "border-primary/40 bg-primary/10 text-foreground" : "border-border bg-muted/30 text-muted-foreground hover:border-primary/30 hover:text-foreground",
                  )}
                >
                  {active ? <CheckCircle2 className="size-3 text-primary" /> : <Plus className="size-3" />}
                  <span className="font-mono">{id}</span>
                  <span className="text-[10px] text-muted-foreground">{providersByCapability.get(id)}</span>
                </button>
              )
            })}
            {wired.length === 0 ? <p className="text-xs text-muted-foreground">No wired capability to bulk-price yet.</p> : null}
          </div>
        </div>

        {capabilities.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
            Choose one or more capabilities. Each operation appears with its provider and current charge pre-filled —
            stamp one rate across the batch, or override individual rows.
          </p>
        ) : (
          <>
            <div className="grid gap-3 rounded-xl border border-border bg-muted/30 p-3 sm:grid-cols-[auto_auto_1fr] sm:items-end">
              <label className="grid gap-1">
                <span className="text-[11px] text-muted-foreground">Draft mode</span>
                <select value={draftMode} onChange={(e) => setDraftMode(e.target.value as PricingMode)} className={cn(fieldClass, "h-8 w-full sm:w-56")}>
                  <option value="fixed_per_request">Fixed — credits per request</option>
                  <option value="per_1k_tokens">Usage — credits per 1k tokens</option>
                </select>
              </label>
              {draftMode === "fixed_per_request" ? (
                <label className="grid gap-1">
                  <span className="text-[11px] text-muted-foreground">Credits / request</span>
                  <input type="number" min={0} max={MAX_RATE} step={1} value={draftCredits} onChange={(e) => setDraftCredits(e.target.value)} className={cn(fieldClass, "h-8 w-28 font-mono tabular-nums")} />
                </label>
              ) : (
                <div className="flex gap-2">
                  <label className="grid gap-1">
                    <span className="text-[11px] text-muted-foreground">Per 1k in</span>
                    <input type="number" min={0} max={MAX_RATE} step={1} value={draftIn} onChange={(e) => setDraftIn(e.target.value)} className={cn(fieldClass, "h-8 w-20 font-mono tabular-nums")} />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-[11px] text-muted-foreground">Per 1k out</span>
                    <input type="number" min={0} max={MAX_RATE} step={1} value={draftOut} onChange={(e) => setDraftOut(e.target.value)} className={cn(fieldClass, "h-8 w-20 font-mono tabular-nums")} />
                  </label>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm" variant="outline" onClick={stampDraft} className="gap-1.5">
                  <Zap className="size-3.5" />
                  Stamp onto checked
                </Button>
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <input type="checkbox" checked={skipPriced} onChange={(e) => setSkipPriced(e.target.checked)} className="size-3.5 accent-primary" />
                  Leave already-priced rows off
                </label>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-left">
                    <th className="w-9 py-2 pl-3">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="py-2 font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground">Operation</th>
                    <th className="py-2 font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground">Provider</th>
                    <th className="py-2 font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground">Today</th>
                    <th className="py-2 pr-3 font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground">New charge</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((m) => {
                    const key = `${m.provider}/${m.capability}/${m.operation}`
                    const row = rows[key]
                    if (!row) return null
                    const error = rejections[key]
                    return (
                      <tr key={key} className={cn("border-b border-border/60 align-top last:border-0", row.checked && "bg-accent/20")}>
                        <td className="py-2.5 pl-3">
                          <input
                            type="checkbox"
                            aria-label={`Include ${m.capability}/${m.operation}`}
                            checked={row.checked}
                            onChange={(e) => setRows((prev) => ({ ...prev, [key]: { ...row, checked: e.target.checked } }))}
                            className="size-3.5 accent-primary"
                          />
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="font-mono text-xs">{m.capability}/{m.operation}</span>
                          {row.lockedMode ? (
                            <span className="mt-0.5 block text-[10px] text-muted-foreground">mode locked ({row.lockedMode})</span>
                          ) : null}
                          {error ? <span className="mt-0.5 block text-[10px] text-destructive">{error}</span> : null}
                        </td>
                        <td className="py-2.5 pr-3 font-mono text-[11px] text-muted-foreground">{row.provider}</td>
                        <td className="py-2.5 pr-3">
                          <SourcePill source={m.effective.source} />
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {row.mode === "fixed_per_request" ? (
                              <input
                                type="number" min={0} max={MAX_RATE} step={1}
                                aria-label={`Credits for ${m.capability}/${m.operation}`}
                                value={row.credits}
                                onChange={(e) => setRows((prev) => ({ ...prev, [key]: { ...row, credits: e.target.value } }))}
                                className={cn(rateClass, "h-8 w-20")}
                              />
                            ) : (
                              <>
                                <input
                                  type="number" min={0} max={MAX_RATE} step={1}
                                  aria-label={`Credits per 1k input for ${m.capability}/${m.operation}`}
                                  value={row.inputPer1k}
                                  onChange={(e) => setRows((prev) => ({ ...prev, [key]: { ...row, inputPer1k: e.target.value } }))}
                                  className={cn(rateClass, "h-8 w-[4.5rem]")}
                                />
                                <span className="text-[10px] text-muted-foreground">in</span>
                                <input
                                  type="number" min={0} max={MAX_RATE} step={1}
                                  aria-label={`Credits per 1k output for ${m.capability}/${m.operation}`}
                                  value={row.outputPer1k}
                                  onChange={(e) => setRows((prev) => ({ ...prev, [key]: { ...row, outputPer1k: e.target.value } }))}
                                  className={cn(rateClass, "h-8 w-[4.5rem]")}
                                />
                                <span className="text-[10px] text-muted-foreground">out</span>
                              </>
                            )}
                            {!row.lockedMode ? (
                              <select
                                aria-label={`Mode for ${m.capability}/${m.operation}`}
                                value={row.mode}
                                onChange={(e) => setRows((prev) => ({ ...prev, [key]: { ...row, mode: e.target.value as PricingMode } }))}
                                className={cn(fieldClass, "h-8 w-36 text-xs")}
                              >
                                <option value="fixed_per_request">fixed / request</option>
                                <option value="per_1k_tokens">per 1k tokens</option>
                              </select>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={apply} disabled={selected.length === 0 || invalidSelected.length > 0 || applying} className="gap-1.5">
                {applying ? <Loader2 className="size-3.5 animate-spin" /> : <Layers className="size-3.5" />}
                Apply {selected.length} rule{selected.length === 1 ? "" : "s"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAllChecked(true)} disabled={selected.length === Object.keys(rows).length}>
                Select all
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAllChecked(false)} disabled={selected.length === 0}>
                Clear
              </Button>
              <p className="text-[11px] text-muted-foreground">
                {invalidSelected.length > 0
                  ? `${invalidSelected.length} selected row${invalidSelected.length === 1 ? "" : "s"} need a valid whole-number rate.`
                  : "One atomic write per batch. Rates on active rules update in place; a mode change needs the rule disabled first."}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/* ─── Active rules ────────────────────────────────────────────────────────── */

function RulesSection({
  rules,
  busyRuleId,
  onToggle,
}: {
  rules: PricingRule[]
  busyRuleId: string | null
  onToggle: (rule: PricingRule) => void
}) {
  if (rules.length === 0) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="py-12 text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary/10">
            <Route className="size-5 text-primary" />
          </div>
          <p className="mt-3 text-sm font-medium">No pricing rules yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Every operation currently falls back to the built-in default pricing. Add a rule — or bulk-price a whole
            capability — to set your own rates.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl">
      <CardContent className="py-2">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-3 pl-3 font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground">Provider</th>
                <th className="py-3 font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground">Capability</th>
                <th className="py-3 font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground">Operation</th>
                <th className="py-3 font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground">Charge</th>
                <th className="py-3 font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground">Status</th>
                <th className="py-3 font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground">Updated</th>
                <th className="py-3 pr-3 text-right font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-border/60 last:border-0 hover:bg-accent/30">
                  <td className="py-3 pl-3 font-mono text-xs">{rule.provider}</td>
                  <td className="py-3 font-mono text-xs">{rule.capability}</td>
                  <td className="py-3 font-mono text-xs">{rule.operation}</td>
                  <td className="py-3 font-mono text-xs tabular-nums text-foreground">
                    {rateLabel(rule.mode, rule.credits, rule.inputPer1k, rule.outputPer1k)}
                    {rule.mode === "fixed_per_request" && rule.credits === 0 ? (
                      <span className="ml-1.5 font-sans text-[10px] text-muted-foreground">free</span>
                    ) : null}
                  </td>
                  <td className="py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        rule.active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      {rule.active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="py-3 text-xs text-muted-foreground">{formatStamp(rule.updatedAt)}</td>
                  <td className="py-3 pr-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={busyRuleId === rule.id}
                      onClick={() => onToggle(rule)}
                    >
                      {busyRuleId === rule.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : rule.active ? (
                        "Disable"
                      ) : (
                        <>
                          <Zap className="size-3.5" /> Enable
                        </>
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
  )
}

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default function AdminRuntimePricingPage() {
  const { data: config, error, isLoading, mutate } = useSWR<PricingConfig>(
    "/api/admin/runtime/pricing",
    jsonFetcher,
    { refreshInterval: 60000 },
  )
  const [busyRuleId, setBusyRuleId] = useState<string | null>(null)
  const [preset, setPreset] = useState<{ capability: string; operation: string } | null>(null)

  async function toggleRule(rule: PricingRule) {
    setBusyRuleId(rule.id)
    try {
      await patchJson(`/api/admin/runtime/pricing/${rule.id}`, { active: !rule.active })
      toast.success(rule.active ? "Rule disabled — future requests fall back to default pricing." : "Rule enabled.")
      mutate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the rule.")
    } finally {
      setBusyRuleId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-3 h-7 w-64" />
        <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="mt-8 h-64 rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <AlertTriangle className="mx-auto size-8 text-destructive" />
        <h2 className="mt-4 text-lg font-semibold">Runtime pricing is unavailable.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Either your session expired or this account isn&apos;t an admin. Nothing was changed.
        </p>
        <Button variant="outline" className="mt-4 gap-1.5" onClick={() => void mutate()}>
          <RefreshCw className="size-3.5" /> Try again
        </Button>
      </div>
    )
  }

  const rules = config?.rules ?? []
  const matrix = config?.matrix ?? []
  const wired = matrix.filter((m) => m.provider !== null)
  const byRule = wired.filter((m) => m.effective.source === "rule")
  const byDefault = wired.filter((m) => m.effective.source === "legacy")
  const denied = wired.filter((m) => m.effective.source === "unconfigured")

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Operate · Runtime</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">What each runtime operation costs.</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Rates apply to future requests the moment they&apos;re saved — no deploy. Provider, capability and operation
            are resolved from the live runtime registry, so pricing here always matches what billing actually does.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <Button size="sm" onClick={() => setPreset({ capability: "", operation: "" })} className="gap-1.5">
            <Plus className="size-3.5" />
            New rule
          </Button>
          <Button variant="outline" size="sm" onClick={() => void mutate()} className="gap-1.5">
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </div>
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Wired operations" value={wired.length} hint="Routed by a registered provider adapter" />
        <StatCard label="Priced by rule" value={byRule.length} tone="primary" hint="Admin-managed provider rates" />
        <StatCard label="On default pricing" value={byDefault.length} hint="Built-in fallback rates" />
        <StatCard label="Denied" value={denied.length} tone="destructive" hint="No price yet — requests are refused" />
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 px-3.5 py-3">
        <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Resolution: <span className="font-mono">{config?.resolution ?? "active rule → default pricing → deny"}</span>.
          An operation with no rule and no default is <strong className="text-foreground">denied</strong>, never silently
          free. Every charge snapshots its resolved pricing onto the usage record, so edits never rewrite history;
          disabled rules stay for audit and can be re-enabled.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[9rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <SectionRail />
          </div>
        </aside>

        <div className="min-w-0 space-y-10">
          <section>
            <SectionHeading
              id="pricing-coverage"
              eyebrow="Reference"
              title="Operation coverage"
              description="Every routed operation with the price billing resolves right now. Price a gap or adjust an existing rule in one click."
              icon={Coins}
              aside={
                <Badge variant="outline" className="self-start gap-1 text-[11px]">
                  <Shield className="size-3" />
                  {config?.pricingVersion ?? "—"}
                </Badge>
              }
            />
            {matrix.length > 0 ? (
              <CoverageSection matrix={matrix} onPick={(m) => setPreset({ capability: m.capability, operation: m.operation })} />
            ) : (
              <p className="text-xs text-muted-foreground">The server did not report operation coverage, so per-operation pricing is unavailable.</p>
            )}
          </section>

          <section>
            <SectionHeading
              id="pricing-bulk"
              eyebrow="Batch"
              title="Bulk apply"
              description="Set rates across a whole capability in one action. Rows arrive pre-resolved — no provider hunting."
              icon={Layers}
            />
            <BulkSection matrix={matrix} onApplied={() => void mutate()} />
          </section>

          <section>
            <SectionHeading
              id="pricing-rules"
              eyebrow="Configuration"
              title={`Active rules (${rules.length})`}
              description="Admin-managed rules, newest edits included. Disabling a rule falls that operation back to default pricing."
              icon={Route}
            />
            <RulesSection rules={rules} busyRuleId={busyRuleId} onToggle={toggleRule} />
          </section>
        </div>
      </div>

      <PriceDialog
        matrix={matrix}
        initial={preset}
        onOpenChange={(open) => !open && setPreset(null)}
        onSaved={() => void mutate()}
      />
    </div>
  )
}
