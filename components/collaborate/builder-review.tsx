"use client"

import { useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Hammer,
  Sparkles,
  Target,
} from "lucide-react"
import { PLAN_SECTIONS, sectionStatus, type PlanSectionId } from "@/lib/analysis/plan-sections"
import { buildInitialBuildPrompt } from "@/lib/analysis/prompt-builder"
import type { AIArtifact, AIArtifactStatus } from "@/lib/types/ai-artifacts"
import type { ApplicationSpecification } from "@/lib/types/specification"
import type { ProjectPreferences } from "@/lib/types/project"
import type { ProjectUnderstanding } from "@/lib/types/understanding"
import { CofounderMarkdown } from "@/components/cofounder/markdown"
import { cn } from "@/lib/utils"

/**
 * The Review surface: the whole plan, the AI segments that produced it, and
 * the EXACT brief the builder (Totalum) receives at launch — computed with
 * the same pure `buildInitialBuildPrompt` the launch route calls, so this
 * page can never claim the builder gets something it doesn't.
 */

const ARTIFACT_STATUS: Record<AIArtifactStatus, { label: string; dot: string; chip: string }> = {
  ready: { label: "used", dot: "bg-emerald-500", chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  fallback: { label: "fallback", dot: "bg-amber-500", chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  unparsed: { label: "raw kept", dot: "bg-orange-500", chip: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  failed: { label: "failed", dot: "bg-red-500", chip: "bg-red-500/10 text-red-600 dark:text-red-400" },
}

const SECTION_STATUS_DOT: Record<string, string> = {
  complete: "border-emerald-500 bg-emerald-500",
  needs_work: "border-amber-500 bg-amber-500",
  missing: "border-muted-foreground/40 bg-transparent",
}

export interface BriefCoverage {
  prompt: string
  /** Sections whose content really appears in the launch brief. */
  inBrief: PlanSectionId[]
  total: number
}

/** Sections the prompt builder renders as item lists rather than the stored
 * text verbatim, so coverage has to be checked per item. */
const LIST_SECTIONS = new Set<PlanSectionId>([
  "features",
  "flows",
  "data",
  "backend",
  "integrations",
  "targetUsers",
  "userRoles",
])

/**
 * Does this section's content actually reach the brief, and which span can be
 * highlighted in it? Text sections are carried verbatim; list sections are
 * re-rendered as bullets, so every item must be present. Never guessed.
 */
export function briefMatchFor(
  def: (typeof PLAN_SECTIONS)[number],
  spec: ApplicationSpecification,
  prompt: string,
): { inBrief: boolean; needle: string } {
  const value = def.read(spec)
  if (!value) return { inBrief: false, needle: "" }
  if (LIST_SECTIONS.has(def.id)) {
    const items = value
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 3)
    if (items.length === 0) return { inBrief: false, needle: "" }
    const hits = items.filter((item) => prompt.includes(item))
    return { inBrief: hits.length === items.length, needle: hits.sort((a, b) => b.length - a.length)[0] ?? "" }
  }
  // Text sections are carried verbatim, so the exact stored value must appear.
  // Nothing in the brief truncates plan text any more, so the only way a section
  // can fail this is `neutralizePlanText` swapping an injection phrase out of it —
  // which is genuinely not what the founder wrote, and is reported as such.
  if (!prompt.includes(value)) return { inBrief: false, needle: "" }
  return { inBrief: true, needle: value.length >= 12 ? value : "" }
}

/** Shared by the review panel and the nav badge so neither can disagree with
 * the other about what actually travels to the builder. */
export function computeBriefCoverage(
  spec: ApplicationSpecification,
  understanding?: ProjectUnderstanding,
  preferences?: ProjectPreferences,
): BriefCoverage {
  const prompt = buildInitialBuildPrompt(spec, understanding, preferences)
  const inBrief = PLAN_SECTIONS.filter((def) => briefMatchFor(def, spec, prompt).inBrief).map((def) => def.id)
  return { prompt, inBrief, total: PLAN_SECTIONS.length }
}

export function BuilderReviewPanel({
  spec,
  understanding,
  preferences,
  artifacts,
  onClose,
}: {
  spec: ApplicationSpecification
  understanding?: ProjectUnderstanding
  preferences?: ProjectPreferences
  artifacts: AIArtifact[]
  onClose?: () => void
}) {
  const coverage = useMemo(
    () => computeBriefCoverage(spec, understanding, preferences),
    [spec, understanding, preferences],
  )
  const prompt = coverage.prompt

  const sections = useMemo(
    () =>
      PLAN_SECTIONS.map((def) => {
        const { inBrief, needle } = briefMatchFor(def, spec, prompt)
        return { def, value: def.read(spec), status: sectionStatus(def, spec), inBrief, needle }
      }),
    [spec, prompt],
  )
  const inBriefCount = sections.filter((s) => s.inBrief).length
  const carriedCount = sections.filter((s) => s.status !== "missing" && !s.inBrief).length

  const groups = useMemo(() => {
    const map = new Map<string, typeof sections>()
    for (const s of sections) {
      const arr = map.get(s.def.group) ?? []
      arr.push(s)
      map.set(s.def.group, arr)
    }
    return Array.from(map.entries())
  }, [sections])

  const stages = useMemo(() => [...artifacts].sort((a, b) => a.at - b.at), [artifacts])

  // ── highlight-in-brief linking ──
  const [highlight, setHighlight] = useState<string | null>(null)
  const briefRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  const jumpTo = (needle: string) => {
    setHighlight(needle)
    briefRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const briefParts = useMemo(() => {
    if (!highlight) return [{ text: prompt, hit: false }]
    const parts: Array<{ text: string; hit: boolean }> = []
    let rest = prompt
    while (true) {
      const idx = rest.indexOf(highlight)
      if (idx === -1) {
        parts.push({ text: rest, hit: false })
        break
      }
      if (idx > 0) parts.push({ text: rest.slice(0, idx), hit: false })
      parts.push({ text: highlight, hit: true })
      rest = rest.slice(idx + highlight.length)
    }
    return parts
  }, [prompt, highlight])

  const copyBrief = () => {
    navigator.clipboard
      ?.writeText(prompt)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
      })
      .catch(() => {})
  }

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Target className="size-4.5 shrink-0 text-primary" aria-hidden />
            <h2 className="text-lg font-semibold text-foreground">Builder review</h2>
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {sections.length} sections · {inBriefCount} in brief
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            The whole plan as it stands, the AI responses that built it, and the exact brief your
            app is built from when you launch — recomputed live from this plan, not a summary.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent sm:min-h-0"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to plan
          </button>
        )}
      </header>

      {/* ── The builder brief ── */}
      <section
        ref={briefRef}
        aria-label="The brief the builder receives"
        className="rounded-xl border border-primary/25 bg-card"
      >
        <BriefHeader prompt={prompt} copied={copied} onCopy={copyBrief} />
        <BriefBody parts={briefParts} hasHighlight={highlight !== null} onClearHighlight={() => setHighlight(null)} />
        <p className="border-t border-border px-4 py-2 text-[11px] leading-4 text-muted-foreground">
          This is the single prompt sent to the builder at launch.{" "}
          {carriedCount === 0 ? (
            <>
              All {sections.length} sections of your plan are here in full — nothing is summarised,
              shortened or dropped on the way to the builder.
            </>
          ) : (
            <>
              {carriedCount} plan {carriedCount === 1 ? "section is" : "sections are"} kept in your
              plan but do not travel in this brief — their cards say so.
            </>
          )}
        </p>
      </section>

      {/* ── AI segments ── */}
      <section aria-label="AI segments" className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            How this plan was made
          </h3>
          <span className="font-mono text-[10px] text-muted-foreground">{stages.length} responses</span>
        </div>
        {stages.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            This plan was generated before per-stage responses were captured — the stored plan below is
            the full record.
          </p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-2" aria-hidden>
              {stages.map((a, i) => (
                <span key={a.id} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-muted-foreground/50">→</span>}
                  <StageChip artifact={a} />
                </span>
              ))}
              <span className="flex items-center gap-1.5">
                <span className="text-muted-foreground/50">→</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  <Check className="size-3" aria-hidden />
                  your plan
                </span>
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
              Every segment below is stored verbatim — open one to see what that stage actually
              answered, including raw model text when parsing failed.
            </p>
            <ul className="mt-3 flex flex-col gap-1.5">
              {stages.map((a) => (
                <StageRow key={a.id} artifact={a} />
              ))}
            </ul>
          </>
        )}
      </section>

      {/* ── The whole plan ── */}
      <section aria-label="The whole plan" className="flex flex-col gap-4">
        {groups.map(([group, items]) => {
          const inGroup = items.filter((s) => s.inBrief).length
          return (
            <div key={group}>
              <div className="flex items-baseline justify-between px-1 pb-1.5">
                <h4 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {group}
                </h4>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {inGroup}/{items.length} in brief
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {items.map((s) => (
                  <SectionCard
                    key={s.def.id}
                    id={s.def.id}
                    label={s.def.label}
                    status={s.status}
                    value={s.value}
                    emptyHint={s.def.emptyHint}
                    inBrief={s.inBrief}
                    canHighlight={s.needle !== "" && s.inBrief}
                    onHighlight={() => jumpTo(s.needle)}
                  />
                ))}
              </ul>
            </div>
          )
        })}
      </section>
    </div>
  )
}

// ─── Brief ────────────────────────────────────────────────────────────────────

function BriefHeader({ prompt, copied, onCopy }: { prompt: string; copied: boolean; onCopy: () => void }) {
  const lines = prompt.split("\n").length
  return (
    <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-2">
        <Hammer className="size-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">The brief the builder receives</h3>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {lines} lines · {prompt.length.toLocaleString()} chars
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
      >
        {copied ? <Check className="size-3.5 text-emerald-500" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        {copied ? "Copied" : "Copy brief"}
      </button>
    </div>
  )
}

function BriefBody({
  parts,
  hasHighlight,
  onClearHighlight,
}: {
  parts: Array<{ text: string; hit: boolean }>
  hasHighlight: boolean
  onClearHighlight: () => void
}) {
  const [raw, setRaw] = useState(false)
  const text = parts.map((p) => p.text).join("")
  return (
    <div className="px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-end gap-1.5">
        {hasHighlight && (
          <button
            type="button"
            onClick={onClearHighlight}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-700 transition-colors hover:border-amber-500 dark:text-amber-400"
          >
            Clear highlight
          </button>
        )}
        <button
          type="button"
          onClick={() => setRaw(!raw)}
          aria-pressed={raw}
          className="rounded-lg border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {raw ? "Show formatted" : "Show exact text"}
        </button>
      </div>
      {raw ? (
        <pre className="collab-scroll max-h-[55vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-background px-3 py-2 font-mono text-[11px] leading-5 text-foreground">
          {text}
        </pre>
      ) : (
        <div className="collab-scroll max-h-[55vh] overflow-y-auto rounded-lg border border-border bg-background px-3 py-2">
          {parts.map((p, i) =>
            p.hit ? (
              <mark key={i} className="rounded-sm bg-amber-200/70 px-0.5 dark:bg-amber-400/25">
                {p.text}
              </mark>
            ) : (
              <CofounderMarkdown key={i}>{p.text}</CofounderMarkdown>
            ),
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function SectionCard({
  id,
  label,
  status,
  value,
  emptyHint,
  inBrief,
  canHighlight,
  onHighlight,
}: {
  id: PlanSectionId
  label: string
  status: "complete" | "missing" | "needs_work"
  value: string
  emptyHint: string
  inBrief: boolean
  canHighlight: boolean
  onHighlight: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const long = value.length > 240
  return (
    <li
      data-section={id}
      className={cn(
        "rounded-xl border bg-card p-3.5 transition-colors",
        status === "missing" ? "border-border/60" : "border-border",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn("size-1.5 shrink-0 rounded-full border", SECTION_STATUS_DOT[status])}
          aria-hidden
        />
        <h5 className="flex-1 truncate text-sm font-medium text-foreground">{label}</h5>
        {status !== "missing" &&
          (inBrief ? (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-primary">
              In brief
            </span>
          ) : (
            <span
              className="shrink-0 rounded-full bg-muted px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
              title="Kept in your plan, but this text is not part of the launch brief"
            >
              Plan only
            </span>
          ))}
        {canHighlight && (
          <button
            type="button"
            onClick={onHighlight}
            className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            Show in brief
          </button>
        )}
      </div>
      {status === "missing" ? (
        <p className="mt-1.5 pl-3.5 text-[12px] leading-5 text-muted-foreground">{emptyHint}</p>
      ) : (
        <>
          <p
            className={cn(
              "mt-1.5 whitespace-pre-wrap pl-3.5 text-[12.5px] leading-5 text-foreground/90",
              long && !expanded && "line-clamp-3",
            )}
          >
            {value}
          </p>
          {long && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              className="mt-1 pl-3.5 text-[11px] font-medium text-primary hover:underline"
            >
              {expanded ? "Show less" : "Read the full text"}
            </button>
          )}
        </>
      )}
    </li>
  )
}

// ─── AI segments ──────────────────────────────────────────────────────────────

function StageChip({ artifact }: { artifact: AIArtifact }) {
  const st = ARTIFACT_STATUS[artifact.status]
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-foreground">
      <span className={cn("size-1.5 rounded-full", st.dot)} aria-hidden />
      {artifact.label}
    </span>
  )
}

function StageRow({ artifact }: { artifact: AIArtifact }) {
  const [open, setOpen] = useState(false)
  const st = ARTIFACT_STATUS[artifact.status]
  const when = new Date(artifact.at)
  return (
    <li className="rounded-lg border border-border/70 bg-background">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Sparkles className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-foreground">
          {artifact.label}
        </span>
        {artifact.model && (
          <span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground sm:inline">
            {artifact.model}
          </span>
        )}
        <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[9px] font-semibold", st.chip)}>
          {st.label}
        </span>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
          {when.getUTCHours().toString().padStart(2, "0")}:
          {when.getUTCMinutes().toString().padStart(2, "0")} UTC
        </span>
        <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="border-t border-border/70 px-3 py-2">
          {artifact.note && <p className="mb-1.5 text-[11px] leading-4 text-muted-foreground">{artifact.note}</p>}
          {artifact.rawText ? (
            <pre className="collab-scroll max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 px-2.5 py-2 font-mono text-[10.5px] leading-4 text-foreground/90">
              {artifact.rawText}
            </pre>
          ) : artifact.content != null ? (
            <pre className="collab-scroll max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 px-2.5 py-2 font-mono text-[10.5px] leading-4 text-foreground/90">
              {JSON.stringify(artifact.content, null, 2)}
            </pre>
          ) : (
            <p className="text-[11px] text-muted-foreground">This stage stored no readable output.</p>
          )}
        </div>
      )}
    </li>
  )
}
