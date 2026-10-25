"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Copy, Loader2, Search, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { REFINEMENT_ACTIONS, REFINEMENT_LABELS, REFINEMENT_NEEDS, type RefinementAction } from "@/lib/marketing/studio/refinement-options"
import type { ContentItemView } from "@/lib/marketing/studio/present"

/**
 * Content library (Phase 4 v2).
 *
 * Real persisted drafts: bounded search/filter with "load more", rename,
 * status, planning date, duplicate, delete, versioned body edits, AI refinement
 * proposals and variations. Nothing is published: status stops at
 * "ready_for_review" and `plannedAt` is a plan only.
 */

const KINDS = ["copy", "email", "social", "timeline", "blog", "brief", "image", "voice", "video"] as const

function toLocalInput(ms: number | undefined): string {
  if (!ms) return ""
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInput(value: string): number | null {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

export function StudioLibrary({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [items, setItems] = useState<ContentItemView[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [query, setQuery] = useState("")
  const [kind, setKind] = useState("")
  const [status, setStatus] = useState("")
  const [planned, setPlanned] = useState("")
  const [selected, setSelected] = useState<ContentItemView | null>(null)
  const [draftBody, setDraftBody] = useState("")
  const [busy, setBusy] = useState(false)
  const [refineAction, setRefineAction] = useState<RefinementAction>("improve")
  const [refineExtra, setRefineExtra] = useState("")
  const [proposal, setProposal] = useState<string | null>(null)
  const [variants, setVariants] = useState<Array<{ title: string; body: string }>>([])

  const load = useCallback(
    async (cursorValue?: string) => {
      const params = new URLSearchParams()
      if (query.trim()) params.set("q", query.trim())
      if (kind) params.set("kind", kind)
      if (status) params.set("status", status)
      if (planned) params.set("planned", planned)
      if (cursorValue) params.set("cursor", cursorValue)

      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/studio/library?${params}`)
      const json = await response.json()
      if (!response.ok || !json.ok) throw new Error(json?.error?.message ?? "Couldn't load the library.")
      return json.data as { items: ContentItemView[]; nextCursor: string | null }
    },
    [projectId, query, kind, status, planned],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    load()
      .then((data) => {
        if (cancelled) return
        setItems(data.items)
        setCursor(data.nextCursor)
      })
      .catch((e) => !cancelled && toast.error(e instanceof Error ? e.message : "Couldn't load the library."))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [load])

  async function loadMore() {
    if (!cursor) return
    setLoadingMore(true)
    try {
      const data = await load(cursor)
      setItems((prev) => [...prev, ...data.items])
      setCursor(data.nextCursor)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load more.")
    } finally {
      setLoadingMore(false)
    }
  }

  function open(item: ContentItemView) {
    setSelected(item)
    setDraftBody(item.body)
    setProposal(null)
    setVariants([])
  }

  function replaceItem(updated: ContentItemView) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
    if (selected?.id === updated.id) {
      setSelected(updated)
      setDraftBody(updated.body)
    }
  }

  async function patchItem(id: string, body: Record<string, unknown>): Promise<ContentItemView | null> {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/studio/library/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    const json = await response.json()
    if (!response.ok || !json.ok) {
      toast.error(json?.error?.message ?? "Couldn't save that change.")
      return null
    }
    return json.data.item as ContentItemView
  }

  async function saveBody() {
    if (!selected) return
    setBusy(true)
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/content-studio`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentId: selected.id, body: draftBody }),
      })
      const json = await response.json()
      if (!response.ok || !json.ok) {
        toast.error(json?.error?.message ?? "Couldn't save the edit.")
        return
      }
      const saved = json.data as ContentItemView
      setItems((prev) => [saved, ...prev.filter((i) => i.id !== saved.id)])
      setSelected(saved)
      setDraftBody(saved.body)
      setProposal(null)
      toast.success(`Saved as version ${saved.version}. The previous version is kept.`)
      router.refresh()
    } catch {
      toast.error("Couldn't save the edit.")
    } finally {
      setBusy(false)
    }
  }

  async function duplicate() {
    if (!selected) return
    setBusy(true)
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/studio/library/${encodeURIComponent(selected.id)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "duplicate" }),
      })
      const json = await response.json()
      if (!response.ok || !json.ok) {
        toast.error(json?.error?.message ?? "Couldn't duplicate the draft.")
        return
      }
      setItems((prev) => [json.data.item as ContentItemView, ...prev])
      toast.success("Duplicated as a new draft.")
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!selected) return
    if (!window.confirm(`Delete “${selected.title}”? This cannot be undone.`)) return
    setBusy(true)
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/studio/library/${encodeURIComponent(selected.id)}`, {
        method: "DELETE",
      })
      const json = await response.json()
      if (!response.ok || !json.ok) {
        toast.error(json?.error?.message ?? "Couldn't delete the draft.")
        return
      }
      setItems((prev) => prev.filter((i) => i.id !== selected.id))
      setSelected(null)
      toast.success("Draft deleted.")
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function refine() {
    if (!selected) return
    setBusy(true)
    setProposal(null)
    try {
      const needs = REFINEMENT_NEEDS[refineAction]
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/studio/refine`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contentId: selected.id,
          action: refineAction,
          ...(needs && refineExtra.trim() ? { [needs]: refineExtra.trim() } : {}),
        }),
      })
      const json = await response.json()
      if (!response.ok || !json.ok) {
        const code = json?.error?.code
        toast.error(code === "INSUFFICIENT_CREDITS" ? "Not enough credits for this rewrite." : (json?.error?.message ?? "Couldn't rewrite the draft."))
        return
      }
      setProposal(json.data.body as string)
      toast.success("Rewrite ready. Review it before applying.")
    } catch {
      toast.error("Couldn't rewrite the draft.")
    } finally {
      setBusy(false)
    }
  }

  async function variations() {
    if (!selected) return
    setBusy(true)
    setVariants([])
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/studio/variations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentId: selected.id, count: 3 }),
      })
      const json = await response.json()
      if (!response.ok || !json.ok) {
        toast.error(json?.error?.message ?? "Couldn't generate alternatives.")
        return
      }
      setVariants(json.data.variants as Array<{ title: string; body: string }>)
    } catch {
      toast.error("Couldn't generate alternatives.")
    } finally {
      setBusy(false)
    }
  }

  async function saveVariant(variant: { title: string; body: string }) {
    if (!selected) return
    setBusy(true)
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/studio/library/${encodeURIComponent(selected.id)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "save_variant", title: variant.title, body: variant.body }),
      })
      const json = await response.json()
      if (!response.ok || !json.ok) {
        toast.error(json?.error?.message ?? "Couldn't save the variation.")
        return
      }
      setItems((prev) => [json.data.item as ContentItemView, ...prev])
      toast.success("Variation saved as its own draft.")
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section aria-labelledby="library-heading" className="flex min-w-0 flex-col gap-3">
        <h2 id="library-heading" className="text-lg font-semibold tracking-tight">
          Content library
        </h2>

        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setLoading(true)
            load()
              .then((data) => {
                setItems(data.items)
                setCursor(data.nextCursor)
              })
              .catch(() => toast.error("Couldn't search the library."))
              .finally(() => setLoading(false))
          }}
        >
          <label className="sr-only" htmlFor="library-query">
            Search drafts
          </label>
          <input
            id="library-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or content"
            className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" variant="outline" size="sm">
            <Search className="mr-1 h-4 w-4" aria-hidden /> Search
          </Button>
        </form>

        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="library-kind">
            Filter by type
          </label>
          <select
            id="library-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="rounded-xl border border-border bg-card px-2 py-1.5 text-sm"
          >
            <option value="">All types</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="library-status">
            Filter by status
          </label>
          <select
            id="library-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-border bg-card px-2 py-1.5 text-sm"
          >
            <option value="">Any status</option>
            <option value="draft">Draft</option>
            <option value="ready_for_review">Ready for review</option>
          </select>
          <label className="sr-only" htmlFor="library-planned">
            Filter by planning
          </label>
          <select
            id="library-planned"
            value={planned}
            onChange={(e) => setPlanned(e.target.value)}
            className="rounded-xl border border-border bg-card px-2 py-1.5 text-sm"
          >
            <option value="">Planned or not</option>
            <option value="planned">Planned</option>
            <option value="unplanned">Not planned</option>
          </select>
        </div>

        {loading ? (
          <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground" role="status">
            Loading drafts…
          </p>
        ) : items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            No drafts match yet. Create one in the Create tab.
          </p>
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => open(item)}
                    aria-current={selected?.id === item.id ? "true" : undefined}
                    className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{item.title}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{item.kind}</span>
                      {item.status === "ready_for_review" ? (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                          ready for review
                        </span>
                      ) : null}
                      {item.plannedAt ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">planned</span>
                      ) : null}
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{item.body.slice(0, 160)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {cursor ? (
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore} className="self-start">
                {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                Load more
              </Button>
            ) : null}
          </>
        )}
      </section>

      <section aria-labelledby="library-detail-heading" className="flex min-w-0 flex-col gap-3">
        <h2 id="library-detail-heading" className="text-lg font-semibold tracking-tight">
          {selected ? "Edit draft" : "Select a draft"}
        </h2>

        {!selected ? (
          <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Choose a draft to edit, refine, or plan.
          </p>
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                v{selected.version} · {selected.kind} · AI draft, not published
              </span>
            </div>

            <label className="text-sm font-medium" htmlFor="draft-title">
              Title
            </label>
            <input
              id="draft-title"
              defaultValue={selected.title}
              key={`${selected.id}-title`}
              onBlur={async (e) => {
                const title = e.target.value.trim()
                if (!title || title === selected.title) return
                const updated = await patchItem(selected.id, { title })
                if (updated) {
                  replaceItem(updated)
                  toast.success("Title saved.")
                }
              }}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />

            <label className="text-sm font-medium" htmlFor="draft-body">
              Content
            </label>
            <textarea
              id="draft-body"
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              rows={12}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-[13px] leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={saveBody} disabled={busy || draftBody === selected.body}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                Save as new version
              </Button>
              <Button variant="outline" size="sm" onClick={duplicate} disabled={busy}>
                <Copy className="mr-1 h-4 w-4" aria-hidden /> Duplicate
              </Button>
              <Button variant="outline" size="sm" onClick={remove} disabled={busy}>
                <Trash2 className="mr-1 h-4 w-4" aria-hidden /> Delete
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Saving keeps the previous version — nothing you already approved is overwritten.
            </p>

            <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="draft-status">
                  Status
                </label>
                <select
                  id="draft-status"
                  value={selected.status}
                  onChange={async (e) => {
                    const updated = await patchItem(selected.id, { status: e.target.value })
                    if (updated) replaceItem(updated)
                  }}
                  className="w-full rounded-xl border border-border bg-background px-2 py-1.5 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="ready_for_review">Ready for review</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="draft-planned">
                  Planned date (a plan, not a publish)
                </label>
                <input
                  id="draft-planned"
                  type="datetime-local"
                  defaultValue={toLocalInput(selected.plannedAt)}
                  key={`${selected.id}-plan`}
                  onChange={async (e) => {
                    const ms = fromLocalInput(e.target.value)
                    const updated = await patchItem(selected.id, { plannedAt: ms })
                    if (updated) {
                      replaceItem(updated)
                      router.refresh()
                    }
                  }}
                  className="w-full rounded-xl border border-border bg-background px-2 py-1.5 text-sm"
                />
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold">
                <Sparkles className="h-4 w-4" aria-hidden /> Refine with AI
              </h3>
              <div className="flex flex-wrap gap-2">
                <label className="sr-only" htmlFor="refine-action">
                  Refinement
                </label>
                <select
                  id="refine-action"
                  value={refineAction}
                  onChange={(e) => {
                    setRefineAction(e.target.value as RefinementAction)
                    setRefineExtra("")
                  }}
                  className="rounded-xl border border-border bg-background px-2 py-1.5 text-sm"
                >
                  {REFINEMENT_ACTIONS.map((action) => (
                    <option key={action} value={action}>
                      {REFINEMENT_LABELS[action]}
                    </option>
                  ))}
                </select>
                {REFINEMENT_NEEDS[refineAction] ? (
                  <>
                    <label className="sr-only" htmlFor="refine-extra">
                      {REFINEMENT_NEEDS[refineAction]}
                    </label>
                    <input
                      id="refine-extra"
                      value={refineExtra}
                      onChange={(e) => setRefineExtra(e.target.value)}
                      placeholder={REFINEMENT_NEEDS[refineAction] === "audience" ? "Audience" : "Channel, e.g. LinkedIn"}
                      className="min-w-0 flex-1 rounded-xl border border-border bg-background px-2 py-1.5 text-sm"
                    />
                  </>
                ) : null}
                <Button size="sm" onClick={refine} disabled={busy}>
                  Rewrite
                </Button>
                <Button size="sm" variant="outline" onClick={variations} disabled={busy}>
                  Give me alternatives
                </Button>
              </div>

              {proposal ? (
                <div className="mt-3 rounded-xl border border-border bg-background p-3">
                  <h4 className="text-sm font-semibold">Proposed rewrite</h4>
                  <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap text-[13px] leading-6">{proposal}</pre>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setDraftBody(proposal)
                        setProposal(null)
                        toast.success("Applied to the editor. Save to keep it as a new version.")
                      }}
                    >
                      Use this
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setProposal(null)}>
                      Discard
                    </Button>
                  </div>
                </div>
              ) : null}

              {variants.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-2">
                  {variants.map((variant, i) => (
                    <li key={`${variant.title}-${i}`} className="rounded-xl border border-border bg-background p-3">
                      <p className="text-sm font-semibold">{variant.title}</p>
                      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-[13px] leading-6">{variant.body}</pre>
                      <Button size="sm" variant="outline" className="mt-2" onClick={() => saveVariant(variant)} disabled={busy}>
                        Save as draft
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
