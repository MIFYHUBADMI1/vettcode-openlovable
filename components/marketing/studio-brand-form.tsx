"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { BrandProfileDoc } from "@/lib/types/db"

/**
 * Brand settings (Phase 4 v2). Preferences only — these are the founder's own
 * words, reused to ground every generation. Nothing here is measured, and
 * clearing a field genuinely removes it.
 */

interface BrandView {
  brandName?: string
  description?: string
  tone?: string
  audience?: string
  valueProposition?: string
  differentiators?: string[]
  vocabulary?: string[]
  avoid?: string[]
  callToAction?: string
}

const FIELDS = [
  { key: "brandName", label: "Brand name", placeholder: "How the product should be named in copy", multiline: false },
  { key: "description", label: "Short description", placeholder: "One or two sentences on what the business does", multiline: true },
  { key: "tone", label: "Preferred tone", placeholder: "e.g. warm, direct, expert — no hype", multiline: false },
  { key: "audience", label: "Audience", placeholder: "Who this is for", multiline: false },
  { key: "valueProposition", label: "Value proposition", placeholder: "The core promise, in the founder's words", multiline: true },
  { key: "callToAction", label: "Preferred call to action", placeholder: "e.g. Start free, Book a call", multiline: false },
] as const

export function StudioBrandForm({ projectId, initial }: { projectId: string; initial: BrandProfileDoc | null }) {
  const router = useRouter()
  const [form, setForm] = useState<BrandView>({
    brandName: initial?.brandName ?? "",
    description: initial?.description ?? "",
    tone: initial?.tone ?? "",
    audience: initial?.audience ?? "",
    valueProposition: initial?.valueProposition ?? "",
    callToAction: initial?.callToAction ?? "",
  })
  const [differentiators, setDifferentiators] = useState((initial?.differentiators ?? []).join(", "))
  const [vocabulary, setVocabulary] = useState((initial?.vocabulary ?? []).join(", "))
  const [avoid, setAvoid] = useState((initial?.avoid ?? []).join(", "))
  const [saving, setSaving] = useState(false)

  function splitList(value: string): string[] {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 12)
  }

  async function save() {
    setSaving(true)
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/studio/brand`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brandName: form.brandName || null,
          description: form.description || null,
          tone: form.tone || null,
          audience: form.audience || null,
          valueProposition: form.valueProposition || null,
          callToAction: form.callToAction || null,
          differentiators: splitList(differentiators),
          vocabulary: splitList(vocabulary),
          avoid: splitList(avoid),
        }),
      })
      const json = await response.json()
      if (!response.ok || !json.ok) {
        toast.error(json?.error?.message ?? "Couldn't save the brand profile.")
        return
      }
      toast.success("Brand settings saved. New drafts will use them.")
      router.refresh()
    } catch {
      toast.error("Couldn't save the brand profile.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="brand-settings-heading">
      <div>
        <h2 id="brand-settings-heading" className="text-lg font-semibold tracking-tight">
          Brand settings
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          These are your own preferences. Atai reuses them in every draft so you do not have to repeat yourself. They
          are instructions, not measured facts, and you can clear any field.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <div key={field.key} className={field.multiline ? "sm:col-span-2" : undefined}>
            <label htmlFor={`brand-${field.key}`} className="mb-1 block text-sm font-medium">
              {field.label}
            </label>
            {field.multiline ? (
              <textarea
                id={`brand-${field.key}`}
                value={form[field.key] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                rows={3}
                maxLength={1200}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            ) : (
              <input
                id={`brand-${field.key}`}
                value={form[field.key] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                maxLength={200}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            )}
          </div>
        ))}

        {[
          { label: "Differentiators", value: differentiators, set: setDifferentiators, hint: "Comma-separated" },
          { label: "Words to favour", value: vocabulary, set: setVocabulary, hint: "Comma-separated" },
          { label: "Words or claims to avoid", value: avoid, set: setAvoid, hint: "e.g. guaranteed, best in the world" },
        ].map((list) => (
          <div key={list.label}>
            <label htmlFor={`brand-list-${list.label}`} className="mb-1 block text-sm font-medium">
              {list.label}
            </label>
            <input
              id={`brand-list-${list.label}`}
              value={list.value}
              onChange={(e) => list.set(e.target.value)}
              placeholder={list.hint}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
          Save brand settings
        </Button>
        <span className="text-xs text-muted-foreground" role="status" aria-live="polite">
          {saving ? "Saving…" : ""}
        </span>
      </div>
    </section>
  )
}
