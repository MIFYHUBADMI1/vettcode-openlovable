"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Megaphone, Plus, Pause, Play, Check, X, Link2, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { buildTrackedUrl, channelToUtmMedium, slugify } from "@/lib/marketing/campaigns/utm"

/**
 * Campaigns panel (Phase 6 — W5). Client surface on the campaigns route.
 *
 * A PLAN-and-TRACK list the founder manages themselves. It creates campaign
 * plans (name/objective/channels) and moves them through draft → active →
 * paused → completed/cancelled — all through the ownership-gated, flag-gated
 * endpoint. Nothing here sends email, posts to social, spends any budget, or
 * runs on a timer: there is no job substrate, no consent layer for messaging,
 * and no platform approvals. The tracked-link tool is a PURE helper — it only
 * builds a copyable UTM URL from a link the founder pastes; it changes no
 * checkout and reports no measured result.
 */

export type CampaignStatus = "draft" | "active" | "paused" | "completed" | "cancelled"
export type CampaignChannel = "email" | "social" | "content" | "seo" | "referral" | "other"

export interface CampaignView {
  id: string
  name: string
  objective: string
  channels: CampaignChannel[]
  status: CampaignStatus
  plannedBudgetCents: number | null
  utmCampaign: string | null
  startDate: number | null
  endDate: number | null
  notes: string | null
  origin: "ai_generated" | "user_created"
  createdAt: number
  updatedAt: number
  pausedAt: number | null
  cancelledAt: number | null
}

export interface CampaignsState {
  enabled: boolean
  campaigns: CampaignView[]
}

const ALL_CHANNELS: CampaignChannel[] = ["email", "social", "content", "seo", "referral", "other"]

/** Mirror of the service transition machine, expressed as user-facing actions. */
const ACTIONS: Record<CampaignStatus, Array<{ to: CampaignStatus; label: string }>> = {
  draft: [
    { to: "active", label: "Start" },
    { to: "cancelled", label: "Cancel" },
  ],
  active: [
    { to: "paused", label: "Pause" },
    { to: "completed", label: "Complete" },
    { to: "cancelled", label: "Cancel" },
  ],
  paused: [
    { to: "active", label: "Resume" },
    { to: "completed", label: "Complete" },
    { to: "cancelled", label: "Cancel" },
  ],
  completed: [],
  cancelled: [],
}

function actionIcon(to: CampaignStatus) {
  switch (to) {
    case "active": return <Play className="mr-2 h-4 w-4" />
    case "paused": return <Pause className="mr-2 h-4 w-4" />
    case "completed": return <Check className="mr-2 h-4 w-4" />
    case "cancelled": return <X className="mr-2 h-4 w-4" />
    default: return null
  }
}

function formatMoney(cents: number | null): string | null {
  if (cents === null || !Number.isFinite(cents)) return null
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" })
}

export function CampaignsPanel({ projectId, state }: { projectId: string; state: CampaignsState }) {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<CampaignView[]>(state.campaigns)
  const [name, setName] = useState("")
  const [objective, setObjective] = useState("")
  const [channels, setChannels] = useState<CampaignChannel[]>([])
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const active = campaigns.filter((c) => c.status === "active" || c.status === "paused")
  const drafts = campaigns.filter((c) => c.status === "draft")
  const finished = campaigns.filter((c) => c.status === "completed" || c.status === "cancelled")

  function toggleChannel(ch: CampaignChannel) {
    setChannels((prev) => (prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]))
  }

  async function createCampaign() {
    const trimmed = name.trim()
    if (trimmed.length < 3) {
      toast.error("Give the campaign a short name (at least 3 characters).")
      return
    }
    setCreating(true)
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/campaigns`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          objective: objective.trim() || undefined,
          channels,
          utmCampaign: slugify(trimmed) || null,
          origin: "user_created",
        }),
      })
      const json = await response.json()
      if (!response.ok || !json.ok) {
        toast.error(json?.error?.message ?? "The campaign couldn't be added.")
        return
      }
      setCampaigns((prev) => [json.data as CampaignView, ...prev])
      setName("")
      setObjective("")
      setChannels([])
      toast.success("Campaign plan added as a draft.")
    } catch {
      toast.error("The campaign couldn't be added. Please try again.")
    } finally {
      setCreating(false)
    }
  }

  async function setStatus(campaign: CampaignView, status: CampaignStatus) {
    setBusyId(campaign.id)
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/campaigns`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.id, status }),
      })
      const json = await response.json()
      if (!response.ok || !json.ok) {
        toast.error(json?.error?.message ?? "That change didn't save.")
        return
      }
      const updated = json.data as CampaignView
      setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      router.refresh()
    } catch {
      toast.error("That change didn't save.")
    } finally {
      setBusyId(null)
    }
  }

  if (!state.enabled) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Campaigns</h2>
        <p className="rounded-2xl border border-dashed border-border bg-transparent p-5 text-sm leading-6 text-muted-foreground">
          Campaigns are not enabled for this account yet.
        </p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Megaphone className="h-5 w-5 text-primary" /> Campaigns
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Plan and track marketing campaigns for this project. A campaign records what you intend to do — Atai
          does not send email, post to social, spend any budget, or run anything on a schedule. The co-founder can
          also propose a campaign, which you approve before it lands.
        </p>
      </div>

      {/* Create row */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New campaign — e.g. Product hunt launch"
          className="w-full rounded-xl border border-border bg-transparent p-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
        />
        <input
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          placeholder="Objective (optional) — what you hope this achieves"
          className="w-full rounded-xl border border-border bg-transparent p-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
        />
        <div className="flex flex-wrap gap-1">
          {ALL_CHANNELS.map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => toggleChannel(ch)}
              className={
                "rounded-full border px-3 py-1 text-xs capitalize transition-colors " +
                (channels.includes(ch)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted")
              }
            >
              {ch}
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={createCampaign} disabled={creating || name.trim().length < 3}>
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Add campaign
          </Button>
        </div>
      </div>

      <Group title={`Running (${active.length})`} empty="No active or paused campaigns." items={active}
        busyId={busyId} onSetStatus={setStatus} />
      <Group title={`Drafts (${drafts.length})`} empty="No drafts. Add one above or ask your co-founder to propose a campaign."
        items={drafts} busyId={busyId} onSetStatus={setStatus} />
      {finished.length > 0 ? (
        <Group title={`Finished (${finished.length})`} empty="" items={finished} busyId={busyId} onSetStatus={setStatus} />
      ) : null}
    </section>
  )
}

function Group({
  title,
  empty,
  items,
  busyId,
  onSetStatus,
}: {
  title: string
  empty: string
  items: CampaignView[]
  busyId: string | null
  onSetStatus: (campaign: CampaignView, status: CampaignStatus) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      {items.length === 0 ? (
        empty ? (
          <p className="rounded-2xl border border-border bg-card p-5 text-sm leading-6 text-muted-foreground">{empty}</p>
        ) : null
      ) : (
        items.map((c) => <CampaignRow key={c.id} campaign={c} busy={busyId === c.id} onSetStatus={onSetStatus} />)
      )}
    </div>
  )
}

function CampaignRow({
  campaign,
  busy,
  onSetStatus,
}: {
  campaign: CampaignView
  busy: boolean
  onSetStatus: (campaign: CampaignView, status: CampaignStatus) => void
}) {
  const actions = ACTIONS[campaign.status]
  const originLabel = campaign.origin === "ai_generated" ? "AI-proposed" : "You created"
  const budget = formatMoney(campaign.plannedBudgetCents)

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{campaign.name}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 capitalize text-muted-foreground">{campaign.status}</span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{originLabel}</span>
        {budget ? <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">planned {budget}</span> : null}
      </div>
      {campaign.objective ? (
        <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{campaign.objective}</p>
      ) : null}
      {campaign.channels.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {campaign.channels.map((ch) => (
            <span key={ch} className="rounded-full border border-border px-2 py-0.5 text-xs capitalize text-muted-foreground">
              {ch}
            </span>
          ))}
        </div>
      ) : null}

      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button
              key={a.to}
              size="sm"
              variant={a.to === "cancelled" ? "ghost" : "outline"}
              onClick={() => onSetStatus(campaign, a.to)}
              disabled={busy}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : actionIcon(a.to)}
              {a.label}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">This campaign is {campaign.status} — no further actions.</p>
      )}

      <TrackedLinkBuilder campaign={campaign} />
    </article>
  )
}

/**
 * Pure, offline link builder. The founder pastes any URL they own; we append
 * UTM params and let them copy it. Nothing is sent, stored, or measured — this
 * is a convention helper only, not an attribution pipeline.
 */
function TrackedLinkBuilder({ campaign }: { campaign: CampaignView }) {
  const [base, setBase] = useState("")
  const [utmSource, setUtmSource] = useState("atai")

  const result = useMemo(() => {
    if (!base.trim()) return { url: null as string | null, reason: undefined as string | undefined }
    const medium = campaign.channels[0] ? channelToUtmMedium(campaign.channels[0]) : "other"
    return buildTrackedUrl(base, {
      utmSource: utmSource.trim() || "atai",
      utmMedium: medium,
      utmCampaign: campaign.utmCampaign || slugify(campaign.name) || undefined,
    })
  }, [base, utmSource, campaign.channels, campaign.utmCampaign, campaign.name])

  async function copy() {
    if (!result.url) return
    try {
      await navigator.clipboard.writeText(result.url)
      toast.success("Tracking link copied.")
    } catch {
      toast.error("Couldn't copy to your clipboard.")
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-transparent p-3">
      <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Link2 className="h-3.5 w-3.5" /> Tracked link (copy &amp; use yourself — Atai sends nothing)
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          value={base}
          onChange={(e) => setBase(e.target.value)}
          placeholder="Paste a link you own — https://…"
          className="min-w-0 flex-1 rounded-lg border border-border bg-transparent p-2 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
        />
        <input
          value={utmSource}
          onChange={(e) => setUtmSource(e.target.value)}
          placeholder="utm_source"
          className="w-28 rounded-lg border border-border bg-transparent p-2 text-xs outline-none placeholder:text-muted-foreground focus:border-primary"
        />
      </div>
      {result.url ? (
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">{result.url}</code>
          <Button size="sm" variant="outline" onClick={copy}>
            <Copy className="mr-2 h-4 w-4" /> Copy
          </Button>
        </div>
      ) : base.trim() && result.reason ? (
        <p className="text-xs text-muted-foreground">{result.reason}</p>
      ) : null}
    </div>
  )
}
