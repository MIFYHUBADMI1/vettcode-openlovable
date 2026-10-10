"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Sparkles, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Marketing Studio view (Phase 4 — W3). Client surface on the Studio route.
 *
 * Lists stored drafts and can generate one credit-charged draft (a fixed
 * template + optional brief) or save a hand-edited version, both through the
 * ownership-gated endpoint. Nothing here publishes or schedules — drafts are
 * saved only, and every item is labeled as an AI-generated draft derived from the
 * founder's own plan, never a measured result.
 */

export interface StudioItemView {
  id: string
  template: string
  title: string
  body: string
  version: number
  status: string
  origin: string
  creditsCharged: number
  model?: string
  updatedAt: number
}

export interface StudioState {
  enabled: boolean
  cost: number
  available: number
  items: StudioItemView[]
}

const TEMPLATES: Array<{ id: StudioItemView["template"]; label: string }> = [
  { id: "landing_hero", label: "Landing page hero" },
  { id: "feature_blurb", label: "Feature blurb" },
  { id: "email_welcome", label: "Welcome email" },
  { id: "ad_headline", label: "Ad headlines" },
]

export function StudioView({ projectId, state }: { projectId: string; state: StudioState }) {
  const router = useRouter()
  const [items, setItems] = useState<StudioItemView[]>(state.items)
  const [template, setTemplate] = useState<StudioItemView["template"]>("landing_hero")
  const [brief, setBrief] = useState("")
  const [generating, setGenerating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftBody, setDraftBody] = useState("")
  const [saving, setSaving] = useState(false)

  async function generate() {
    setGenerating(true)
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/content-studio`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ template, ...(brief.trim() ? { brief: brief.trim() } : {}) }),
      })
      const json = await response.json()
      if (!response.ok || !json.ok) {
        const code = json?.error?.code
        const msg = json?.error?.message ?? "The draft couldn't be generated."
        toast.error(code === "INSUFFICIENT_CREDITS" ? "Not enough credits for this draft." : msg)
        return
      }
      const d = json.data
      setItems((prev) => [
        { id: d.contentId, template: d.template, title: d.title, body: d.body, version: d.version, status: "draft", origin: "ai_generated_marketing_content", creditsCharged: d.creditsCharged ?? 0, model: d.model, updatedAt: Date.now() },
        ...prev,
      ])
      setBrief("")
      toast.success("Draft created — review and edit before using anywhere.")
      router.refresh()
    } catch {
      toast.error("The draft couldn't be generated. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  async function saveEdit(id: string) {
    setSaving(true)
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/content-studio`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentId: id, body: draftBody }),
      })
      const json = await response.json()
      if (!response.ok || !json.ok) {
        toast.error(json?.error?.message ?? "Couldn't save that edit.")
        return
      }
      const updated: StudioItemView = json.data
      setItems((prev) => [updated, ...prev])
      setEditingId(null)
      setDraftBody("")
      toast.success("Saved as a new version.")
    } catch {
      toast.error("Couldn't save that edit.")
    } finally {
      setSaving(false)
    }
  }

  if (!state.enabled) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Marketing Studio</h2>
        <p className="rounded-2xl border border-dashed border-border bg-transparent p-5 text-sm leading-6 text-muted-foreground">
          The Marketing Studio is not enabled for this account yet.
        </p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Sparkles className="h-5 w-5 text-primary" /> Marketing Studio
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Draft marketing copy in your own brand voice. Brand voice is derived from your plan
          (brand identity, value proposition, positioning, marketing plan, audience). Every output is a
          saved draft — nothing is published, and no draft claims a measured result.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplate(t.id)}
              className={
                "rounded-full border px-3 py-1 text-xs transition-colors " +
                (template === t.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Optional direction (e.g. highlight the free tier, friendly tone)…"
          className="min-h-[72px] w-full resize-y rounded-xl border border-border bg-transparent p-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{state.available} credits available</span>
          <Button size="sm" onClick={generate} disabled={generating}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generate draft {state.cost > 0 ? `· ${state.cost} credits` : ""}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Drafts ({items.length})</h3>
        {items.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-5 text-sm leading-6 text-muted-foreground">
            No drafts yet. Pick a template and generate one — it is saved here for you to review and edit.
          </p>
        ) : (
          items.map((it) => (
            <article key={it.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-medium">{it.title}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">v{it.version}</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">AI draft · not published</span>
                {it.model ? <span className="text-muted-foreground">· {it.model}</span> : null}
              </div>
              {editingId === it.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    className="min-h-[120px] w-full resize-y rounded-xl border border-border bg-transparent p-3 text-sm outline-none focus:border-primary"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(it.id)} disabled={saving || !draftBody.trim()}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save as new version
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setDraftBody("") }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-6">{it.body}</p>
              )}
              {editingId !== it.id ? (
                <div>
                  <Button size="sm" variant="outline" onClick={() => { setEditingId(it.id); setDraftBody(it.body) }}>Edit</Button>
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  )
}
