"use client"

import { useState } from "react"
import { Plus, X, Check, DollarSign, Sparkles, Zap } from "lucide-react"
import { CofounderMarkdown } from "@/components/cofounder/markdown"

export interface PricingTier {
  id: string
  name: string
  price: string
  interval: "month" | "year" | "one-time"
  description: string
  features: string[]
  highlighted?: boolean
  comingSoon?: boolean
}

interface PricingTierBuilderProps {
  value: string // JSON string or markdown
  onChange: (value: string) => void
  readonly?: boolean
}

const DEFAULT_TIERS: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    price: "0",
    interval: "month",
    description: "Perfect for trying out the platform",
    features: ["Basic features", "Community support", "Limited usage"],
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "29",
    interval: "month",
    description: "Everything you need to grow",
    features: ["All Free features", "Priority support", "Advanced analytics", "Unlimited usage"],
    highlighted: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    interval: "month",
    description: "For teams and organizations",
    features: ["All Pro features", "Dedicated support", "Custom integrations", "SLA guarantee"],
    highlighted: false,
  },
]

function normalizeTier(raw: Partial<PricingTier>, index: number): PricingTier {
  const interval =
    raw.interval === "year" || raw.interval === "one-time" || raw.interval === "month" ? raw.interval : "month"
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : `tier-${index}`,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : `Tier ${index + 1}`,
    price: typeof raw.price === "string" ? raw.price : typeof raw.price === "number" ? String(raw.price) : "0",
    interval,
    description: typeof raw.description === "string" ? raw.description : "",
    features: Array.isArray(raw.features) ? raw.features.filter((f): f is string => typeof f === "string") : [],
    highlighted: raw.highlighted === true,
    comingSoon: raw.comingSoon === true,
  }
}

/** Parse the markdown `serializeTiers` emits so opening the editor on a saved
 * section round-trips instead of resetting it to the default tiers. */
function parseMarkdownTiers(value: string): PricingTier[] {
  // The serializer always emits "## Tier" blocks with a **Price** line; both
  // markers must be present, otherwise this is free-form prose, not a tier
  // list, and the caller keeps it as text.
  if (!/\*\*Price\*\*:/i.test(value) || !/(?:^|\n)##\s+\S/.test(value)) return []
  const tiers: PricingTier[] = []
  for (const block of `\n${value}`.split(/\n##\s+/)) {
    if (!block.trim()) continue
    const newline = block.indexOf("\n")
    const name = (newline === -1 ? block : block.slice(0, newline)).trim()
    if (!name || name.startsWith("#")) continue
    const body = newline === -1 ? "" : block.slice(newline + 1)

    const priceLine = body.match(/\*\*Price\*\*:\s*(.+)/i)?.[1]?.trim() ?? ""
    let price = "0"
    let interval: PricingTier["interval"] = "month"
    if (/^\$?\s*custom$/i.test(priceLine)) {
      price = "Custom"
    } else {
      const match = priceLine.match(/\$?\s*([\d.,]+)\s*(?:\/\s*(month|year|one-time))?/i)
      if (match) {
        price = match[1]
        if (match[2] === "year" || match[2] === "one-time") interval = match[2]
      }
    }

    const description = body.match(/\*\*Description\*\*:\s*(.+)/i)?.[1]?.trim() ?? ""
    const features: string[] = []
    const featuresAt = body.search(/\*\*Features\*\*:/i)
    if (featuresAt !== -1) {
      for (const line of body.slice(featuresAt).split("\n").slice(1)) {
        if (/^\s*(?:\*\*|##|---)/.test(line)) break
        const feature = line.match(/^\s*-\s+(.+)$/)?.[1]?.trim()
        if (feature) features.push(feature)
      }
    }

    tiers.push({
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `tier-${tiers.length}`,
      name,
      price,
      interval,
      description,
      features,
      highlighted: /\*\*Recommended\*\*/i.test(body),
      comingSoon: /\*\*Status\*\*:\s*Coming soon/i.test(body),
    })
  }
  return tiers
}

function parseTiers(value: string): PricingTier[] {
  if (!value || value.trim().length === 0) return []
  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed)) {
      return parsed.map((tier, index) => normalizeTier((tier ?? {}) as Partial<PricingTier>, index))
    }
  } catch {
    // Not JSON — fall through to the markdown parser.
  }
  return parseMarkdownTiers(value)
}

function serializeTiers(tiers: PricingTier[]): string {
  // Generate markdown format for the AI builder
  let markdown = "# Pricing Tiers\n\n"

  tiers.forEach((tier, idx) => {
    markdown += `## ${tier.name}\n\n`
    markdown += `**Price**: ${tier.price === "Custom" ? "Custom" : `$${tier.price}/${tier.interval}`}\n\n`
    markdown += `**Description**: ${tier.description}\n\n`
    markdown += `**Features**:\n`
    tier.features.forEach(feature => {
      markdown += `- ${feature}\n`
    })
    if (tier.highlighted) {
      markdown += `\n**Recommended**: This is the recommended tier for most users.\n`
    }
    if (tier.comingSoon) {
      markdown += `\n**Status**: Coming soon\n`
    }
    if (idx < tiers.length - 1) markdown += `\n---\n\n`
  })

  return markdown
}

export function PricingTierBuilder({ value, onChange, readonly = false }: PricingTierBuilderProps) {
  const [initial] = useState(() => parseTiers(value))
  // Free-form text (an AI-drafted pricing section) isn't a tier list — editing
  // it as text preserves the founder's content instead of replacing it with
  // the default tiers.
  const rawMode = value.trim().length > 0 && initial.length === 0
  const [tiers, setTiers] = useState<PricingTier[]>(() => {
    return initial.length > 0 ? initial : DEFAULT_TIERS
  })
  const [editingId, setEditingId] = useState<string | null>(null)

  function updateTiers(newTiers: PricingTier[]) {
    setTiers(newTiers)
    onChange(serializeTiers(newTiers))
  }

  function addTier() {
    const newTier: PricingTier = {
      id: `tier-${Date.now()}`,
      name: "New Tier",
      price: "0",
      interval: "month",
      description: "Describe this tier",
      features: ["Feature 1"],
      highlighted: false,
    }
    updateTiers([...tiers, newTier])
    setEditingId(newTier.id)
  }

  function removeTier(id: string) {
    updateTiers(tiers.filter(t => t.id !== id))
  }

  function updateTier(id: string, updates: Partial<PricingTier>) {
    updateTiers(tiers.map(t => t.id === id ? { ...t, ...updates } : t))
  }

  function addFeature(tierId: string) {
    updateTiers(tiers.map(t => 
      t.id === tierId 
        ? { ...t, features: [...t.features, "New feature"] }
        : t
    ))
  }

  function removeFeature(tierId: string, featureIndex: number) {
    updateTiers(tiers.map(t => 
      t.id === tierId 
        ? { ...t, features: t.features.filter((_, i) => i !== featureIndex) }
        : t
    ))
  }

  function updateFeature(tierId: string, featureIndex: number, newValue: string) {
    updateTiers(tiers.map(t => 
      t.id === tierId 
        ? { ...t, features: t.features.map((f, i) => i === featureIndex ? newValue : f) }
        : t
    ))
  }

  if (rawMode) {
    if (readonly) {
      return (
        <div className="rounded-xl border border-border bg-card p-5 text-sm leading-6 text-foreground">
          <CofounderMarkdown>{value}</CofounderMarkdown>
        </div>
      )
    }
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          This section holds free-form pricing notes from your co-founder, so it&apos;s edited as text — nothing is
          reset to default tiers.
        </p>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={12}
          aria-label="Edit pricing section"
          className="collab-scroll max-h-[70dvh] w-full resize-y rounded-xl border border-primary/40 bg-background px-4 py-3 text-base leading-6 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 sm:max-h-none sm:text-sm"
        />
      </div>
    )
  }

  if (readonly) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiers.map(tier => (
          <div 
            key={tier.id}
            className={`rounded-xl border p-5 ${
              tier.highlighted 
                ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                : "border-border bg-card"
            }`}
          >
            {tier.highlighted && (
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Sparkles className="size-3.5" />
                Recommended
              </div>
            )}
            <h3 className="text-lg font-semibold text-foreground">{tier.name}</h3>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-foreground">
                {tier.price === "Custom" ? "Custom" : `$${tier.price}`}
              </span>
              {tier.price !== "Custom" && (
                <span className="text-sm text-muted-foreground">/{tier.interval}</span>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{tier.description}</p>
            <ul className="mt-4 space-y-2">
              {tier.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="size-4 shrink-0 text-primary mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            {tier.comingSoon && (
              <div className="mt-4 rounded-lg bg-muted px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                Coming Soon
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Build your pricing structure with a visual editor
        </p>
        <button
          onClick={addTier}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Plus className="size-3.5" />
          Add Tier
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiers.map(tier => {
          const isEditing = editingId === tier.id
          
          return (
            <div 
              key={tier.id}
              className={`rounded-xl border p-4 transition-all ${
                tier.highlighted 
                  ? "border-primary bg-primary/5" 
                  : "border-border bg-card"
              } ${isEditing ? "ring-2 ring-primary/40" : ""}`}
            >
              {/* Header controls */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <button
                  onClick={() => setEditingId(isEditing ? null : tier.id)}
                  className="flex-1 text-left"
                >
                  {isEditing ? (
                    <input
                      type="text"
                      value={tier.name}
                      onChange={(e) => updateTier(tier.id, { name: e.target.value })}
                      className="w-full rounded border border-primary/40 bg-background px-2 py-1 text-base font-semibold text-foreground"
                      placeholder="Tier name"
                      autoFocus
                    />
                  ) : (
                    <h3 className="text-base font-semibold text-foreground hover:text-primary">
                      {tier.name}
                    </h3>
                  )}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateTier(tier.id, { highlighted: !tier.highlighted })}
                    className={`rounded p-1 transition-colors ${
                      tier.highlighted 
                        ? "bg-primary text-primary-foreground" 
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                    title="Mark as recommended"
                  >
                    <Sparkles className="size-3.5" />
                  </button>
                  <button
                    onClick={() => removeTier(tier.id)}
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
                    title="Remove tier"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Price */}
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={tier.price}
                      onChange={(e) => updateTier(tier.id, { price: e.target.value })}
                      className="w-20 rounded border border-border bg-background px-2 py-1 text-xl font-bold text-foreground"
                      placeholder="0"
                    />
                    <span className="text-muted-foreground">/</span>
                    <select
                      value={tier.interval}
                      onChange={(e) => updateTier(tier.id, { interval: e.target.value as any })}
                      className="rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
                    >
                      <option value="month">month</option>
                      <option value="year">year</option>
                      <option value="one-time">one-time</option>
                    </select>
                  </>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-foreground">
                      {tier.price === "Custom" ? "Custom" : `$${tier.price}`}
                    </span>
                    {tier.price !== "Custom" && (
                      <span className="text-xs text-muted-foreground">/{tier.interval}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="mt-2">
                {isEditing ? (
                  <input
                    type="text"
                    value={tier.description}
                    onChange={(e) => updateTier(tier.id, { description: e.target.value })}
                    className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-muted-foreground"
                    placeholder="Tier description"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">{tier.description}</p>
                )}
              </div>

              {/* Features */}
              <ul className="mt-3 space-y-1.5">
                {tier.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="size-3.5 shrink-0 text-primary mt-0.5" />
                    {isEditing ? (
                      <div className="flex-1 flex items-center gap-1">
                        <input
                          type="text"
                          value={feature}
                          onChange={(e) => updateFeature(tier.id, i, e.target.value)}
                          className="flex-1 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground"
                          placeholder="Feature"
                        />
                        <button
                          onClick={() => removeFeature(tier.id, i)}
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-foreground">{feature}</span>
                    )}
                  </li>
                ))}
                {isEditing && (
                  <li>
                    <button
                      onClick={() => addFeature(tier.id)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="size-3" />
                      Add feature
                    </button>
                  </li>
                )}
              </ul>

              {/* Toggles */}
              {isEditing && (
                <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={tier.comingSoon ?? false}
                      onChange={(e) => updateTier(tier.id, { comingSoon: e.target.checked })}
                      className="rounded border-border"
                    />
                    <span className="text-muted-foreground">Coming Soon</span>
                  </label>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {tiers.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
          <DollarSign className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium text-foreground">No pricing tiers yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Add your first tier to get started</p>
          <button
            onClick={addTier}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="size-4" />
            Add Pricing Tier
          </button>
        </div>
      )}
    </div>
  )
}
