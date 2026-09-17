"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Markdown from "react-markdown"
import { postJson, patchJson } from "@/lib/client/api"
import type { Project } from "@/lib/types/project"
import type { ApplicationSpecification } from "@/lib/types/specification"
import { PLAN_SECTIONS, computePlanHealth, sectionStatus, getPlanSection, isPlaceholderValue, type PlanSectionId } from "@/lib/analysis/plan-sections"
import type { PlanAnalysis, PlanProposal } from "@/lib/types/plan-analysis"
import { SECTION_DEPENDENCIES } from "@/lib/types/plan-analysis"

// ─── Local helpers ────────────────────────────────────────────────────────────

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ")
}

const STATUS_STYLES: Record<string, string> = {
  complete: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  needs_work: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  missing: "bg-muted text-muted-foreground border-border",
}
const STATUS_LABELS: Record<string, string> = {
  complete: "Complete",
  needs_work: "Needs work",
  missing: "Missing",
}

function statusFor(
  id: string,
  spec: ApplicationSpecification,
): "complete" | "missing" | "needs_work" {
  const def = getPlanSection(id)
  if (!def) return "missing"
  return sectionStatus(def, spec)
}

// ─── Left panel: MY PLAN ──────────────────────────────────────────────────────

function PlanNav({
  spec,
  activeSection,
  onSelect,
  analysis,
  collapsedOnMobile,
}: {
  spec: ApplicationSpecification
  activeSection: PlanSectionId | null
  onSelect: (id: PlanSectionId) => void
  analysis: PlanAnalysis | null
  collapsedOnMobile?: boolean
}) {
  const health = useMemo(() => computePlanHealth(spec), [spec])
  const groups = useMemo(() => {
    const map = new Map<string, typeof PLAN_SECTIONS>()
    for (const def of PLAN_SECTIONS) {
      const arr = map.get(def.group) ?? []
      arr.push(def)
      map.set(def.group, arr)
    }
    return Array.from(map.entries())
  }, [])

  const findingBySection = useMemo(() => {
    const map = new Map<string, number>()
    for (const f of analysis?.findings ?? []) {
      map.set(f.section, (map.get(f.section) ?? 0) + 1)
    }
    return map
  }, [analysis])

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between">
          <h3 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Plan completeness
          </h3>
          <span className="text-lg font-semibold text-foreground" title={`${health.sections.filter((s) => s.status === "complete").length} of ${health.sections.length} sections defined`}>
            {health.percent}%
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={health.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Plan completeness">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${health.percent}%` }} />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {health.sections.filter((s) => s.status === "complete").length} of {health.sections.length} sections defined
        </p>
      </div>

      <nav aria-label="Plan sections" className="flex flex-col gap-4">
        {groups.map(([group, defs]) => (
          <div key={group}>
            <h4 className="px-1 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {group}
            </h4>
            <ul className="flex flex-col gap-0.5">
              {defs.map((def) => {
                const status = statusFor(def.id, spec)
                const flags = findingBySection.get(def.id) ?? 0
                const active = activeSection === def.id
                return (
                  <li key={def.id}>
                    <button
                      onClick={() => onSelect(def.id)}
                      aria-current={active ? "true" : undefined}
                      className={cx(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                        active
                          ? "bg-primary/10 font-medium text-foreground ring-1 ring-primary/30"
                          : "text-foreground/80 hover:bg-muted",
                      )}
                    >
                      <span aria-hidden className="text-sm">{def.icon}</span>
                      <span className="flex-1 truncate">{def.label}</span>
                      {flags > 0 && (
                        <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-amber-600 dark:text-amber-400" title={`${flags} insight${flags > 1 ? "s" : ""}`}>
                          {flags}
                        </span>
                      )}
                      <span
                        className={cx(
                          "size-1.5 shrink-0 rounded-full border",
                          status === "complete" ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground/40 bg-transparent",
                        )}
                        title={STATUS_LABELS[status]}
                      />
                      <span className="sr-only">{STATUS_LABELS[status]}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  )
}

// ─── Section detail (replaces plan content view when a section is selected) ──

function SectionDetail({
  spec,
  sectionId,
  onWorkOnThis,
  onClose,
  canEdit,
}: {
  spec: ApplicationSpecification
  sectionId: PlanSectionId
  onWorkOnThis: () => void
  onClose: () => void
  canEdit: boolean
}) {
  const def = getPlanSection(sectionId)
  if (!def) return null
  const raw = def.read(spec)
  const missing = !raw || isPlaceholderValue(raw)
  const status = missing ? "missing" : "complete"

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-base">{def.icon}</span>
            <h2 className="text-lg font-semibold text-foreground">{def.label}</h2>
            <span className={cx("rounded-full border px-2 py-0.5 text-[10px] font-medium", STATUS_STYLES[status])}>
              {STATUS_LABELS[status]}
            </span>
          </div>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{def.group}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Close
        </button>
      </div>

      {missing ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
          <p className="text-sm font-medium text-foreground">Not defined yet.</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{def.emptyHint}</p>
          {canEdit && (
            <button
              onClick={onWorkOnThis}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              ✨ Work on this with AI
            </button>
          )}
        </div>
      ) : (
        <div className="prose prose-sm dark:prose-invert max-w-none rounded-xl border border-border bg-card p-5 text-sm leading-7 text-foreground">
          <Markdown>{raw}</Markdown>
        </div>
      )}
    </div>
  )
}

// ─── Proposal card ────────────────────────────────────────────────────────────

function ProposalCard({
  proposal,
  busy,
  onAccept,
  onEdit,
  onReject,
}: {
  proposal: PlanProposal
  busy: boolean
  onAccept: (value: string) => void
  onEdit: (value: string) => void
  onReject: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(proposal.proposedValue)
  const def = getPlanSection(proposal.section)

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-primary">
          Suggested plan update
        </p>
        <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
          {def?.label ?? proposal.section}
        </span>
      </div>

      {proposal.currentValue && (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Current</p>
          <p className="mt-1 line-clamp-3 rounded-lg bg-background/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
            {proposal.currentValue}
          </p>
        </div>
      )}

      <div className="mt-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Suggested</p>
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            className="mt-1 w-full resize-y rounded-lg border border-primary/40 bg-background px-3 py-2 text-sm leading-6 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label="Edit suggested value"
          />
        ) : (
          <p className="mt-1 whitespace-pre-wrap rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm leading-6 text-foreground">
            {proposal.proposedValue}
          </p>
        )}
      </div>

      {proposal.reason && (
        <p className="mt-2 text-xs italic text-muted-foreground">Why: {proposal.reason}</p>
      )}

      {(SECTION_DEPENDENCIES[proposal.section] ?? []).length > 0 && (
        <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
          This change may also affect{" "}
          {(SECTION_DEPENDENCIES[proposal.section] ?? [])
            .map((id) => getPlanSection(id)?.label ?? id)
            .join(", ")}
          . We can review those next.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {editing ? (
          <>
            <button
              onClick={() => onAccept(draft)}
              disabled={busy || !draft.trim()}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
            >
              Save to plan
            </button>
            <button
              onClick={() => { setEditing(false); setDraft(proposal.proposedValue) }}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onAccept(proposal.proposedValue)}
              disabled={busy}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
            >
              Add to Plan
            </button>
            <button
              onClick={() => setEditing(true)}
              disabled={busy}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground hover:bg-accent disabled:opacity-40"
            >
              Edit
            </button>
            <button
              onClick={onReject}
              disabled={busy}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-40"
            >
              Reject
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Center panel: AI Co-Founder chat ─────────────────────────────────────────

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  proposal?: PlanProposal | null
}

const QUICK_ACTIONS = [
  { label: "What should I improve?", prompt: "What should I improve in my plan right now, and why?" },
  { label: "Find gaps", prompt: "Find the gaps in my plan — what's missing that should be defined before I move forward?" },
  { label: "Challenge my assumptions", prompt: "Challenge my assumptions: what am I taking for granted that deserves a second look?" },
  { label: "Improve my business model", prompt: "How can I strengthen my business model and revenue approach?" },
  { label: "What's next?", prompt: "Based on where my plan stands, what's the single best thing to work on next?" },
]

function ChatPanel({
  projectId,
  isOwner,
  spec,
  activeSection,
  onSpecChanged,
}: {
  projectId: string
  isOwner: boolean
  spec: ApplicationSpecification
  activeSection: PlanSectionId | null
  onSpecChanged: (spec: ApplicationSpecification) => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [messages, sending])

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || sending || !isOwner) return
      setInput("")
      setError(null)
      const localId = `local-${Date.now()}`
      setMessages((prev) => [...prev, { id: localId, role: "user", content: trimmed }])
      setSending(true)
      try {
        const data = await postJson<{ reply: string; proposal: PlanProposal | null; decisions: number }>(
          `/api/projects/${projectId}/plan-chat`,
          { message: trimmed, activeSection },
        )
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: "assistant", content: data.reply, proposal: data.proposal },
        ])
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
      } finally {
        setSending(false)
      }
    },
    [sending, isOwner, projectId, activeSection],
  )

  const acceptProposal = useCallback(
    async (proposal: PlanProposal, value: string) => {
      try {
        const data = await patchJson<{ project: Project }>(`/api/projects/${projectId}`, {
          sectionUpdate: {
            section: proposal.section,
            value,
            acceptedProposal: { id: proposal.id },
          },
        })
        if (data.project?.specification) onSpecChanged(data.project.specification)
        setMessages((prev) => prev.map((m) => (m.proposal?.id === proposal.id ? { ...m, proposal: null } : m)))
        toast.success("Added to your plan.")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update the plan. Please try again.")
      }
    },
    [projectId, onSpecChanged],
  )

  const rejectProposal = useCallback((proposal: PlanProposal) => {
    setMessages((prev) => prev.map((m) => (m.proposal?.id === proposal.id ? { ...m, proposal: null } : m)))
    toast("Change discarded — your plan is untouched.")
  }, [])

  const activeDef = activeSection ? getPlanSection(activeSection) : null

  if (!isOwner) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm font-medium text-foreground">Read-only view</p>
          <p className="mt-1 text-sm text-muted-foreground">Sign in as the project owner to collaborate with the AI co-founder.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Conversation */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          {/* Intro — lightweight, no AI call on load (spec section 15).
              Context-aware: when the founder is working on a section, the
              intro speaks to that section instead of generic onboarding. */}
          {messages.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground">Your AI Co-Founder</h2>
              {activeDef ? (
                <p className="mt-0.5 text-sm text-primary">
                  Working on {activeDef.label} — {activeDef.emptyHint}
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-primary">I know your idea. Let&apos;s make it stronger.</p>
              )}
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {activeDef
                  ? "Tell me what you want to change and I'll draft it for your review — nothing goes into the plan until you approve it."
                  : "I've got your current plan in context. We can work through it together — find what's missing, strengthen weak spots, and lock in improvements before you build."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {QUICK_ACTIONS.map((qa) => (
                  <button
                    key={qa.label}
                    onClick={() => send(qa.prompt)}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-accent"
                  >
                    {qa.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className="flex flex-col gap-2">
              <div className={cx("flex gap-3", m.role === "user" && "flex-row-reverse")}>
                <div
                  className={cx(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-foreground/10 text-foreground",
                  )}
                  aria-hidden
                >
                  {m.role === "user" ? "You" : "AI"}
                </div>
                <div
                  className={cx(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6",
                    m.role === "user"
                      ? "rounded-tr-sm bg-primary text-primary-foreground"
                      : "rounded-tl-sm border border-border bg-card text-foreground",
                  )}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>:first-child]:mt-0 [&>:last-child]:mb-0">
                      <Markdown>{m.content}</Markdown>
                    </div>
                  ) : (
                    m.content
                  )}
                </div>
              </div>
              {m.proposal && (
                <div className="ml-10">
                  <ProposalCard
                    proposal={m.proposal}
                    busy={false}
                    onAccept={(value) => acceptProposal(m.proposal!, value)}
                    onEdit={(value) => acceptProposal(m.proposal!, value)}
                    onReject={() => rejectProposal(m.proposal!)}
                  />
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div className="flex gap-3">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-[10px] font-bold text-foreground" aria-hidden>
                AI
              </div>
              <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3">
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
                <span className="ml-1 text-xs text-muted-foreground">Your AI co-founder is thinking…</span>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive" role="alert">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-background px-4 py-3">
        <div className="mx-auto max-w-2xl">
          {activeDef && (
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-[11px] text-primary">
              Working on: {activeDef.label}
              <span className="sr-only">(context sent with your next message)</span>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  send(input)
                }
              }}
              placeholder="Ask your co-founder anything about the plan…"
              rows={2}
              aria-label="Message your AI co-founder"
              className="flex-1 resize-none rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              onClick={() => send(input)}
              disabled={sending || !input.trim()}
              className="shrink-0 self-end rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
            Enter to send · Shift+Enter for a new line · Small credit cost per message
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Launch (restored from the original collaborate client) ──────────────

function LaunchButton({ projectId, state }: { projectId: string; state: string }) {
  const router = useRouter()
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canLaunch = state === "plan_ready"

  async function handleLaunch() {
    if (!canLaunch || launching) return
    setLaunching(true)
    setError(null)
    try {
      await postJson(`/api/projects/${projectId}/launch`)
      toast.success("Build started — redirecting to your workspace…")
      router.push(`/project/${projectId}`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start build. Please try again.")
      setLaunching(false)
    }
  }

  if (!canLaunch) return null

  return (
    <div className="border-t border-border p-4">
      {error && (
        <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <button
        onClick={handleLaunch}
        disabled={launching}
        className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {launching ? "Starting build…" : "🚀 Submit Plan & Start Building"}
      </button>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">
        Credits will be reserved when the build starts.
      </p>
    </div>
  )
}

// ─── Right panel: PLAN INSIGHTS ───────────────────────────────────────────────

function InsightsPanel({
  spec,
  analysis,
  analyzing,
  onAnalyze,
  onRefresh,
  onWorkOn,
  isOwner,
  projectId,
  onSpecChanged,
  onAnalysisUpdated,
}: {
  spec: ApplicationSpecification
  analysis: PlanAnalysis | null
  analyzing: boolean
  onAnalyze: (refresh: boolean) => void
  onRefresh: () => void
  onWorkOn: (section: PlanSectionId) => void
  isOwner: boolean
  projectId: string
  onSpecChanged: (spec: ApplicationSpecification) => void
  onAnalysisUpdated: (a: PlanAnalysis | null) => void
}) {
  const health = useMemo(() => computePlanHealth(spec), [spec])

  const groups: Array<{ key: string; label: string; ids: PlanSectionId[] }> = [
    { key: "Foundation", label: "Foundation", ids: PLAN_SECTIONS.filter((d) => d.group === "Foundation").map((d) => d.id) },
    { key: "Product", label: "Product", ids: PLAN_SECTIONS.filter((d) => d.group === "Product").map((d) => d.id) },
    { key: "Business", label: "Business", ids: PLAN_SECTIONS.filter((d) => d.group === "Business").map((d) => d.id) },
    { key: "Market", label: "Market", ids: PLAN_SECTIONS.filter((d) => d.group === "Market").map((d) => d.id) },
    { key: "Launch", label: "Launch", ids: PLAN_SECTIONS.filter((d) => d.group === "Launch").map((d) => d.id) },
    { key: "Growth", label: "Growth", ids: PLAN_SECTIONS.filter((d) => d.group === "Growth").map((d) => d.id) },
  ]

  const gaps = (analysis?.findings ?? []).filter((f) => f.severity === "gap")
  const weaknesses = (analysis?.findings ?? []).filter((f) => f.severity === "weakness")
  const strengths = (analysis?.findings ?? []).filter((f) => f.severity === "strength")

  const nbaSection = analysis?.nextBestAction?.section

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* Plan status by group */}
      <section aria-label="Plan status">
        <h3 className="pb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Plan status
        </h3>
        <div className="flex flex-col gap-2">
          {groups.map((g) => {
            const total = g.ids.length
            const done = g.ids.filter((id) => statusFor(id, spec) === "complete").length
            return (
              <div key={g.key} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-xs text-muted-foreground">{g.label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cx("h-full rounded-full transition-all", done === total ? "bg-emerald-500" : "bg-primary")}
                    style={{ width: `${total ? (done / total) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                  {done}/{total}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Next best action */}
      <section aria-label="Next best action" className="rounded-xl border border-primary/25 bg-primary/5 p-4">
        <h3 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-primary">
          Next best action
        </h3>
        {analysis?.nextBestAction ? (
          <>
            <p className="mt-2 text-sm font-medium text-foreground">{analysis.nextBestAction.title}</p>
            {analysis.nextBestAction.why && (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{analysis.nextBestAction.why}</p>
            )}
            {nbaSection && getPlanSection(nbaSection) && (
              <button
                onClick={() => onWorkOn(nbaSection as PlanSectionId)}
                className="mt-3 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Work on this
              </button>
            )}
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Run an analysis and I&apos;ll point to the most valuable next step.
            </p>
          </>
        )}
      </section>

      {/* AI found */}
      <section aria-label="AI findings">
        <div className="flex items-center justify-between pb-2">
          <h3 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            AI found
          </h3>
          {analysis && (
            <button
              onClick={onRefresh}
              disabled={analyzing || !isOwner}
              className="text-[11px] text-primary hover:underline disabled:opacity-40"
            >
              Re-analyze
            </button>
          )}
        </div>

        {!analysis ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              No analysis yet. I&apos;ll review your plan and flag what needs attention.
            </p>
            {isOwner && (
              <button
                onClick={() => onAnalyze(false)}
                disabled={analyzing}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {analyzing ? (
                  <>
                    <span className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    Reviewing your plan…
                  </>
                ) : (
                  "Analyze My Plan"
                )}
              </button>
            )}
            {analyzing && !isOwner && <p className="mt-2 text-xs text-muted-foreground">Reviewing your plan…</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs leading-5 text-muted-foreground">{analysis.summary}</p>
            {[
              ["Critical gaps", gaps, "border-destructive/25 bg-destructive/5"],
              ["Needs improvement", weaknesses, "border-amber-500/25 bg-amber-500/5"],
              ["Strong areas", strengths, "border-emerald-500/25 bg-emerald-500/5"],
            ].map(
              ([label, list, style]) =>
                (list as PlanAnalysis["findings"]).length > 0 && (
                  <div key={label as string}>
                    <p className="pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {label as string} ({(list as PlanAnalysis["findings"]).length})
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {(list as PlanAnalysis["findings"]).map((f, i) => (
                        <div key={`${f.section}-${i}`} className={cx("rounded-lg border p-2.5", style as string)}>
                          <p className="text-xs font-medium text-foreground">{f.title}</p>
                          {f.why && <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{f.why}</p>}
                          <button
                            onClick={() => onWorkOn(f.section as PlanSectionId)}
                            className="mt-1.5 text-[11px] font-medium text-primary hover:underline"
                          >
                            Work on this →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ),
            )}
            {(analysis.proposals ?? []).length > 0 && (
              <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
                <p className="text-xs font-medium text-foreground">
                  This analysis includes {(analysis.proposals ?? []).length} suggested update{(analysis.proposals ?? []).length > 1 ? "s" : ""}.
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {(analysis.proposals ?? []).map((p) => (
                    <AnalysisProposalRow
                      key={p.id}
                      projectId={projectId}
                      proposal={p}
                      onSpecChanged={onSpecChanged}
                      onAnalysisChanged={onAnalysisUpdated}
                      onWorkOn={() => onWorkOn(p.section as PlanSectionId)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

function AnalysisProposalRow({
  projectId,
  proposal,
  onSpecChanged,
  onAnalysisChanged,
  onWorkOn,
}: {
  projectId: string
  proposal: PlanProposal
  onSpecChanged: (spec: ApplicationSpecification) => void
  onAnalysisChanged: (a: PlanAnalysis | null) => void
  onWorkOn: () => void
}) {
  const [mode, setMode] = useState<"view" | "editing">("view")
  const [resolved, setResolved] = useState<null | "accepted" | "rejected">(null)
  const [busy, setBusy] = useState(false)
  const [value, setValue] = useState(proposal.proposedValue)
  const def = getPlanSection(proposal.section)

  async function accept() {
    setBusy(true)
    try {
      const data = await patchJson<{ project: Project }>(`/api/projects/${projectId}`, {
        sectionUpdate: { section: proposal.section, value, acceptedProposal: { id: proposal.id } },
      })
      if (data.project?.specification) onSpecChanged(data.project.specification)
      if (data.project?.planAnalysis !== undefined) onAnalysisChanged(data.project.planAnalysis)
      setResolved("accepted")
      toast.success("Added to your plan.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the plan.")
    } finally {
      setBusy(false)
    }
  }

  async function reject() {
    setResolved("rejected")
    try {
      // Durable dismissal so a cached analysis doesn't resurrect it.
      await patchJson<{ project: Project }>(`/api/projects/${projectId}`, {
        dismissProposalId: proposal.id,
      })
    } catch {
      // Local dismissal still stands; the cached copy is cleaned best-effort.
    }
  }

  if (resolved === "accepted") {
    return <p className="text-[11px] text-emerald-600 dark:text-emerald-400">✓ Added to plan — {def?.label}</p>
  }
  if (resolved === "rejected") {
    return <p className="text-[11px] text-muted-foreground">Discarded — {def?.label}</p>
  }

  return (
    <div className="rounded-lg border border-border bg-background p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{def?.label}</p>
      {mode === "editing" ? (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-lg border border-primary/40 bg-background px-2.5 py-1.5 text-xs leading-5"
          aria-label="Edit suggested value"
        />
      ) : (
        <p className="mt-1 line-clamp-3 text-xs leading-5 text-foreground">{proposal.proposedValue}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {mode === "editing" ? (
          <>
            <button onClick={accept} disabled={busy || !value.trim()} className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-40">
              Save
            </button>
            <button onClick={() => { setMode("view"); setValue(proposal.proposedValue) }} className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground">
              Cancel
            </button>
          </>
        ) : (
          <>
            <button onClick={accept} disabled={busy} className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-40">
              Add to Plan
            </button>
            <button onClick={() => setMode("editing")} className="rounded-md border border-border px-2 py-1 text-[11px] text-foreground">
              Edit
            </button>
            <button onClick={reject} disabled={busy} className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground">
              Reject
            </button>
            <button onClick={onWorkOn} className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground">
              Discuss →
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Root client ──────────────────────────────────────────────────────────────

export function CollaborateClient({
  projectId,
  initialProject,
  isOwner,
}: {
  projectId: string
  initialProject: Project
  isOwner: boolean
}) {
  const [spec, setSpec] = useState<ApplicationSpecification | undefined>(initialProject.specification)
  const [analysis, setAnalysis] = useState<PlanAnalysis | null>(initialProject.planAnalysis ?? null)
  const [activeSection, setActiveSection] = useState<PlanSectionId | null>(null)
  // When true, the chat is shown while a section is selected — the composer
  // shows the "Working on" chip and the AI receives the focus section.
  const [chatWithFocus, setChatWithFocus] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [mobileView, setMobileView] = useState<"chat" | "plan" | "insights">("chat")
  const [projectState] = useState(initialProject.state)

  const runAnalysis = useCallback(
    async (refresh: boolean) => {
      if (!isOwner || analyzing) return
      setAnalyzing(true)
      try {
        const data = await postJson<{ analysis: PlanAnalysis; cached: boolean; decisions: number }>(
          `/api/projects/${projectId}/analyze-plan`,
          { refresh },
        )
        setAnalysis(data.analysis)
        toast.success(data.cached ? "Loaded your recent analysis." : "Analysis complete.")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "The analysis couldn't run. Please try again.")
      } finally {
        setAnalyzing(false)
      }
    },
    [isOwner, analyzing, projectId],
  )

  if (!spec) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted text-3xl" aria-hidden>📋</div>
          <h2 className="text-xl font-semibold">No plan yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            The app plan is still being generated. Check back in a moment.
          </p>
        </div>
      </div>
    )
  }

  const health = computePlanHealth(spec)
  const firstMissing = health.missing[0] ?? null

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Desktop: 3 areas — plan (left), AI (center, dominant), insights (right) */}
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-border lg:block" aria-label="My plan">
        <PlanNav
          spec={spec}
          activeSection={activeSection}
          onSelect={(id) => {
            setActiveSection((cur) => (cur === id ? null : id))
            setChatWithFocus(false)
          }}
          analysis={analysis}
        />
      </aside>

      {/* Desktop center column — hidden below lg so the mobile container is
          the single source of these components (no duplicate mounts). */}
      <main className="hidden min-w-0 flex-1 flex-col overflow-hidden lg:flex">
        {activeSection && !chatWithFocus ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SectionDetail
              spec={spec}
              sectionId={activeSection}
              canEdit={isOwner}
              onWorkOnThis={() => {
                // Keep the section selected — the composer shows the
                // "Working on" chip and the AI receives the focus section.
                setChatWithFocus(true)
                toast(`Working on ${getPlanSection(activeSection)?.label ?? "this section"} — tell your co-founder what you want to change.`)
              }}
              onClose={() => {
                setActiveSection(null)
                setChatWithFocus(false)
              }}
            />
          </div>
        ) : (
          <ChatPanel
            projectId={projectId}
            isOwner={isOwner}
            spec={spec}
            activeSection={chatWithFocus ? activeSection : null}
            onSpecChanged={setSpec}
          />
        )}
        {isOwner && <LaunchButton projectId={projectId} state={projectState} />}
      </main>

      <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-border xl:block" aria-label="Plan insights">
        <InsightsPanel
          spec={spec}
          analysis={analysis}
          analyzing={analyzing}
          onAnalyze={runAnalysis}
          onRefresh={() => runAnalysis(true)}
          onWorkOn={(id) => {
            setActiveSection(id)
            setChatWithFocus(false)
          }}
          isOwner={isOwner}
          projectId={projectId}
          onSpecChanged={setSpec}
          onAnalysisUpdated={setAnalysis}
        />
      </aside>

      {/* Mobile / tablet: single-column flow with view switcher. The only
          mount of chat/section/launch below lg — the desktop column is hidden.
          min-h-0 keeps the flex chain height-constrained so each tab panel
          scrolls internally and the launch button stays pinned. */}
      <div className="flex w-full min-h-0 flex-col lg:hidden">
        <div className="flex border-b border-border bg-card" role="tablist" aria-label="Workspace views">
          {(["plan", "chat", "insights"] as const).map((v) => (
            <button
              key={v}
              id={`collab-tab-${v}`}
              role="tab"
              aria-selected={mobileView === v}
              aria-controls={`collab-panel-${v}`}
              onClick={() => setMobileView(v)}
              className={cx(
                "flex-1 px-3 py-2.5 text-xs font-medium capitalize transition-colors",
                mobileView === v ? "border-b-2 border-primary text-foreground" : "text-muted-foreground",
              )}
            >
              {v === "plan" ? "My Plan" : v === "chat" ? "AI Co-Founder" : "Insights"}
            </button>
          ))}
        </div>
        <div className="flex flex-1 min-h-0 flex-col">
          {mobileView === "plan" && (
            <div id="collab-panel-plan" role="tabpanel" aria-labelledby="collab-tab-plan" className="min-h-0 flex-1 overflow-y-auto">
              <PlanNav
                spec={spec}
                activeSection={activeSection}
                onSelect={(id) => {
                  const selecting = activeSection !== id
                  setActiveSection(selecting ? id : null)
                  setChatWithFocus(false)
                  if (selecting) setMobileView("chat")
                }}
                analysis={analysis}
                collapsedOnMobile
              />
            </div>
          )}
          {mobileView === "chat" && (
            <div id="collab-panel-chat" role="tabpanel" aria-labelledby="collab-tab-chat" className="flex min-h-0 flex-1 flex-col">
              <div className={cx("min-h-0 flex-1", activeSection && !chatWithFocus && "overflow-y-auto")}>
                {activeSection && !chatWithFocus ? (
                  <SectionDetail
                    spec={spec}
                    sectionId={activeSection}
                    canEdit={isOwner}
                    onWorkOnThis={() => setChatWithFocus(true)}
                    onClose={() => {
                      setActiveSection(null)
                      setChatWithFocus(false)
                    }}
                  />
                ) : (
                  <ChatPanel
                    projectId={projectId}
                    isOwner={isOwner}
                    spec={spec}
                    activeSection={chatWithFocus ? activeSection : null}
                    onSpecChanged={setSpec}
                  />
                )}
              </div>
            </div>
          )}
          {mobileView === "insights" && (
            <div id="collab-panel-insights" role="tabpanel" aria-labelledby="collab-tab-insights" className="min-h-0 flex-1 overflow-y-auto">
              <InsightsPanel
                spec={spec}
                analysis={analysis}
                analyzing={analyzing}
                onAnalyze={runAnalysis}
                onRefresh={() => runAnalysis(true)}
                onWorkOn={(id) => {
                  setActiveSection(id)
                  setChatWithFocus(false)
                  setMobileView("chat")
                }}
                isOwner={isOwner}
                projectId={projectId}
                onSpecChanged={setSpec}
                onAnalysisUpdated={setAnalysis}
              />
            </div>
          )}
        </div>
        {/* Pinned below every mobile tab — always reachable, never requires
            scrolling to the end of a long panel. */}
        {isOwner && <LaunchButton projectId={projectId} state={projectState} />}
      </div>
    </div>
  )
}
