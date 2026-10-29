"use client"

import { useState, useRef, useEffect, useMemo, useCallback, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CofounderMarkdown } from "@/components/cofounder/markdown"
import { CofounderWorklog, buildCofounderWorklogSteps } from "@/components/cofounder/cofounder-worklog"
import { PricingTierBuilder } from "@/components/collaborate/pricing-tier-builder"
import { ExpectedVisuals } from "@/components/collaborate/expected-visuals"
import { PlanIncubator } from "@/components/collaborate/plan-incubator"
import { BuilderReviewPanel, computeBriefCoverage } from "@/components/collaborate/builder-review"
import { AIOutputsPanel } from "@/components/collaborate/ai-outputs"
import { ProjectIdDialog } from "@/components/project-id-dialog"
import { postJson, patchJson, deleteJson, jsonFetcher, postNdjson } from "@/lib/client/api"
import { useVoiceDictation } from "@/lib/client/use-voice-dictation"
import { useSpeechReadout } from "@/lib/client/use-speech-readout"
import { plainTextFromMarkdown } from "@/lib/client/speech-text"
import type { AIArtifact } from "@/lib/types/ai-artifacts"
import {
  readErrorCode,
  trackPlanApproved,
  trackPlanApprovalFailed,
  trackPlanReady,
} from "@/lib/analytics/start-funnel"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { Project, ProjectEvent } from "@/lib/types/project"
import type { ProjectChat, ProjectChatSummary } from "@/lib/types/collab-chat"
import type { ApplicationSpecification } from "@/lib/types/specification"
import { buildJourneySteps } from "@/lib/workspace/workspace-view-model"
import { cn } from "@/lib/utils"
import { PLAN_SECTIONS, computePlanHealth, sectionStatus, getPlanSection, isPlaceholderValue, applySectionUpdate, clearSectionUpdate, TEXT_PLAN_SECTIONS, calculatePlanQuality, calculateSectionQuality, type PlanSectionId, type PlanSectionDef } from "@/lib/analysis/plan-sections"
import type { PlanAnalysis, PlanProposal } from "@/lib/types/plan-analysis"
import { SECTION_DEPENDENCIES } from "@/lib/types/plan-analysis"
import {
  Lightbulb,
  Puzzle,
  Wrench,
  Telescope,
  Users,
  Star,
  Compass,
  Zap,
  GitBranch,
  Database,
  Hammer,
  KeyRound,
  Search,
  Briefcase,
  Coins,
  PlugZap,
  PenLine,
  Sparkles,
  Rocket,
  ClipboardList,
  DollarSign,
  Palette,
  Monitor,
  Mic,
  ArrowUp,
  Loader2,
  Plus,
  X,
  History,
  ChevronDown,
  SquarePen,
  Pencil,
  Trash2,
  Check,
  Copy,
  Volume2,
  VolumeX,
  Square,
  RotateCcw,
  Tag,
  Target,
  UserCog,
  Server,
  Cable,
  PenTool,
  Smartphone,
  SunMoon,
  Type,
  Megaphone,
  TrendingUp,
  Layers,
  FileText,
  type LucideIcon,
} from "lucide-react"

/** Plan-section icons ship as lucide names from the section registry; this
 * map keeps the client render in sync with those names. */
const SECTION_ICONS: Record<string, LucideIcon> = {
  Lightbulb,
  Puzzle,
  Wrench,
  Telescope,
  Users,
  Star,
  Compass,
  Zap,
  GitBranch,
  Database,
  KeyRound,
  Search,
  Briefcase,
  Coins,
  PlugZap,
  DollarSign,
  Palette,
  Monitor,
  Tag,
  Target,
  UserCog,
  Server,
  Cable,
  PenTool,
  Smartphone,
  SunMoon,
  Type,
  Megaphone,
  Rocket,
  TrendingUp,
  Layers,
  ListChecks: ClipboardList,
}

function SectionIcon({ name, className }: { name: string; className?: string }) {
  const Icon = SECTION_ICONS[name] ?? Lightbulb
  return <Icon className={className} aria-hidden />
}

// ─── Local helpers ────────────────────────────────────────────────────────────

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ")
}

/**
 * Keep the workspace inside the visible viewport. iOS never shrinks the layout
 * viewport when the keyboard opens, so a dvh-locked shell hides the composer
 * behind it; visualViewport does shrink, so driving the shell height from it
 * makes the transcript, composer and tab bar ride above the keyboard.
 */
function useViewportLockedShell() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    // 1px of slack absorbs rounding between the visual and layout viewport,
    // which otherwise leaves the bottom control a hair below the fold.
    const sync = () => {
      // A narrowed vv.width means the customer pinch-zoomed rather than opened
      // the keyboard, and the layout viewport doesn't scale with it — dvh is
      // the honest height there.
      if (vv.width < window.innerWidth - 1) {
        root.style.removeProperty("--collab-viewport-height")
        return
      }
      root.style.setProperty("--collab-viewport-height", `${Math.floor(vv.height) - 1}px`)
    }
    sync()
    vv.addEventListener("resize", sync)
    vv.addEventListener("scroll", sync)
    return () => {
      vv.removeEventListener("resize", sync)
      vv.removeEventListener("scroll", sync)
      root.style.removeProperty("--collab-viewport-height")
    }
  }, [])
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

// ─── Plan-aware affordances (chat ⇆ plan) ───────────────────────────────
/** The order a brand-new plan should be filled in — the first three define
 * the product, the rest is where the money is. The builder downstream can
 * only start from these. */
const STARTER_SECTION_ORDER: PlanSectionId[] = [
  "overview",
  "problem",
  "solution",
  "targetUsers",
  "features",
  "revenueModel",
]

/** Phrases that pin a chat answer to a plan section, for the jump chips.
 * Deliberately specific — generic words like "features" alone would light up
 * on almost every answer the co-founder writes. */
const SECTION_MENTION_TERMS: Array<{ id: PlanSectionId; terms: string[] }> = [
  { id: "revenueModel", terms: ["revenue model", "monetization", "monetisation", "how you make money"] },
  { id: "pricingTiers", terms: ["pricing tier", "pricing structure", "price points"] },
  { id: "businessModel", terms: ["business model"] },
  { id: "features", terms: ["key features", "core features", "feature set"] },
  { id: "flows", terms: ["user flow"] },
  { id: "data", terms: ["data model"] },
  { id: "auth", terms: ["accounts & access", "authentication", "sign-in flow"] },
  { id: "backend", terms: ["backend & api", "api layer"] },
  { id: "integrations", terms: ["integration"] },
  { id: "targetUsers", terms: ["target customers", "target audience", "target users"] },
  { id: "userRoles", terms: ["user roles", "role-based access"] },
  { id: "valueProposition", terms: ["value proposition"] },
  { id: "vision", terms: ["vision", "mission", "purpose statement", "problem statement", "core problem", "solution idea"] },
  { id: "marketPositioning", terms: ["market positioning"] },
  { id: "marketingPlan", terms: ["marketing plan", "go-to-market", "launch plan", "growth plan", "growth loop"] },
  { id: "designDirection", terms: ["design direction", "brand identity", "visual identity", "visual system", "typography", "theme & appearance", "color palette", "responsive"] },
  { id: "seo", terms: ["seo"] },
]

/** Up to three plan sections referenced by an assistant answer, in the order
 * the answer touches them — for the "Jump to" chips under the reply. */
function detectSectionMentions(text: string): PlanSectionId[] {
  if (!text) return []
  const lowered = text.toLowerCase()
  const ids: PlanSectionId[] = []
  for (const { id, terms } of SECTION_MENTION_TERMS) {
    if (terms.some((term) => lowered.includes(term))) {
      ids.push(id)
      if (ids.length >= 3) break
    }
  }
  return ids
}

function SectionJumpChips({ ids, onOpen }: { ids: PlanSectionId[]; onOpen?: (id: PlanSectionId) => void }) {
  if (!ids.length || !onOpen) return null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Jump to</span>
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onOpen(id)}
          className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <Compass className="size-3" aria-hidden />
          {getPlanSection(id)?.label ?? id}
        </button>
      ))}
    </div>
  )
}

// ─── Proposal word diff ──────────────────────────────────────────────────────

interface DiffToken {
  text: string
  kind: "same" | "added" | "removed"
}

/** Diffing whole section values is O(n²) in words — past this, show the plain
 * views instead of risking multi-second hitches or a huge allocation. */
const MAX_DIFF_TOKENS = 1200

const wordKey = (token: string): string => token.trim().toLowerCase()

function splitWords(text: string): string[] {
  return text.match(/\S+\s*/g) ?? []
}

/** Word-level diff between the current and proposed section value (LCS).
 * The shared head and tail are trimmed first, so a typical proposal that
 * rewrites one paragraph diffs tiny. Returns null when either side is too
 * large to diff cheaply, or when there is no current value to compare. */
function diffProposal(current: string, proposed: string): DiffToken[] | null {
  if (!current?.trim() || !proposed?.trim()) return null
  const a = splitWords(current)
  const b = splitWords(proposed)
  let start = 0
  while (start < a.length && start < b.length && wordKey(a[start]) === wordKey(b[start])) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && wordKey(a[endA - 1]) === wordKey(b[endB - 1])) {
    endA--
    endB--
  }
  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)
  if (midA.length > MAX_DIFF_TOKENS || midB.length > MAX_DIFF_TOKENS) return null

  const width = midB.length + 1
  // LCS can't exceed the smaller side, which the cap above keeps under 2^16.
  const lcs = new Uint16Array((midA.length + 1) * width)
  for (let i = midA.length - 1; i >= 0; i--) {
    for (let j = midB.length - 1; j >= 0; j--) {
      lcs[i * width + j] = wordKey(midA[i]) === wordKey(midB[j])
        ? lcs[(i + 1) * width + j + 1] + 1
        : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1])
    }
  }

  const out: DiffToken[] = []
  const push = (text: string, kind: DiffToken["kind"]) => {
    const last = out[out.length - 1]
    if (last && last.kind === kind) last.text += text
    else out.push({ text, kind })
  }
  for (let k = 0; k < start; k++) push(a[k], "same")
  let i = 0
  let j = 0
  while (i < midA.length && j < midB.length) {
    if (wordKey(midA[i]) === wordKey(midB[j])) {
      push(midB[j], "same")
      i++
      j++
    } else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
      push(midA[i], "removed")
      i++
    } else {
      push(midB[j], "added")
      j++
    }
  }
  for (; i < midA.length; i++) push(midA[i], "removed")
  for (; j < midB.length; j++) push(midB[j], "added")
  for (let k = endA; k < a.length; k++) push(a[k], "same")
  return out
}

/** An inline view of a proposal diff: green is text the proposal adds, struck
 * red is what it removes from the current value. */
function ProposalDiffView({ diff }: { diff: DiffToken[] }) {
  return (
    <div className="collab-scroll mt-1 max-h-[60dvh] overflow-y-auto rounded-lg border border-primary/20 bg-background px-3 py-2 sm:max-h-none">
      <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
        {diff.map((token, index) =>
          token.kind === "same" ? (
            <span key={index}>{token.text}</span>
          ) : token.kind === "added" ? (
            <span key={index} className="rounded-sm bg-emerald-500/15 px-0.5 text-emerald-700 dark:text-emerald-300">
              {token.text}
            </span>
          ) : (
            <span
              key={index}
              className="rounded-sm bg-red-500/10 px-0.5 text-red-600 line-through decoration-red-500/50 dark:text-red-400"
            >
              {token.text}
            </span>
          ),
        )}
      </p>
      <p className="mt-2 border-t border-border/60 pt-1.5 text-[10px] text-muted-foreground">
        Green is new; struck-through red is what the proposal removes. Nothing changes until you accept.
      </p>
    </div>
  )
}

interface QuickAction {
  label: string
  prompt: string
}

/** Quick actions that adapt to where the plan actually stands: a section in
 * focus gets its own prompt, flagged analysis gaps become fix-it chips, and
 * missing sections become drafting prompts — always grounded in what a plan
 * needs before the builders can start. */
function buildQuickActions(
  spec: ApplicationSpecification,
  analysis: PlanAnalysis | null,
  activeDef: PlanSectionDef | null,
): QuickAction[] {
  const actions: QuickAction[] = []
  if (activeDef) {
    actions.push({
      label: `Improve ${activeDef.label}`,
      prompt: `Draft a stronger ${activeDef.label} section for my plan, and explain the tradeoffs of your version.`,
    })
  }
  const findings = analysis?.findings ?? []
  if (findings.length > 0) {
    actions.push({
      label: `Fix ${findings.length} flagged gap${findings.length === 1 ? "" : "s"}`,
      prompt: `Go through the gaps flagged in my plan analysis, most important first, and draft a concrete fix for each — grounded in what is already in my plan.`,
    })
  }
  const missing = computePlanHealth(spec).missing
  const drafting: PlanSectionId[] = []
  for (const id of [...STARTER_SECTION_ORDER, ...missing]) {
    if (!missing.includes(id) || drafting.includes(id)) continue
    drafting.push(id)
    if (drafting.length >= 2) break
  }
  for (const id of drafting) {
    const label = getPlanSection(id)?.label ?? id
    actions.push({
      label: `Draft the ${label.toLowerCase()}`,
      prompt: `Draft the ${label} section of my plan from what my idea and my existing sections tell you. If you need anything from me, ask up to three short questions first.`,
    })
  }
  if (missing.length === 0) {
    actions.push({
      label: "Is my plan build-ready?",
      prompt: `Review my complete plan end to end as the team that will build it: what is still ambiguous or missing — anything that would force the builders to guess?`,
    })
  }
  // Top up with the evergreen starters, never duplicating a chip above.
  for (const qa of QUICK_ACTIONS) {
    if (actions.length >= 5) break
    if (actions.some((existing) => existing.prompt === qa.prompt)) continue
    actions.push(qa)
  }
  return actions.slice(0, 5)
}

// ─── Left panel: MY PLAN ──────────────────────────────────────────────────────

function PlanNav({
  spec,
  activeSection,
  onSelect,
  analysis,
  forMobile,
  outputsCount = 0,
  outputsActive = false,
  onOpenOutputs,
  reviewCount = 0,
  reviewActive = false,
  onOpenReview,
}: {
  spec: ApplicationSpecification
  activeSection: PlanSectionId | null
  onSelect: (id: PlanSectionId) => void
  analysis: PlanAnalysis | null
  /** Phone tab: wider gutters and 40px rows so every section is tappable. */
  forMobile?: boolean
  /** Number of captured AI responses to surface in the outputs entry. */
  outputsCount?: number
  outputsActive?: boolean
  onOpenOutputs?: () => void
  /** Sections of the plan that travel in the launch brief, for the review entry. */
  reviewCount?: number
  reviewActive?: boolean
  onOpenReview?: () => void
}) {
  const health = useMemo(() => computePlanHealth(spec), [spec])
  // A nearly empty plan is a wall of missing sections — surface the first
  // three on the recommended path so there is an obvious place to start.
  const starters = useMemo(() => {
    const missingSet = new Set<string>(health.missing)
    return STARTER_SECTION_ORDER.filter((id) => missingSet.has(id)).slice(0, 3)
  }, [health])
  const definedCount = health.sections.filter((s) => s.status !== "missing").length
  const showStarters = starters.length > 0 && health.percent < 20
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
    <div className={cx("flex flex-col gap-5", forMobile ? "p-3" : "p-4")}>
      {showStarters && (
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
          <h3 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-primary">
            Start here
          </h3>
          <p className="mt-1.5 text-sm leading-5 text-foreground">
            {definedCount === 0
              ? "The builder can't start from an empty plan — answer these first and every other section becomes easier."
              : "A good start already — these three unlock the most of the remaining plan."}
          </p>
          <div className="mt-3 flex flex-col gap-1.5">
            {starters.map((id, index) => (
              <button
                key={id}
                onClick={() => onSelect(id)}
                className="flex min-h-10 items-center gap-2.5 rounded-lg border border-primary/25 bg-background px-3 py-2 text-left text-sm text-foreground transition-colors hover:border-primary/50 hover:bg-accent"
              >
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/15 font-mono text-[10px] font-bold text-primary">
                  {index + 1}
                </span>
                <Compass className="size-3.5 shrink-0 text-primary" aria-hidden />
                <span className="flex-1 truncate">Define {getPlanSection(id)?.label?.toLowerCase() ?? id}</span>
              </button>
            ))}
          </div>
        </div>
      )}
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
                const qualityScore = calculateSectionQuality(def.id, spec)
                const flags = findingBySection.get(def.id) ?? 0
                const active = activeSection === def.id
                return (
                  <li key={def.id}>
                    <button
                      onClick={() => onSelect(def.id)}
                      aria-current={active ? "true" : undefined}
                      className={cx(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                        forMobile && "min-h-11",
                        active
                          ? "bg-primary/10 font-medium text-foreground ring-1 ring-primary/30"
                          : "text-foreground/80 hover:bg-muted",
                      )}
                    >
                      <SectionIcon name={def.icon} className="size-4 shrink-0" />
                      <span className="flex-1 truncate">{def.label}</span>
                      {qualityScore > 0 && status !== "missing" && (
                        <span
                          className={cx(
                            "rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold",
                            qualityScore >= 75 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" :
                              qualityScore >= 60 ? "bg-blue-500/15 text-blue-600 dark:text-blue-400" :
                                "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          )}
                          title={`Quality score: ${qualityScore}%`}
                        >
                          {qualityScore}%
                        </span>
                      )}
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

      {onOpenReview && (
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
          <button
            onClick={onOpenReview}
            aria-current={reviewActive ? "true" : undefined}
            className={cx(
              "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
              forMobile && "min-h-11",
              reviewActive
                ? "bg-primary/15 font-medium text-foreground ring-1 ring-primary/40"
                : "text-foreground/80 hover:bg-primary/10",
            )}
          >
            <Hammer className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="flex-1 truncate">Builder review</span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[9px] font-semibold text-muted-foreground">
              {reviewCount}
            </span>
          </button>
          <p className="px-2 pt-1 text-[11px] leading-4 text-muted-foreground">
            The whole plan, the AI answers behind it, and the exact brief the builder is sent at launch.
          </p>
        </div>
      )}

      {onOpenOutputs && (
        <div className="rounded-xl border border-border bg-card p-3">
          <button
            onClick={onOpenOutputs}
            aria-current={outputsActive ? "true" : undefined}
            className={cx(
              "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
              forMobile && "min-h-11",
              outputsActive
                ? "bg-primary/10 font-medium text-foreground ring-1 ring-primary/30"
                : "text-foreground/80 hover:bg-muted",
            )}
          >
            <FileText className="size-4 shrink-0" aria-hidden />
            <span className="flex-1 truncate">AI outputs</span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[9px] font-semibold text-muted-foreground">
              {outputsCount}
            </span>
          </button>
          <p className="px-2 pt-1 text-[11px] leading-4 text-muted-foreground">
            Every response the AI produced — including raw text when parsing failed.
          </p>
        </div>
      )}
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
  onSave,
  /** Draft lives at the root so switching sections never loses unsaved text. */
  draft,
  onDraftChange,
  projectId,
  userCredits,
  onCreditsUpdated,
}: {
  spec: ApplicationSpecification
  sectionId: PlanSectionId
  onWorkOnThis: () => void
  onClose: () => void
  canEdit: boolean
  /** Persist an edited section value through the validated PATCH endpoint. */
  onSave: (section: PlanSectionId, value: string) => Promise<boolean>
  draft: string
  onDraftChange: (value: string) => void
  projectId: string
  userCredits: number
  onCreditsUpdated: (newBalance: number) => void
}) {
  const def = getPlanSection(sectionId)
  // Hooks must run before any early return (rules of hooks).
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const editRef = useRef<HTMLTextAreaElement>(null)
  // Deferred escape action (close/section switch) resumed if the founder
  // chooses to discard their unsaved draft.
  const pendingActionRef = useRef<(() => void) | null>(null)

  const qualityScore = useMemo(() => calculateSectionQuality(sectionId, spec), [sectionId, spec])
  const sectionContent = useMemo(() => {
    if (!def) return ""
    const read = def.read(spec)
    return typeof read === "string" ? read : ""
  }, [def, spec])
  const wordCount = useMemo(() => {
    return sectionContent.trim().split(/\s+/).filter(w => w.length > 0).length
  }, [sectionContent])

  useEffect(() => {
    if (editing) editRef.current?.focus()
  }, [editing])

  // Switching sections resets edit mode — the unsaved draft itself is kept
  // (held by the parent), so returning to the section restores the text.
  useEffect(() => {
    setEditing(false)
    setConfirmClose(false)
  }, [sectionId])

  if (!def) return null
  const raw = def.read(spec)
  const missing = !raw || isPlaceholderValue(raw)
  const status = missing ? "missing" : "complete"
  // Baseline is what the section holds right now — empty when the section has
  // no content yet (the generator placeholder never counts as a draft).
  const baseline = missing ? "" : raw.trim()
  const dirty = editing && draft.trim() !== baseline

  function startEditing() {
    onDraftChange(missing ? "" : raw)
    setEditing(true)
  }

  /** The only escape paths that would abandon a dirty draft — Close, and the
   * section switch coming from the plan nav — route through here so the
   * founder gets one chance to keep their text. */
  function requestClose(callback: () => void) {
    if (dirty) {
      pendingActionRef.current = callback
      setConfirmClose(true)
      return
    }
    callback()
  }

  function confirmDiscard() {
    setConfirmClose(false)
    setEditing(false)
    onDraftChange("")
    pendingActionRef.current?.()
    pendingActionRef.current = null
  }

  function confirmKeepEditing() {
    setConfirmClose(false)
    pendingActionRef.current = null
  }

  async function save() {
    const value = draft.trim()
    if (!value || saving) return
    setSaving(true)
    try {
      // A failed save must keep the editor open with the draft intact — the
      // founder's text is never silently discarded on an error.
      const saved = await onSave(sectionId, value)
      if (!saved) return
      setEditing(false)
      onDraftChange("")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <SectionIcon name={def.icon} className="size-4.5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{def.label}</h2>
            <span className={cx("rounded-full border px-2 py-0.5 text-[10px] font-medium", STATUS_STYLES[status])}>
              {STATUS_LABELS[status]}
            </span>
            {qualityScore > 0 && status !== "missing" && (
              <span
                className={cx(
                  "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  qualityScore >= 75 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" :
                    qualityScore >= 60 ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" :
                      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                )}
                title="Quality score based on depth and completeness"
              >
                Quality: {qualityScore}%
              </span>
            )}
            {wordCount > 0 && (
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground" title="Word count">
                {wordCount} words
              </span>
            )}
            {dirty && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                Unsaved changes
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{def.group}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:justify-end">
          {canEdit && !editing && (
            <button
              onClick={startEditing}
              className="min-h-10 flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent sm:flex-none sm:min-h-0"
            >
              <PenLine className="mr-1 inline size-3.5" aria-hidden /> Edit
            </button>
          )}
          <button
            onClick={() => requestClose(onClose)}
            className="min-h-10 flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:flex-none sm:min-h-0"
          >
            Close
          </button>
        </div>
      </div>

      {editing ? (
        sectionId === "pricingTiers" ? (
          <div className="space-y-3">
            <PricingTierBuilder
              value={draft}
              onChange={onDraftChange}
              readonly={false}
            />
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center">
              <button
                onClick={save}
                disabled={saving || !draft.trim()}
                className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 sm:min-h-0"
              >
                {saving ? "Saving…" : "Save to plan"}
              </button>
              <button
                onClick={() => requestClose(() => setEditing(false))}
                disabled={saving}
                className="min-h-11 rounded-lg border border-border bg-background px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent disabled:opacity-40 sm:min-h-0"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <textarea
              ref={editRef}
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => {
                // Esc = abandon edit — confirms first when the founder's draft
                // is dirty; a plain Enter inserts a newline.
                if (e.key === "Escape") {
                  e.preventDefault()
                  requestClose(() => setEditing(false))
                }
              }}
              rows={12}
              placeholder={`Write the ${def.label.toLowerCase()} for your plan…`}
              aria-label={`Edit ${def.label} section`}
              className="collab-scroll max-h-[70dvh] w-full resize-y rounded-xl border border-primary/40 bg-background px-4 py-3 text-base leading-6 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 sm:max-h-none sm:text-sm"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={save}
                disabled={saving || !draft.trim()}
                className="min-h-11 flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 sm:min-h-0 sm:flex-none"
              >
                {saving ? "Saving…" : "Save to plan"}
              </button>
              <button
                onClick={() => requestClose(() => setEditing(false))}
                disabled={saving}
                className="min-h-11 flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent disabled:opacity-40 sm:min-h-0 sm:flex-none"
              >
                Cancel
              </button>
              <span className="w-full font-mono text-[10px] text-muted-foreground sm:ml-auto sm:w-auto sm:text-right">{draft.trim().length}/8000</span>
            </div>
          </div>
        )
      ) : missing ? (
        <>
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center sm:p-6">
          <p className="text-sm font-medium text-foreground">Not defined yet.</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{def.emptyHint}</p>
          {canEdit && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
              <button
                onClick={() => requestClose(onWorkOnThis)}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:min-h-0"
              >
                <Sparkles className="size-4" aria-hidden /> Work on this with AI
              </button>
              <button
                onClick={startEditing}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent sm:min-h-0"
              >
                <PenLine className="size-4" aria-hidden /> Write it myself
              </button>
            </div>
          )}
        </div>

        {/* Expected Visuals — every segment gets a visuals area, even empty ones */}
        {canEdit && (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <ExpectedVisuals
              projectId={projectId}
              sectionId={sectionId}
              sectionLabel={def.label}
              userCredits={userCredits}
              onCreditsUpdated={onCreditsUpdated}
            />
          </div>
        )}
        </>
      ) : (
        <>
          {sectionId === "pricingTiers" && raw ? (
            <div className="space-y-3">
              <PricingTierBuilder
                value={raw}
                onChange={() => { }}
                readonly={true}
              />
              <div className="rounded-xl border border-border bg-card p-4">
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
                    View as markdown
                  </summary>
                  <div className="mt-3">
                    <CofounderMarkdown>{raw}</CofounderMarkdown>
                  </div>
                </details>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-5">
              <CofounderMarkdown>{raw}</CofounderMarkdown>
            </div>
          )}

          {/* Expand with AI button - show when section exists but quality could improve */}
          {canEdit && qualityScore < 75 && qualityScore > 0 && (
            <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-start gap-3">
                <Sparkles className="size-4 shrink-0 text-primary mt-0.5" aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">Want more detail?</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                    Ask your AI co-founder to expand specific parts of this section with more depth and examples.
                  </p>
                </div>
                <button
                  onClick={() => requestClose(onWorkOnThis)}
                  className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Expand with AI
                </button>
              </div>
            </div>
          )}

          {/* Expected Visuals - available for all sections with content */}
          {canEdit && (
            <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
              <ExpectedVisuals
                projectId={projectId}
                sectionId={sectionId}
                sectionLabel={def.label}
                userCredits={userCredits}
                onCreditsUpdated={onCreditsUpdated}
              />
            </div>
          )}
        </>
      )}

      {!editing && canEdit && !missing && (
        <p className="text-[11px] text-muted-foreground">
          Prefer brainstorming first? Ask your co-founder in the chat — proposed changes always land here for your review
          before anything is saved.
        </p>
      )}

      {/* One chance to keep a dirty draft before any abandoning escape. */}
      <AlertDialog open={confirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You edited {def.label} but haven&apos;t saved it. Your draft will be lost if you leave now.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={confirmKeepEditing}>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDiscard}>Discard draft</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  const [showRaw, setShowRaw] = useState(false)
  const [showDiff, setShowDiff] = useState(false)
  const [draft, setDraft] = useState(proposal.proposedValue)
  const def = getPlanSection(proposal.section)
  // A word-level view of what the proposal would actually change — the
  // side-by-side clamp hides single-paragraph rewrites behind "…more".
  const diff = useMemo(
    () => (proposal.currentValue ? diffProposal(proposal.currentValue, proposal.proposedValue) : null),
    [proposal],
  )
  const diffAvailable = Boolean(diff?.some((token) => token.kind !== "same"))

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
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Suggested</p>
          {!editing && (
            <div className="flex items-center gap-2">
              {!showRaw && diffAvailable && (
                <button
                  onClick={() => setShowDiff((v) => !v)}
                  className="text-[10px] font-semibold uppercase tracking-widest text-primary/80 transition-colors hover:text-primary"
                >
                  {showDiff ? "Show formatted" : "Show what changed"}
                </button>
              )}
              {!showDiff && (
                <button
                  onClick={() => { setShowRaw((v) => !v); setShowDiff(false) }}
                  className="text-[10px] font-semibold uppercase tracking-widest text-primary/80 transition-colors hover:text-primary"
                >
                  {showRaw ? "Show formatted" : "Show raw"}
                </button>
              )}
            </div>
          )}
        </div>
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            className="mt-1 max-h-[60dvh] w-full resize-y rounded-lg border border-primary/40 bg-background px-3 py-2 text-base leading-6 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 sm:max-h-none sm:text-sm"
            aria-label="Edit suggested value"
          />
        ) : showRaw ? (
          <p className="mt-1 whitespace-pre-wrap rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm leading-6 text-foreground">
            {proposal.proposedValue}
          </p>
        ) : showDiff && diff ? (
          <ProposalDiffView diff={diff} />
        ) : (
          <div className="mt-1 rounded-lg border border-primary/20 bg-background px-3 py-2">
            <CofounderMarkdown>{proposal.proposedValue}</CofounderMarkdown>
          </div>
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
              className="min-h-10 flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 sm:flex-none sm:py-1.5"
            >
              Save to plan
            </button>
            <button
              onClick={() => { setEditing(false); setDraft(proposal.proposedValue) }}
              className="min-h-10 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground hover:bg-accent sm:flex-none sm:py-1.5"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onAccept(proposal.proposedValue)}
              disabled={busy}
              className="min-h-10 flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 sm:flex-none sm:py-1.5"
            >
              Add to Plan
            </button>
            <button
              onClick={() => setEditing(true)}
              disabled={busy}
              className="min-h-10 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground hover:bg-accent disabled:opacity-40 sm:flex-none sm:py-1.5"
            >
              Edit
            </button>
            <button
              onClick={onReject}
              disabled={busy}
              className="min-h-10 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground hover:bg-accent disabled:opacity-40 sm:flex-none sm:py-1.5"
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
  /** The co-founder is still writing this answer. */
  streaming?: boolean
  /** The founder stopped this reply — it ends where they stopped listening. */
  stopped?: boolean
  /** The provider ran out of output tokens, so this answer stops mid-thought. */
  truncated?: boolean
}

function formatChatTime(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

const QUICK_ACTIONS = [
  { label: "What should I improve?", prompt: "What should I improve in my plan right now, and why?" },
  { label: "Find gaps", prompt: "Find the gaps in my plan — what's missing that should be defined before I move forward?" },
  { label: "Challenge my assumptions", prompt: "Challenge my assumptions: what am I taking for granted that deserves a second look?" },
  { label: "Improve my business model", prompt: "How can I strengthen my business model and revenue approach?" },
  { label: "What's next?", prompt: "Based on where my plan stands, what's the single best thing to work on next?" },
]

/** Under-message tools: hear the reply, carry it off, or ask the same question
 * again. Retry is labelled with its cost on purpose — it re-sends the founder's
 * message as a fresh turn and is charged like any other message. */
function ChatMessageActions({
  role,
  text,
  busy,
  canRetry,
  copied,
  speaking,
  speechSupported,
  onCopy,
  onReadAloud,
  onRetry,
}: {
  role: "user" | "assistant"
  text: string
  busy: boolean
  canRetry: boolean
  copied: boolean
  speaking: boolean
  speechSupported: boolean
  onCopy: () => void
  onReadAloud: () => void
  onRetry: () => void
}) {
  const tool =
    "grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
  const empty = !text.trim()
  return (
    <div className={cx("flex flex-wrap items-center gap-0.5", role === "user" ? "justify-end" : "justify-start")}>
      <button
        type="button"
        onClick={onCopy}
        disabled={empty}
        aria-label="Copy this message"
        title={copied ? "Copied" : "Copy"}
        className={tool}
      >
        {copied ? <Check className="size-3.5 text-primary" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      </button>
      {role === "assistant" ? (
        <>
          <button
            type="button"
            onClick={onReadAloud}
            disabled={!speechSupported || busy || empty}
            aria-label={speaking ? "Stop reading this reply aloud" : "Read this reply aloud"}
            aria-pressed={speaking}
            title={
              !speechSupported
                ? "Reading aloud isn’t available in this browser"
                : speaking
                  ? "Stop reading"
                  : "Read aloud"
            }
            className={cn(tool, speaking && "bg-primary/10 text-primary")}
          >
            {speaking ? <VolumeX className="size-3.5" aria-hidden /> : <Volume2 className="size-3.5" aria-hidden />}
          </button>
          {canRetry ? (
            <button
              type="button"
              onClick={onRetry}
              disabled={busy}
              aria-label="Ask the co-founder again — this uses credits like a new message"
              title="Ask again (uses credits)"
              className={cn(tool, "h-8 w-auto gap-1.5 rounded-lg px-2 text-[11px] font-medium")}
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Retry
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function ChatPanel({
  projectId,
  isOwner,
  spec,
  activeSection,
  onSpecChanged,
  analysis,
  onOpenSection,
}: {
  projectId: string
  isOwner: boolean
  spec: ApplicationSpecification
  activeSection: PlanSectionId | null
  onSpecChanged: (spec: ApplicationSpecification) => void
  /** Plan analysis findings — the quick actions quote what was flagged. */
  analysis: PlanAnalysis | null
  /** Tap a plan section mentioned in a reply to open it in the plan panel. */
  onOpenSection?: (id: PlanSectionId) => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chats, setChats] = useState<ProjectChatSummary[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [chatsLoading, setChatsLoading] = useState(true)
  const [chatsError, setChatsError] = useState<string | null>(null)
  const [chatLoading, setChatLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState("")
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [chatActionError, setChatActionError] = useState<string | null>(null)
  const activeChatKey = `atai:collab-chat:${projectId}`
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const promptMenuRef = useRef<HTMLDetailsElement>(null)
  const dictation = useVoiceDictation({ value: input, setValue: setInput })
  const readout = useSpeechReadout()
  const abortRef = useRef<AbortController | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [includeSection, setIncludeSection] = useState(true)
  const [lastRun, setLastRun] = useState<{ id: number; message: string; section: PlanSectionId | null } | null>(null)
  const [worklogVisible, setWorklogVisible] = useState(false)
  const draftKey = `atai:collab-draft:${projectId}`

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [messages, sending])

  // Hold the finished worklog briefly so the founder sees every step complete
  // before the transcript takes over; hide it at once if the request failed.
  useEffect(() => {
    if (sending) {
      setWorklogVisible(true)
      return
    }
    if (!worklogVisible) return
    const timer = window.setTimeout(() => setWorklogVisible(false), 900)
    return () => window.clearTimeout(timer)
  }, [sending, worklogVisible])

  // Keep the composer's context chip re-armed when the founder switches
  // sections — dismissing context is a per-section decision, not permanent.
  useEffect(() => {
    setIncludeSection(true)
  }, [activeSection])

  // Drafts survive tab switches (the mobile chat panel unmounts) and page
  // navigations, but never leave a stale message after it is sent.
  const draftRestored = useRef(false)
  useEffect(() => {
    if (!draftRestored.current) {
      draftRestored.current = true
      try {
        const saved = window.localStorage.getItem(draftKey)
        if (saved) {
          setInput(saved)
          return
        }
      } catch {
        // Storage can be unavailable (private mode / disabled cookies).
      }
    }
    try {
      if (input) window.localStorage.setItem(draftKey, input)
      else window.localStorage.removeItem(draftKey)
    } catch {
      // Ignore quota/security errors — the composer still works in-memory.
    }
  }, [draftKey, input])

  // Grow to fit the message, then scroll — one line on load, compact on
  // every viewport, never taller than ~7 lines on a phone.
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    // scrollHeight is 0 while the desktop panel is display:none on mobile —
    // keep the intrinsic single-row height instead of collapsing to 0px.
    el.style.height = el.scrollHeight ? `${Math.min(el.scrollHeight, 168)}px` : ""
  }, [input])

  // Opening a different conversation shouldn't leave the previous reply
  // talking over it.
  useEffect(() => {
    readout.stop()
  }, [activeChatId, readout.stop])

  const contextSection = includeSection ? activeSection : null

  // ── Conversation history ────────────────────────────────────────────────
  // Threads live in the project's own store, so history survives navigation
  // and remounts. The open thread is mirrored to localStorage so the founder
  // lands back on the conversation they were reading.

  const rememberActiveChat = useCallback(
    (chatId: string | null) => {
      try {
        if (chatId) window.localStorage.setItem(activeChatKey, chatId)
        else window.localStorage.removeItem(activeChatKey)
      } catch {
        // Storage can be unavailable (private mode / disabled cookies).
      }
    },
    [activeChatKey],
  )

  const refreshChatList = useCallback(async () => {
    try {
      const data = await jsonFetcher<{ chats: ProjectChatSummary[] }>(`/api/projects/${projectId}/chats`)
      setChats(data.chats ?? [])
      setChatsError(null)
      return data.chats ?? []
    } catch (e) {
      setChatsError(e instanceof Error ? e.message : "Could not load conversation history.")
      return []
    } finally {
      setChatsLoading(false)
    }
  }, [projectId])

  const loadChat = useCallback(
    async (chatId: string) => {
      setChatLoading(true)
      setChatActionError(null)
      try {
        const data = await jsonFetcher<{ chat: ProjectChat }>(`/api/projects/${projectId}/chats/${chatId}`)
        setMessages(
          data.chat.messages
            .filter((m) => m.role !== "system")
            .map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content })),
        )
        setActiveChatId(data.chat.id)
        rememberActiveChat(data.chat.id)
        setHistoryOpen(false)
        return true
      } catch (e) {
        setChatActionError(e instanceof Error ? e.message : "Could not open that conversation.")
        return false
      } finally {
        setChatLoading(false)
      }
    },
    [projectId, rememberActiveChat],
  )

  // Restore the last-open conversation (or the newest one) on mount.
  useEffect(() => {
    let cancelled = false
    // A project switch must never show the previous project's transcript.
    setMessages([])
    setActiveChatId(null)
    setChatsLoading(true)
    ;(async () => {
      const list = await refreshChatList()
      if (cancelled) return
      let saved: string | null = null
      try {
        saved = window.localStorage.getItem(activeChatKey)
      } catch {
        // Ignore storage failures — pick the newest thread instead.
      }
      const target = saved && list.some((c) => c.id === saved) ? saved : list[0]?.id ?? null
      if (target) {
        const opened = await loadChat(target)
        if (!opened && !cancelled && saved && saved !== list[0]?.id) {
          // The remembered thread is gone (deleted elsewhere) — fall back.
          rememberActiveChat(null)
          if (list[0]) await loadChat(list[0].id)
        }
      }
      if (cancelled) return
      setChatsLoading(false)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const startNewChat = useCallback(() => {
    setMessages([])
    setActiveChatId(null)
    setError(null)
    setChatActionError(null)
    setHistoryOpen(false)
    rememberActiveChat(null)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [rememberActiveChat])

  // Escape backs out of the drawer (an in-progress rename cancels first).
  useEffect(() => {
    if (!historyOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      if (renamingId) {
        setRenamingId(null)
        return
      }
      setHistoryOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [historyOpen, renamingId])

  const beginRename = useCallback((chat: ProjectChatSummary) => {
    setChatActionError(null)
    setRenamingId(chat.id)
    setRenameDraft(chat.title)
  }, [])

  const submitRename = useCallback(
    async (chatId: string) => {
      const title = renameDraft.replace(/\s+/g, " ").trim()
      if (!title) {
        setChatActionError("Give the conversation a name.")
        return
      }
      setRenamingId(null)
      setChatActionError(null)
      // The server bumps updatedAt on rename, so mirror it (and the newest-
      // first order) instead of letting the row jump on the next refresh.
      setChats((prev) =>
        prev
          .map((c) => (c.id === chatId ? { ...c, title, updatedAt: Date.now() } : c))
          .sort((a, b) => b.updatedAt - a.updatedAt),
      )
      try {
        await patchJson(`/api/projects/${projectId}/chats/${chatId}`, { title })
      } catch (e) {
        setChatActionError(e instanceof Error ? e.message : "Could not rename that conversation.")
        void refreshChatList()
      }
    },
    [projectId, renameDraft, refreshChatList],
  )

  const removeChat = useCallback(
    async (chatId: string) => {
      setConfirmDeleteId(null)
      setChatActionError(null)
      try {
        await deleteJson(`/api/projects/${projectId}/chats/${chatId}`)
        setChats((prev) => prev.filter((c) => c.id !== chatId))
        if (chatId === activeChatId) {
          setMessages([])
          setActiveChatId(null)
          rememberActiveChat(null)
        }
        toast.success("Conversation deleted.")
      } catch (e) {
        setChatActionError(e instanceof Error ? e.message : "Could not delete that conversation.")
        void refreshChatList()
      }
    },
    [projectId, activeChatId, rememberActiveChat, refreshChatList],
  )

  const activeSummary = activeChatId ? chats.find((c) => c.id === activeChatId) : undefined
  const activeTitle = activeChatId ? activeSummary?.title ?? "Conversation" : "New conversation"
  const activeMeta = activeChatId
    ? `${activeSummary?.messageCount ?? messages.length} message${
        (activeSummary?.messageCount ?? messages.length) === 1 ? "" : "s"
      }${activeSummary ? ` · ${formatChatTime(activeSummary.updatedAt)}` : ""}`
    : "History is saved with this project"

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || sending || !isOwner || chatsLoading || chatLoading) return
      dictation.stop()
      // A new question ends the last one — no half-read reply talking over
      // fresh prose while the founder is trying to read it.
      readout.stop()
      setInput("")
      setError(null)
      setLastRun({ id: Date.now(), message: trimmed, section: contextSection })
      const localId = `local-${Date.now()}`
      setMessages((prev) => [...prev, { id: localId, role: "user", content: trimmed }])
      setSending(true)
      const controller = new AbortController()
      abortRef.current = controller
      // The reply bubble is created by the first words that land, so the staged
      // worklog owns the waiting state and never competes with half an answer.
      let bubbleId: string | null = null
      const showDelta = (delta: string) => {
        if (!bubbleId) {
          bubbleId = `a-${Date.now()}`
          const id = bubbleId
          setMessages((prev) => [...prev, { id, role: "assistant", content: delta, streaming: true }])
          return
        }
        const id = bubbleId
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: m.content + delta } : m)))
      }
      try {
        const data = await postNdjson<{
          proposal?: PlanProposal | null
          truncated?: boolean
        }>(
          `/api/projects/${projectId}/plan-chat`,
          {
            message: trimmed,
            activeSection: contextSection,
            chatId: activeChatId ?? undefined,
            newChat: !activeChatId,
            stream: true,
          },
          {
            onDelta: showDelta,
            onMeta: (frame) => {
              // A brand-new thread exists as soon as the server says so, so the
              // founder can switch tabs mid-answer without losing it.
              const chatId = typeof frame.chatId === "string" ? frame.chatId : null
              if (chatId && chatId !== activeChatId) {
                setActiveChatId(chatId)
                rememberActiveChat(chatId)
              }
            },
            // Stop cancels the founder's turn at the server, not just here.
            signal: controller.signal,
          },
        )
        if (bubbleId) {
          const id = bubbleId
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id
                ? {
                    ...m,
                    streaming: false,
                    proposal: data.proposal ?? null,
                    truncated: data.truncated === true,
                  }
                : m,
            ),
          )
        } else if (data.proposal) {
          // A reply that was only the plan-update block: the card is the answer.
          setMessages((prev) => [
            ...prev,
            { id: `a-${Date.now()}`, role: "assistant", content: "", proposal: data.proposal },
          ])
        }
        void refreshChatList()
      } catch (e) {
        const id = bubbleId
        const code = (e as Error & { code?: string }).code
        if (code === "STOPPED") {
          // The server saw the disconnect and settled the turn: it keeps what
          // the founder already read and refunds a stop before the first word.
          if (id) {
            setMessages((prev) =>
              prev.map((m) => (m.id === id ? { ...m, streaming: false, stopped: true } : m)),
            )
            toast("Stopped.", { description: "What already arrived stays in this conversation." })
          } else {
            setInput((cur) => (cur ? cur : trimmed))
            toast("Stopped before the co-founder answered.", {
              description: "Nothing arrived, so no credits were kept.",
            })
          }
        } else {
          if (id) setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, streaming: false } : m)))
          // Never lose a message to a failed request — put it back in the
          // composer unless the founder already saw an answer (or has started
          // typing again).
          if (!id) setInput((cur) => (cur ? cur : trimmed))
          if (code === "CHAT_NOT_FOUND") {
            // The thread was removed elsewhere; the next send starts a new one.
            setActiveChatId(null)
            rememberActiveChat(null)
            void refreshChatList()
          }
          setError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
        }
      } finally {
        abortRef.current = null
        setSending(false)
      }
    },
    [
      sending,
      isOwner,
      chatsLoading,
      chatLoading,
      projectId,
      contextSection,
      dictation.stop,
      readout.stop,
      activeChatId,
      rememberActiveChat,
      refreshChatList,
    ],
  )

  // Enter / Send include the phrase currently being spoken — the interim
  // transcript isn't in the field until SpeechRecognition finalizes it.
  const handleSend = useCallback(() => {
    const pending = dictation.listening ? dictation.partial.trim() : ""
    const text = [input.trim(), pending].filter(Boolean).join(" ")
    if (!text) return
    if (sending) {
      // Enter used to swallow this keystroke; say so instead of losing it.
      toast("The co-founder is still answering.", {
        description: "Press Stop to cut the reply short, then send this again.",
      })
      return
    }
    void send(text)
  }, [input, dictation.listening, dictation.partial, send, sending])

  // Stop is the escape hatch on a 30–90s free-tier wait: the fetch is cut here
  // and the route's stream is cancelled there, so the provider request stops
  // rather than finishing for a tab that walked away.
  const stopTurn = useCallback(() => {
    readout.stop()
    abortRef.current?.abort()
  }, [readout.stop])

  const copyMessage = useCallback(async (id: string, text: string) => {
    const value = plainTextFromMarkdown(text)
    if (!value) {
      toast.error("Nothing to copy from that message.")
      return
    }
    try {
      await navigator.clipboard.writeText(value)
      setCopiedId(id)
      window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1800)
    } catch {
      toast.error("Copy failed", { description: "The browser blocked clipboard access." })
    }
  }, [])

  // Retry re-sends the founder's own message as a fresh turn — the server
  // charges it like any other message, and the earlier reply stays in the
  // thread unless it is an empty placeholder nothing ever answered.
  const retryReply = useCallback(
    (assistantId: string) => {
      if (sending) return
      const at = messages.findIndex((m) => m.id === assistantId)
      if (at < 0) return
      let prompt: string | null = null
      for (let i = at - 1; i >= 0; i -= 1) {
        if (messages[i].role === "user") {
          prompt = messages[i].content
          break
        }
      }
      if (!prompt) {
        toast("That reply has no question left to repeat.")
        return
      }
      const bubble = messages[at]
      if (!bubble.content.trim() && !bubble.proposal) {
        setMessages((prev) => prev.filter((m) => m.id !== assistantId))
      }
      void send(prompt)
    },
    [messages, sending, send],
  )

  const retryLastRun = useCallback(() => {
    if (sending) return
    const last = messages[messages.length - 1]
    if (last?.role === "assistant" && !last.content.trim() && !last.proposal) {
      setMessages((prev) => prev.filter((m) => m.id !== last.id))
    }
    const prompt =
      lastRun?.message ??
      [...messages].reverse().find((m) => m.role === "user")?.content
    if (prompt) void send(prompt)
  }, [sending, messages, lastRun, send])

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

  const worklogSteps = useMemo(
    () =>
      lastRun
        ? buildCofounderWorklogSteps({
            message: lastRun.message,
            section: lastRun.section
              ? getPlanSection(lastRun.section)?.label ?? lastRun.section
              : null,
            surface: "plan",
          })
        : [],
    [lastRun],
  )

  // Quick actions adapt to where the plan actually stands — focused section,
  // flagged gaps, missing drafting targets — instead of five static prompts.
  const suggestions = useMemo(
    () => buildQuickActions(spec, analysis, activeDef ?? null),
    [spec, analysis, activeDef],
  )

  // Fill the composer instead of sending, appending to an existing draft so
  // the founder can review and edit before pressing send.
  const insertPrompt = useCallback((prompt: string) => {
    promptMenuRef.current?.removeAttribute("open")
    setInput((cur) => (cur.trim() ? `${cur.trimEnd()} ${prompt}` : prompt))
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    })
  }, [])

  const onComposerKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    // IME composition (e.g. Chinese input) must own Enter until it commits.
    if (event.nativeEvent.isComposing) return
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    } else if (event.key === "Escape") {
      if (dictation.listening) dictation.stop()
      else event.currentTarget.blur()
    }
  }

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
    // flex-1 (not h-full): fills the space left by the pinned launch button
    // instead of pushing it out of the clipped column.
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Conversation header — history, active thread, new conversation */}
      <div className="flex items-center gap-1 border-b border-border bg-background px-3 py-2 sm:px-4">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setHistoryOpen((open) => !open)
              setRenamingId(null)
              setChatActionError(null)
            }}
            aria-expanded={historyOpen}
            aria-label="Conversation history"
            title="Conversation history"
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              historyOpen && "bg-accent text-foreground",
            )}
          >
            <History className="size-4" aria-hidden />
          </button>
          <div className="min-w-0 flex-1 px-0.5">
            <p className="truncate text-xs font-medium text-foreground">{activeTitle}</p>
            <p className="truncate text-[10px] text-muted-foreground">{activeMeta}</p>
          </div>
          <button
            type="button"
            onClick={startNewChat}
            disabled={sending || chatLoading || chatsLoading}
            aria-label="New conversation"
            title="New conversation"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <SquarePen className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Conversation */}
      <div className="min-h-0 flex-1 overflow-y-auto collab-scroll px-3 py-4 sm:px-5 sm:py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          {/* Intro — lightweight, no AI call on load (spec section 15).
              Context-aware: when the founder is working on a section, the
              intro speaks to that section instead of generic onboarding. */}
          {(chatLoading || (chatsLoading && messages.length === 0)) && (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground" role="status">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Opening conversation…
            </div>
          )}

          {messages.length === 0 && !chatLoading && !chatsLoading && (
            <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
              <h2 className="text-base font-semibold text-foreground sm:text-lg">Your AI Co-Founder</h2>
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
                {suggestions.map((qa) => (
                  <button
                    key={qa.label}
                    onClick={() => send(qa.prompt)}
                    title={qa.prompt}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-accent"
                  >
                    {qa.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={cx("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}>
              {m.role === "assistant" ? (
                <div className="w-full">
                  <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    <Sparkles className="size-3 text-primary" aria-hidden />
                    Co-founder
                  </p>
                  <div className="text-sm leading-6 text-foreground" aria-busy={m.streaming ? true : undefined}>
                    <CofounderMarkdown>{m.content}</CofounderMarkdown>
                    {m.streaming && (
                      <span
                        className="ml-0.5 inline-block h-4 w-[3px] translate-y-0.5 rounded-full bg-primary motion-reduce:hidden"
                        aria-hidden
                      />
                    )}
                    {m.truncated && (
                      <p className="mt-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                        This answer stops part-way short of the full thought — ask me to continue and
                        I&apos;ll finish it.
                      </p>
                    )}
                    {m.stopped && (
                      <p className="mt-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                        You stopped this reply, so it ends part-way through.
                      </p>
                    )}
                  </div>
                  {!m.streaming && (
                    <SectionJumpChips ids={detectSectionMentions(m.content)} onOpen={onOpenSection} />
                  )}
                  {m.streaming ? null : (
                    <ChatMessageActions
                      role="assistant"
                      text={m.content}
                      busy={sending}
                      canRetry
                      copied={copiedId === m.id}
                      speaking={readout.speakingId === m.id}
                      speechSupported={readout.supported}
                      onCopy={() => void copyMessage(m.id, m.content)}
                      onReadAloud={() => {
                        if (!readout.toggle(m.id, m.content)) {
                          toast("Nothing to read aloud in that reply.")
                        }
                      }}
                      onRetry={() => retryReply(m.id)}
                    />
                  )}
                </div>
              ) : (
                <div className="flex max-w-[92%] flex-col items-end gap-0.5">
                  <div className="text-right">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
                      You
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/80">{m.content}</p>
                  </div>
                  <ChatMessageActions
                    role="user"
                    text={m.content}
                    busy={false}
                    canRetry={false}
                    copied={copiedId === m.id}
                    speaking={false}
                    speechSupported={readout.supported}
                    onCopy={() => void copyMessage(m.id, m.content)}
                    onReadAloud={() => {}}
                    onRetry={() => {}}
                  />
                </div>
              )}
              {m.proposal && (
                <div className="w-full">
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

          {lastRun && worklogVisible && !error && !messages.some((m) => m.streaming) ? (
            <CofounderWorklog key={lastRun.id} steps={worklogSteps} active={sending} />
          ) : null}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive" role="alert">
              <p>{error}</p>
              <button
                type="button"
                onClick={retryLastRun}
                disabled={sending}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-background px-2.5 py-1.5 font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RotateCcw className="size-3.5" aria-hidden />
                Try again (uses credits)
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-background px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="mx-auto w-full max-w-2xl">
          {dictation.listening && (
            <div
              className="voice-panel mb-2 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2"
              role="status"
              aria-live="polite"
            >
              <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-primary/10">
                <span className="voice-halo absolute inset-0 rounded-full border border-primary/40" aria-hidden />
                <span className="flex h-4 items-end gap-[3px]" aria-hidden>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className="voice-bar w-[3px] rounded-full bg-primary"
                      style={{
                        height: `${Math.max(4, Math.min(18, 5 + dictation.level * 64 + (i % 2 === 0 ? 3 : 0)))}px`,
                      }}
                    />
                  ))}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                  Listening
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {dictation.partial ? (
                    <>
                      {dictation.partial}
                      <span
                        className="voice-caret ml-0.5 inline-block h-3 w-px translate-y-0.5 bg-primary align-middle"
                        aria-hidden
                      />
                    </>
                  ) : (
                    "Speak — each phrase lands in the box as you finish it."
                  )}
                </span>
              </span>
              <button
                type="button"
                onClick={dictation.stop}
                className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-foreground"
              >
                Stop
              </button>
            </div>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault()
              handleSend()
            }}
            className={cn(
              "rounded-2xl border border-border bg-muted/30 transition-[border-color,box-shadow] focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15",
              dictation.listening && "border-primary/50 ring-2 ring-primary/15",
            )}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => dictation.typeText(e.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder={
                dictation.listening
                  ? "Listening — speak now…"
                  : activeDef
                    ? `Ask about ${activeDef.label}…`
                    : "Ask your co-founder anything about the plan…"
              }
              rows={1}
              maxLength={8000}
              aria-label="Message your AI co-founder"
              aria-describedby="collab-composer-hint"
              className="block max-h-[168px] w-full resize-none overflow-y-auto bg-transparent px-3.5 pb-1 pt-3 text-base leading-6 placeholder:text-muted-foreground focus:outline-none sm:text-sm"
            />
            <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
              <details
                ref={promptMenuRef}
                className="relative"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    promptMenuRef.current?.removeAttribute("open")
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return
                  promptMenuRef.current?.removeAttribute("open")
                  promptMenuRef.current?.querySelector("summary")?.focus()
                }}
              >
                <summary
                  aria-label="Suggested prompts"
                  title="Suggested prompts"
                  className="grid size-9 cursor-pointer list-none place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&::-webkit-details-marker]:hidden"
                >
                  <Sparkles className="size-4" aria-hidden />
                </summary>
                <div className="absolute bottom-full left-0 z-20 mb-2 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg">
                  <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Suggested prompts
                  </p>
                  {suggestions.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => insertPrompt(item.prompt)}
                      className="block w-full rounded-lg px-2.5 py-2 text-left text-xs leading-5 text-foreground transition-colors hover:bg-accent"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </details>
              <button
                type="button"
                onClick={dictation.toggle}
                disabled={sending}
                aria-pressed={dictation.listening}
                aria-label={dictation.listening ? "Stop voice input" : "Voice input"}
                className={cn(
                  "relative grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40",
                  dictation.listening &&
                    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                )}
              >
                {dictation.listening ? (
                  <span className="voice-halo absolute inset-0 rounded-xl border border-primary/50" aria-hidden />
                ) : null}
                <Mic className="size-4" />
              </button>
              {activeDef ? (
                includeSection ? (
                  <span className="ml-0.5 inline-flex h-9 min-w-0 items-center gap-0.5 rounded-xl bg-primary/10 pl-2 pr-0.5 text-[11px] font-medium text-primary">
                    <span className="max-w-24 truncate sm:max-w-44">{activeDef.label}</span>
                    <button
                      type="button"
                      onClick={() => setIncludeSection(false)}
                      aria-label={`Stop including ${activeDef.label} in the context`}
                      title="Remove section context"
                      className="grid size-6 shrink-0 place-items-center rounded-lg transition-colors hover:bg-primary/15"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIncludeSection(true)}
                    title="Send this section as context"
                    className="ml-0.5 inline-flex h-9 min-w-0 items-center gap-1 rounded-xl px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Plus className="size-3.5 shrink-0" aria-hidden />
                    <span className="max-w-20 truncate sm:max-w-40">{activeDef.label}</span>
                  </button>
                )
              ) : null}
              <div className="flex-1" />
              {input.length > 7600 && (
                <span className="pr-1 font-mono text-[10px] tabular-nums text-muted-foreground" aria-live="polite">
                  {input.length}/8000
                </span>
              )}
              {sending ? (
                <button
                  type="button"
                  onClick={stopTurn}
                  aria-label="Stop the co-founder"
                  title="Stop — cancels this reply"
                  className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-background text-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Square className="size-3.5 fill-current" aria-hidden />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={chatLoading || chatsLoading || (!input.trim() && !dictation.partial.trim())}
                  aria-label="Send message"
                  className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowUp className="size-4" aria-hidden />
                </button>
              )}
            </div>
          </form>
          {dictation.error && (
            <p role="alert" className="mt-1.5 px-1 text-xs text-destructive">
              {dictation.error}
            </p>
          )}
          <p id="collab-composer-hint" className="mt-1.5 truncate text-center text-[10px] text-muted-foreground">
            Enter to send · Shift+Enter for a new line · Tap the mic to dictate · Small credit cost per message
          </p>
        </div>
      </div>

      {/* History drawer — project-scoped memory, rename/delete inline */}
      {historyOpen && (
        <div
          className="absolute inset-0 z-30 flex flex-col bg-background"
          role="dialog"
          aria-modal="true"
          aria-label="Conversation history"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Project memory</p>
              <p className="text-xs font-medium text-foreground">
                {chats.length} conversation{chats.length === 1 ? "" : "s"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setHistoryOpen(false)}
              aria-label="Close conversation history"
              className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <div className="border-b border-border p-2">
            <button
              type="button"
              onClick={startNewChat}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-accent"
            >
              <SquarePen className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-foreground">New conversation</span>
                <span className="block text-[10px] text-muted-foreground">
                  Clean slate — your plan stays in context
                </span>
              </span>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto collab-scroll p-2">
            {chatsLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground" role="status">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Loading history…
              </div>
            ) : chatsError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
                {chatsError}
                <button
                  type="button"
                  onClick={() => {
                    setChatsLoading(true)
                    void refreshChatList()
                  }}
                  className="ml-1 underline underline-offset-2"
                >
                  Retry
                </button>
              </div>
            ) : chats.length === 0 ? (
              <p className="px-3 py-10 text-center text-xs text-muted-foreground">
                No conversations yet. Your first message starts one.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {chats.map((chat) => (
                  <li
                    key={chat.id}
                    className={cn(
                      "rounded-xl border p-2.5 transition-colors",
                      chat.id === activeChatId
                        ? "border-primary/30 bg-primary/5"
                        : "border-transparent hover:bg-accent/60",
                    )}
                  >
                    {renamingId === chat.id ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault()
                          void submitRename(chat.id)
                        }}
                        className="flex items-center gap-1"
                      >
                        <input
                          autoFocus
                          value={renameDraft}
                          onChange={(event) => setRenameDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.preventDefault()
                              setRenamingId(null)
                            }
                          }}
                          maxLength={80}
                          aria-label="Conversation name"
                          className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-base text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15 sm:h-8 sm:text-xs"
                        />
                        <button
                          type="submit"
                          aria-label="Save name"
                          className="grid size-10 shrink-0 place-items-center rounded-lg text-primary transition-colors hover:bg-primary/10 sm:size-8"
                        >
                          <Check className="size-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenamingId(null)}
                          aria-label="Cancel rename"
                          className="grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:size-8"
                        >
                          <X className="size-4" aria-hidden />
                        </button>
                      </form>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => void loadChat(chat.id)}
                          disabled={chatLoading}
                          className="block w-full text-left disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                              {chat.title}
                            </span>
                            <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                              {formatChatTime(chat.updatedAt)}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                            {chat.preview ?? "No messages yet"}
                          </span>
                          <span className="mt-1 block text-[10px] text-muted-foreground/80">
                            {chat.messageCount} message{chat.messageCount === 1 ? "" : "s"}
                          </span>
                        </button>
                        <div className="mt-1.5 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => beginRename(chat)}
                            className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:min-h-0 sm:text-[10px]"
                          >
                            <Pencil className="size-3" aria-hidden />
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(chat.id)}
                            className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive sm:min-h-0 sm:text-[10px]"
                          >
                            <Trash2 className="size-3" aria-hidden />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {chatActionError && (
              <p role="alert" className="mt-2 px-2 text-xs text-destructive">
                {chatActionError}
              </p>
            )}
          </div>
        </div>
      )}

      <AlertDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              The messages in this conversation are removed permanently. Your plan and its accepted changes are
              untouched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDeleteId) void removeChat(confirmDeleteId)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Header: plan status chip (plan quality now lives here, not in the chat column) ──

const QUALITY_TONES = {
  excellent: { text: "text-emerald-600 dark:text-emerald-400" },
  good: { text: "text-blue-600 dark:text-blue-400" },
  acceptable: { text: "text-amber-600 dark:text-amber-400" },
  needs_work: { text: "text-orange-600 dark:text-orange-400" },
}

function PlanStatusChip({ state, spec }: { state: string; spec: ApplicationSpecification }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const health = useMemo(() => computePlanHealth(spec), [spec])
  const quality = useMemo(() => calculatePlanQuality(spec), [spec])
  const tone = QUALITY_TONES[quality.readinessLevel]

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  const stateLabel = state === "plan_ready" ? "Plan ready" : state.replace(/_/g, " ")

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((cur) => !cur)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2 py-1 font-mono text-[10px] text-primary transition-colors hover:bg-primary/10 sm:px-3 sm:text-xs"
      >
        <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-primary" />
        <span className="truncate">{stateLabel}</span>
        <span className={cx("flex shrink-0 items-center gap-0.5 border-l border-current/20 pl-1.5 font-semibold", tone.text)}>
          <Star className="size-3" aria-hidden />
          {quality.overallScore}%
        </span>
        <ChevronDown className={cx("size-3 shrink-0 opacity-60 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Plan quality details"
          className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-3 shadow-xl"
        >
          <p className={cx("text-xs font-semibold", tone.text)}>
            Plan quality {quality.overallScore}% · {quality.readinessLevel.replace("_", " ")}
          </p>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{quality.readinessMessage}</p>

          {quality.sectionsWithIssues.length > 0 && (
            <>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Sections needing more detail
              </p>
              <div className="mt-1.5 flex flex-col gap-1">
                {quality.sectionsWithIssues.slice(0, 6).map((section) => (
                  <div key={section.id} className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="min-w-0 truncate text-muted-foreground">{section.label}</span>
                    <span className="shrink-0 font-mono text-muted-foreground">{section.score}%</span>
                  </div>
                ))}
                {quality.sectionsWithIssues.length > 6 && (
                  <p className="text-[10px] text-muted-foreground">+{quality.sectionsWithIssues.length - 6} more sections</p>
                )}
              </div>
            </>
          )}

          {health.missing.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2" role="status">
              <p className="text-[11px] font-medium leading-4 text-amber-600 dark:text-amber-400">
                {health.missing.length} plan section{health.missing.length === 1 ? "" : "s"} still undefined — you can build
                anyway, but a fuller plan gives the builder more to work with.
              </p>
              <p className="mt-1 text-[10px] leading-4 text-amber-600/80 dark:text-amber-400/80">
                Missing: {health.missing.map((id) => getPlanSection(id)?.label ?? id).join(", ")}
              </p>
            </div>
          )}

          <p className="mt-3 border-t border-border pt-2 text-[10px] text-muted-foreground">
            Credits will be reserved when the build starts.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Launch (header CTA) ─────────────────────────────────────────────────────

function LaunchButton({
  projectId,
  projectName,
  requestedProjectId,
  projectMode,
  state,
  spec,
}: {
  projectId: string
  projectName: string
  requestedProjectId?: string
  projectMode: Project["mode"]
  state: string
  spec: ApplicationSpecification
}) {
  const router = useRouter()
  const [launching, setLaunching] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  if (state !== "plan_ready") return null

  async function handleLaunch(selectedProjectId: string) {
    if (launching) return
    setLaunching(true)
    try {
      await postJson(`/api/projects/${projectId}/launch`, { requestedProjectId: selectedProjectId })
      trackPlanApproved({
        projectId,
        projectMode,
        tier: spec.complexity,
        surface: "collaborate_launch",
      })
      toast.success("Build started — redirecting to your workspace…")
      try {
        sessionStorage.setItem(`atai.watch-build:${projectId}`, "1")
      } catch {
        // Storage blocked (private mode) — the workspace still shows its own build card.
      }
      router.push(`/project/${projectId}`)
      router.refresh()
    } catch (e) {
      trackPlanApprovalFailed({
        projectId,
        projectMode,
        tier: spec.complexity,
        surface: "collaborate_launch",
        errorCode: readErrorCode(e),
      })
      setLaunching(false)
      throw e
    }
  }

  return (
    <>
      <ProjectIdDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectName={projectName}
        initialProjectId={requestedProjectId}
        onConfirm={handleLaunch}
      />
      <button
        onClick={() => setDialogOpen(true)}
        disabled={launching}
        title="Credits will be reserved when the build starts."
        className="inline-flex min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {launching ? (
          "Starting build…"
        ) : (
          <>
            <Rocket className="size-3.5 shrink-0" aria-hidden />
            <span className="sm:hidden">Build</span>
            <span className="hidden sm:inline">Submit &amp; build</span>
          </>
        )}
      </button>
    </>
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
  ]

  // Cached analyses can predate the merged Marketing Plan section. Findings
  // and proposals that name a section the plan no longer has aren't actionable.
  const visibleFindings = (analysis?.findings ?? []).filter((f) => getPlanSection(f.section))
  const visibleProposals = (analysis?.proposals ?? []).filter((p) => getPlanSection(p.section))
  const gaps = visibleFindings.filter((f) => f.severity === "gap")
  const weaknesses = visibleFindings.filter((f) => f.severity === "weakness")
  const strengths = visibleFindings.filter((f) => f.severity === "strength")

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
              className="min-h-8 rounded-md px-2 text-[11px] text-primary hover:bg-accent hover:underline disabled:opacity-40"
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
                            className="mt-1.5 inline-flex min-h-8 items-center text-[11px] font-medium text-primary hover:underline"
                          >
                            Work on this →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ),
            )}
            {visibleProposals.length > 0 && (
              <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
                <p className="text-xs font-medium text-foreground">
                  This analysis includes {visibleProposals.length} suggested update{visibleProposals.length > 1 ? "s" : ""}.
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {visibleProposals.map((p) => (
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
          className="mt-1 max-h-[55dvh] w-full resize-y rounded-lg border border-primary/40 bg-background px-2.5 py-1.5 text-base leading-5 sm:max-h-none sm:text-xs"
          aria-label="Edit suggested value"
        />
      ) : (
        <p className="mt-1 line-clamp-3 text-xs leading-5 text-foreground">{proposal.proposedValue}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {mode === "editing" ? (
          <>
            <button onClick={accept} disabled={busy || !value.trim()} className="min-h-9 flex-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-40 sm:flex-none">
              Save
            </button>
            <button onClick={() => { setMode("view"); setValue(proposal.proposedValue) }} className="min-h-9 flex-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground sm:flex-none">
              Cancel
            </button>
          </>
        ) : (
          <>
            <button onClick={accept} disabled={busy} className="min-h-9 flex-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-40 sm:flex-none">
              Add to Plan
            </button>
            <button onClick={() => setMode("editing")} className="min-h-9 flex-1 rounded-md border border-border px-2 py-1 text-[11px] text-foreground sm:flex-none">
              Edit
            </button>
            <button onClick={reject} disabled={busy} className="min-h-9 flex-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground sm:flex-none">
              Reject
            </button>
            <button onClick={onWorkOn} className="min-h-9 flex-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground sm:flex-none">
              Discuss →
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Auto-complete: the co-founder fills the missing sections ───────────────

interface AutoSectionResult {
  id: string
  label: string
  status: "pending" | "working" | "done" | "failed" | "skipped"
  prevValue: string
}

interface AutoRunState {
  phase: "working" | "paused" | "done"
  results: AutoSectionResult[]
  remaining: Array<{ id: string; label: string }>
  totalCost: number
  sectionCost: number
  stoppedByUser?: boolean
  outOfCredits?: boolean
  failedCount: number
  doneCount: number
  /** True while the run applies the co-founder's existing suggestions. */
  suggestionsPhase?: boolean
}

interface AutoEstimate {
  missingSections: Array<{ id: string; label: string }>
  sectionCost: number
  totalCost: number
  availableCredits: number
  canAfford: boolean
  affordableSections: number
  suggestionsAvailable?: number
}

function AutoCompleteRunView({
  run,
  spec,
  onStop,
  onContinue,
  onDismiss,
  onOpenSection,
  onUndo,
  onDiscardAll,
  undoing,
}: {
  run: AutoRunState
  spec: ApplicationSpecification
  onStop: () => void
  onContinue: () => void
  onDismiss: () => void
  onOpenSection: (id: string) => void
  onUndo: (id: string) => void
  onDiscardAll: () => void
  undoing: string | null
}) {
  const working = run.results.find((r) => r.status === "working")
  const finished = run.phase !== "working"
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col overflow-y-auto collab-scroll px-3 py-4 sm:px-5 sm:py-6">
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <span
            className={cx(
              "inline-flex size-2 shrink-0 rounded-full",
              finished ? "bg-emerald-500" : "animate-pulse bg-primary",
            )}
            aria-hidden
          />
          <h2 className="text-sm font-semibold text-foreground">
            {run.phase === "working" && run.suggestionsPhase
              ? "Adding suggestions from your co-founder…"
              : run.phase === "working"
                ? "Your co-founder is working on your plan…"
                : run.phase === "paused"
                  ? "Paused — out of credits"
                  : run.stoppedByUser
                    ? "Stopped — your co-founder stepped back"
                    : run.failedCount > 0
                      ? "Finished — some sections need a retry"
                      : "Your co-founder finished the plan"}
          </h2>
        </div>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          {run.phase === "working" && run.suggestionsPhase
            ? "First, the improvements you two already discussed are going into the plan — then anything still missing gets drafted."
            : run.phase === "working"
              ? working
                ? `Drafting ${working.label} — grounded in everything already in your plan. You'll review each section when it's done.`
                : "Getting started…"
              : run.phase === "paused"
                ? `Completed ${run.doneCount} section${run.doneCount === 1 ? "" : "s"} before running out. Top up your credits and continue — ${run.remaining.length} section${run.remaining.length === 1 ? "" : "s"} left.`
                : run.failedCount > 0
                  ? `${run.doneCount} section${run.doneCount === 1 ? "" : "s"} drafted. ${run.failedCount} couldn't be completed — you can retry just those.`
                  : `All ${run.doneCount} missing section${run.doneCount === 1 ? "" : "s"} drafted and added to your plan. Review them below — undo or rewrite anything.`}
        </p>
      </div>

      <ul className="mt-4 flex flex-col gap-1.5" aria-label="Auto-complete progress">
        {run.results.map((r) => (
          <li
            key={r.id}
            className="flex flex-col rounded-lg border border-border bg-card px-3 py-2"
          >
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="w-4 shrink-0 text-center" aria-hidden>
                {r.status === "working" ? (
                  <span className="inline-block size-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                ) : r.status === "done" ? (
                  <span className="text-emerald-500">✓</span>
                ) : r.status === "failed" ? (
                  <span className="text-destructive">!</span>
                ) : r.status === "skipped" ? (
                  <span className="text-muted-foreground/60">–</span>
                ) : (
                  <span className="inline-block size-1.5 rounded-full bg-muted-foreground/30" />
                )}
              </span>
              <span
                className={cx(
                  "min-w-0 flex-1 basis-32 truncate text-sm",
                  r.status === "pending" || r.status === "skipped" ? "text-muted-foreground" : "text-foreground",
                  r.status === "working" && "font-medium",
                )}
              >
                {r.label}
                {r.status === "working" && <span className="ml-2 text-xs text-muted-foreground">drafting…</span>}
              </span>
              {r.status === "done" && (
                <span className="flex shrink-0 items-center gap-0.5">
                  <button
                    onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    aria-expanded={expanded === r.id}
                    className="min-h-8 rounded-md px-2 text-[11px] font-medium text-primary hover:bg-primary/10 hover:underline"
                  >
                    {expanded === r.id ? "Hide" : "Review"}
                  </button>
                  <button
                    onClick={() => onOpenSection(r.id)}
                    className="min-h-8 rounded-md px-2 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground hover:underline"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => onUndo(r.id)}
                    disabled={undoing === r.id}
                    className="min-h-8 rounded-md px-2 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground hover:underline disabled:opacity-40"
                  >
                    {undoing === r.id ? "Undoing…" : "Undo"}
                  </button>
                </span>
              )}
            </div>
            {expanded === r.id && (
              <p className="mt-2 whitespace-pre-wrap border-t border-border/60 pt-2 text-sm leading-6 text-muted-foreground">
                {getPlanSection(r.id)?.read(spec) ?? ""}
              </p>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {run.phase === "working" ? (
          <button
            onClick={onStop}
            className="min-h-11 w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:w-auto sm:min-h-0"
          >
            I&apos;ll take it from here
          </button>
        ) : run.phase === "paused" ? (
          <button
            onClick={onContinue}
            className="min-h-11 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto sm:min-h-0"
          >
            Continue ({run.remaining.length} left)
          </button>
        ) : (
          <>
            <button
              onClick={onDismiss}
              className="min-h-11 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto sm:min-h-0"
            >
              Back to my co-founder
            </button>
            {run.doneCount > 0 && (
              <button
                onClick={onDiscardAll}
                className="min-h-11 w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:w-auto sm:min-h-0"
              >
                Discard all drafted sections
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Root client ──────────────────────────────────────────────────────────────

interface SavedVisual {
  id: string
  imageUrl: string
  model: string
  creditsConsumed: number
  createdAt: Date | string
  prompt: string
}

export function CollaborateClient({
  projectId,
  initialProject,
  isOwner,
  initialCredits = 0,
}: {
  projectId: string
  initialProject: Project
  isOwner: boolean
  initialCredits?: number
}) {
  useViewportLockedShell()
  const [spec, setSpec] = useState<ApplicationSpecification | undefined>(initialProject.specification)
  const planReadyTrackedRef = useRef(false)
  const [analysis, setAnalysis] = useState<PlanAnalysis | null>(initialProject.planAnalysis ?? null)
  const [activeSection, setActiveSection] = useState<PlanSectionId | null>(null)
  // Every AI stage output captured for this project, plus a view flag for the
  // outputs panel (formatted ⇄ exact raw model text).
  const [artifacts, setArtifacts] = useState<AIArtifact[]>(initialProject.aiArtifacts ?? [])
  const [showOutputs, setShowOutputs] = useState(false)
  // The builder review is a third full-column view, mutually exclusive with
  // the outputs panel and the section editor.
  const [showReview, setShowReview] = useState(false)
  const [userCredits, setUserCredits] = useState(initialCredits)
  // When true, the chat is shown while a section is selected — the composer
  // shows the "Working on" chip and the AI receives the focus section.
  const [chatWithFocus, setChatWithFocus] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  // ── Auto-complete run state ──
  const [autoRun, setAutoRun] = useState<AutoRunState | null>(null)
  const [autoEstimate, setAutoEstimate] = useState<AutoEstimate | null>(null)
  const [autoConfirm, setAutoConfirm] = useState(false)
  const [estimateLoading, setEstimateLoading] = useState(false)
  const [undoingSection, setUndoingSection] = useState<string | null>(null)
  // The run view owns the workspace while a run is active; dismissed means
  // the founder stepped back to normal work after it ended.
  const [autoDismissed, setAutoDismissed] = useState(false)
  const [autoDiscardConfirm, setAutoDiscardConfirm] = useState(false)
  const autoStopRef = useRef(false)
  // Header slots for the auto-complete button, the live status chip and the
  // launch CTA — resolved after mount since the header is server-rendered.
  const [headerSlots, setHeaderSlots] = useState<{ actions: HTMLElement | null; statusXs: HTMLElement | null; statusSm: HTMLElement | null; launch: HTMLElement | null }>({ actions: null, statusXs: null, statusSm: null, launch: null })
  useEffect(() => {
    setHeaderSlots({
      actions: document.getElementById("collab-header-actions"),
      statusXs: document.getElementById("collab-header-status-xs"),
      statusSm: document.getElementById("collab-header-status-sm"),
      launch: document.getElementById("collab-header-launch"),
    })
  }, [])
  const [mobileView, setMobileView] = useState<"chat" | "plan" | "insights">("chat")
  /** Unsaved inline-editor drafts keyed by section — survives section
   * switches and mobile tab switches, so leaving mid-edit never loses text. */
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const setDraft = useCallback((section: string, value: string) => {
    setDrafts((prev) => {
      const next = { ...prev }
      if (value) next[section] = value
      else delete next[section]
      return next
    })
  }, [])
  const [projectState, setProjectState] = useState(initialProject.state)
  const [pipelineError, setPipelineError] = useState<string | null>(initialProject.error ?? null)
  const [pipelineNonce, setPipelineNonce] = useState(0)
  const [retryingPipeline, setRetryingPipeline] = useState(false)
  // Live snapshot of the record while the plan is still being produced — feeds
  // the same per-step model the workspace uses, so both surfaces agree.
  const [liveEvents, setLiveEvents] = useState<ProjectEvent[]>(initialProject.events ?? [])
  const [liveUpdatedAt, setLiveUpdatedAt] = useState(initialProject.updatedAt ?? Date.now())
  const [recovery, setRecovery] = useState(initialProject.pipelineRecovery ?? null)
  const [clock, setClock] = useState(() => Date.now())
  const [pollFailures, setPollFailures] = useState(0)
  const [pollError, setPollError] = useState<string | null>(null)
  const [retryNote, setRetryNote] = useState<string | null>(null)

  useEffect(() => {
    if (spec) return
    const id = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [spec])

  useEffect(() => {
    if (spec) return
    let cancelled = false
    let interval: number | undefined
    const stop = () => {
      if (interval !== undefined) window.clearInterval(interval)
      interval = undefined
    }
    async function tick() {
      try {
        const data = await jsonFetcher<{ project: Project }>(`/api/projects/${projectId}`)
        if (cancelled) return
        const next = data.project
        if (!next) return
        setPollFailures(0)
        setPollError(null)
        setLiveEvents(next.events ?? [])
        setLiveUpdatedAt(next.updatedAt ?? Date.now())
        setRecovery(next.pipelineRecovery ?? null)
        setArtifacts(next.aiArtifacts ?? [])
        if (next.specification) {
          setSpec(next.specification)
          stop()
          return
        }
        setProjectState(next.state)
        setPipelineError(next.error ?? null)
        // A failed step will not produce a plan on its own — stop polling and
        // let the founder retry instead of waiting forever.
        if (next.state === "analysis_failed" || next.state === "plan_failed") stop()
      } catch (e) {
        if (cancelled) return
        // Keep polling (the server may come back), but stop pretending the
        // wait is healthy once refreshes keep failing.
        setPollFailures((n) => n + 1)
        setPollError(e instanceof Error ? e.message : "We couldn't reach the server.")
      }
    }
    interval = window.setInterval(() => { void tick() }, 3000)
    void tick()
    return () => {
      cancelled = true
      stop()
    }
  }, [spec, projectId, pipelineNonce])

  const retryPipeline = useCallback(async () => {
    if (retryingPipeline) return
    setRetryingPipeline(true)
    setRetryNote(null)
    try {
      await postJson(`/api/projects/${projectId}/retry`, {})
      setPipelineError(null)
      setProjectState("analyzing")
      setLiveUpdatedAt(Date.now())
      setRecovery(null)
      setPipelineNonce((n) => n + 1)
      toast.success("Retrying — this page updates as soon as the plan is ready.")
    } catch (e) {
      const message = e instanceof Error ? e.message : "This step could not be retried."
      setRetryNote(message)
      toast.error(message)
    } finally {
      setRetryingPipeline(false)
    }
  }, [projectId, retryingPipeline])

  const refreshPolling = useCallback(() => {
    setPollFailures(0)
    setPollError(null)
    setPipelineNonce((n) => n + 1)
  }, [])

  // Funnel: the owner's plan became available for review.
  useEffect(() => {
    if (!isOwner || !spec || planReadyTrackedRef.current) return
    planReadyTrackedRef.current = true
    trackPlanReady({
      projectId,
      projectMode: initialProject.mode,
      tier: spec.complexity,
      projectCreatedAt: initialProject.createdAt,
    })
  }, [isOwner, spec, projectId, initialProject.mode, initialProject.createdAt])
  // Free estimate (no AI call, no charge) — refreshed whenever the plan
  // changes so the toolbar count and cost stay truthful.
  useEffect(() => {
    if (!isOwner) return
    let cancelled = false
    jsonFetcher<AutoEstimate>(`/api/projects/${projectId}/auto-complete`)
      .then((e) => {
        if (!cancelled) setAutoEstimate(e)
      })
      .catch(() => {
        /* toolbar simply shows nothing — never blocks the workspace */
      })
    return () => {
      cancelled = true
    }
  }, [isOwner, projectId, spec])

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

  /** Direct manual section save (inline editor) — same validated PATCH the
   * AI-proposal accept path uses, without an acceptedProposal id. The server
   * still authorizes, validates, prunes cached analysis findings for the
   * section, and writes the audit event. */
  const saveSection = useCallback(
    async (section: PlanSectionId, value: string): Promise<boolean> => {
      const label = getPlanSection(section)?.label ?? "Section"
      try {
        const data = await patchJson<{ project: Project }>(`/api/projects/${projectId}`, {
          sectionUpdate: { section, value },
        })
        if (!data.project?.specification) {
          toast.error(`${label} didn't come back from the server. Your draft is still open — try saving again.`)
          return false
        }
        setSpec(data.project.specification)
        if (data.project.planAnalysis !== undefined) setAnalysis(data.project.planAnalysis ?? null)
        toast.success(`${label} saved to your plan.`)
        return true
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update the plan. Please try again.")
        // Return false instead of throwing: SectionDetail keeps the editor open
        // and the draft intact, and there is no unhandled rejection in console.
        return false
      }
    },
    [projectId],
  )

  // ── Auto-complete run engine ──
  // One request per section (quality), each response re-reads the fresh spec
  // so earlier drafts ground later ones. The founder can stop at any time;
  // running out of credits pauses instead of failing silently.
  const runAutoComplete = useCallback(
    async (sections: Array<{ id: string; label: string }>, sectionCost: number) => {
      autoStopRef.current = false
      // Fresh run replaces the state; a resumed run (after out-of-credits or
      // a stop) keeps the finished sections visible and re-queues its own.
      setAutoRun((prev) =>
        prev
          ? {
            ...prev,
            phase: "working",
            stoppedByUser: false,
            outOfCredits: false,
            remaining: sections,
            sectionCost,
            totalCost: prev.totalCost + sections.length * sectionCost,
            results: prev.results.map((r) =>
              sections.some((s) => s.id === r.id) ? { ...r, status: "pending" } : r,
            ),
          }
          : {
            phase: "working",
            results: sections.map((s) => ({ id: s.id, label: s.label, status: "pending", prevValue: "" })),
            remaining: sections,
            sectionCost,
            totalCost: sections.length * sectionCost,
            failedCount: 0,
            doneCount: 0,
          },
      )
      setActiveSection(null)
      setChatWithFocus(false)

      // Phase 1 — the co-founder applies its own existing suggestions first
      // (free: no AI call, no credits). Whatever is still missing afterwards
      // goes to the AI, section by section.
      let queue = sections
      setAutoRun((prev) => (prev ? { ...prev, suggestionsPhase: true } : prev))
      try {
        const sugg = await postJson<{
          suggestions: Array<{ id: string; section: string; label: string; proposedValue: string }>
        }>(`/api/projects/${projectId}/auto-complete`, { action: "suggestions" })
        for (const s of sugg.suggestions) {
          if (autoStopRef.current) break
          if (!queue.some((q) => q.id === s.section)) continue
          setAutoRun((prev) =>
            prev
              ? {
                ...prev,
                results: prev.results.map((r) =>
                  r.id === s.section ? { ...r, status: "working" } : r,
                ),
              }
              : prev,
          )
          try {
            // Same validated PATCH as clicking Add on an insight card. The
            // proposal id marks it as AI-authored so list sections (features/
            // flows/data) keep their catalogs and record the prose as build
            // instructions.
            const data = await patchJson<{ project: Project }>(`/api/projects/${projectId}`, {
              sectionUpdate: { section: s.section, value: s.proposedValue, acceptedProposal: { id: s.id } },
            })
            if (data.project?.specification) setSpec(data.project.specification)
            queue = queue.filter((q) => q.id !== s.section)
            setAutoRun((prev) =>
              prev
                ? {
                  ...prev,
                  doneCount: prev.doneCount + 1,
                  results: prev.results.map((r) =>
                    r.id === s.section ? { ...r, status: "done" } : r,
                  ),
                }
                : prev,
            )
          } catch {
            // The suggestion didn't fit — leave the section in the queue so
            // the AI phase can draft it instead.
            setAutoRun((prev) =>
              prev
                ? {
                  ...prev,
                  failedCount: prev.failedCount + 1,
                  results: prev.results.map((r) =>
                    r.id === s.section ? { ...r, status: "failed" } : r,
                  ),
                }
                : prev,
            )
          }
        }
      } catch {
        // Couldn't fetch suggestions — the AI phase handles everything.
      }
      setAutoRun((prev) => (prev ? { ...prev, suggestionsPhase: false } : prev))

      for (let i = 0; i < queue.length; i++) {
        if (autoStopRef.current) {
          setAutoRun((prev) =>
            prev
              ? {
                ...prev,
                phase: "done",
                stoppedByUser: true,
                remaining: queue.slice(i),
                results: prev.results.map((r) =>
                  r.status === "pending" ? { ...r, status: "skipped" } : r,
                ),
              }
              : prev,
          )
          return
        }
        const target = queue[i]
        setAutoRun((prev) =>
          prev
            ? {
              ...prev,
              results: prev.results.map((r) =>
                r.id === target.id ? { ...r, status: "working" } : r,
              ),
            }
            : prev,
        )
        try {
          const data = await postJson<{
            section: string
            label: string
            value: string
            remainingSections: Array<{ id: string; label: string }>
          }>(`/api/projects/${projectId}/auto-complete`, { section: target.id })
          // Optimistic local apply — the server response is authoritative on
          // the next fetch; refresh keeps the session store in sync too.
          setSpec((prev) => (prev ? applySectionUpdate(prev, target.id as PlanSectionId, data.value) : prev))
          setAutoRun((prev) =>
            prev
              ? {
                ...prev,
                doneCount: prev.doneCount + 1,
                remaining: data.remainingSections,
                results: prev.results.map((r) =>
                  r.id === target.id ? { ...r, status: "done" } : r,
                ),
              }
              : prev,
          )
        } catch (err) {
          const code = (err as Error & { code?: string }).code
          if (code === "INSUFFICIENT_CREDITS") {
            setAutoRun((prev) =>
              prev
                ? {
                  ...prev,
                  phase: "paused",
                  outOfCredits: true,
                  remaining: queue.slice(i),
                  results: prev.results.map((r) =>
                    r.id === target.id ? { ...r, status: "skipped" } : r,
                  ),
                }
                : prev,
            )
            return
          }
          setAutoRun((prev) =>
            prev
              ? {
                ...prev,
                failedCount: prev.failedCount + 1,
                remaining: queue.slice(i + 1),
                results: prev.results.map((r) =>
                  r.id === target.id ? { ...r, status: "failed" } : r,
                ),
              }
              : prev,
          )
        }
      }

      setAutoRun((prev) => (prev && prev.phase === "working" ? { ...prev, phase: "done" } : prev))
    },
    [projectId],
  )

  const startAutoComplete = useCallback(async () => {
    if (estimateLoading || autoRun?.phase === "working") return
    setEstimateLoading(true)
    try {
      const estimate = await jsonFetcher<AutoEstimate>(`/api/projects/${projectId}/auto-complete`)
      setAutoEstimate(estimate)
      if (estimate.missingSections.length === 0) {
        toast("Your plan is already complete — nothing for your co-founder to fill in.")
        return
      }
      setAutoConfirm(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not check your plan.")
    } finally {
      setEstimateLoading(false)
    }
  }, [projectId, estimateLoading, autoRun])

  const confirmAutoComplete = useCallback(() => {
    if (!autoEstimate) return
    setAutoConfirm(false)
    setAutoDismissed(false)
    void runAutoComplete(autoEstimate.missingSections, autoEstimate.sectionCost)
  }, [autoEstimate, runAutoComplete])

  const undoAutoSection = useCallback(
    async (sectionId: string) => {
      const result = autoRun?.results.find((r) => r.id === sectionId)
      if (!result) return
      setUndoingSection(sectionId)
      try {
        // Undo restores "not defined" — the co-founder's draft is removed,
        // nothing else. No AI call, no credits involved.
        await postJson<{ cleared: boolean }>(`/api/projects/${projectId}/auto-complete`, {
          section: sectionId,
          action: "clear",
        })
        setSpec((prev) => (prev ? clearSectionUpdate(prev, sectionId as PlanSectionId) : prev))
        setAutoRun((prev) =>
          prev
            ? {
              ...prev,
              doneCount: Math.max(0, prev.doneCount - 1),
              results: prev.results.map((r) =>
                r.id === sectionId ? { ...r, status: "skipped" } : r,
              ),
            }
            : prev,
        )
        toast(`${getPlanSection(sectionId)?.label ?? "Section"} cleared — your co-founder's draft was removed.`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not undo this section.")
      } finally {
        setUndoingSection(null)
      }
    },
    [autoRun, projectId],
  )

  const discardAllAutoSections = useCallback(async () => {
    const doneIds = (autoRun?.results ?? []).filter((r) => r.status === "done").map((r) => r.id)
    if (!doneIds.length) return
    let restored = 0
    for (const sectionId of doneIds) {
      const result = autoRun?.results.find((r) => r.id === sectionId)
      if (!result) continue
      try {
        await postJson<{ cleared: boolean }>(`/api/projects/${projectId}/auto-complete`, {
          section: sectionId,
          action: "clear",
        })
        restored++
      } catch {
        // Keep going — partial undo is better than stopping at the first failure.
      }
    }
    if (restored > 0) {
      const refreshed = await jsonFetcher<{ project: Project }>(`/api/projects/${projectId}`).catch(() => null)
      if (refreshed?.project?.specification) setSpec(refreshed.project.specification)
      setAutoRun((prev) =>
        prev
          ? {
            ...prev,
            doneCount: 0,
            results: prev.results.map((r) => (r.status === "done" ? { ...r, status: "skipped" } : r)),
          }
          : prev,
      )
      toast(`Removed ${restored} drafted section${restored === 1 ? "" : "s"}.`)
    } else {
      toast.error("Could not undo the drafted sections. Please try again.")
    }
  }, [autoRun, projectId])

  /** Continue after running out of credits — re-estimates so only the
   * sections still missing get queued (undone/failed ones included). */
  const stopAutoRun = useCallback(() => {
    autoStopRef.current = true
  }, [])
  const dismissAutoRun = useCallback(() => setAutoDismissed(true), [])
  const openAutoSection = useCallback((id: string) => {
    setActiveSection(id as PlanSectionId)
    setChatWithFocus(false)
    setAutoDismissed(true)
    setShowReview(false)
  }, [])

  if (!spec) {
    const pipelineFailed = projectState === "analysis_failed" || projectState === "plan_failed"
    const planning = projectState === "analysis_complete" || projectState === "pending_plan"
    const title = pipelineFailed
      ? projectState === "plan_failed"
        ? "The plan needs attention"
        : "Understanding needs attention"
      : planning
        ? "Drafting your plan"
        : "Preparing your starting context"
    const body = pipelineFailed
      ? pipelineError ?? "This step stopped before it finished. Retry it — anything already learned is kept."
      : projectState === "created"
        ? "Your project is live. Your co-founder is starting with what you shared — every word."
        : planning
          ? "Strategy, product and technology squads are drafting the plan right now — this page updates itself, and the plan lands here when it is ready."
          : "Atai is turning your vision into a plan you can shape together. This usually takes a minute."

    // Same journey model as the workspace, so both surfaces agree on which
    // step is running, how quiet it has been, and when a restart is allowed.
    const steps = buildJourneySteps(
      {
        state: projectState,
        events: liveEvents,
        updatedAt: liveUpdatedAt,
        error: pipelineError ?? undefined,
        pipelineRecovery: recovery ?? undefined,
        mode: initialProject.mode,
      },
      clock,
    )
    const activeStep = steps.find((s) => s.status === "at_work" || s.status === "getting_ready") ?? null
    const canRestart = Boolean(activeStep?.action?.restart)
    const restartLabel = activeStep?.id === "plan" ? "Restart planning" : "Restart understanding"
    const retryLabel = recovery?.phase === "plan" || projectState === "plan_failed" ? "Retry planning" : "Retry understanding"
    const automaticRetryRan = (recovery?.attempts ?? 0) > 1

    return (
      <PlanIncubator
        steps={steps}
        activeStep={activeStep}
        projectState={projectState}
        failed={pipelineFailed}
        title={title}
        body={body}
        automaticRetryRan={automaticRetryRan}
        retryNote={retryNote}
        pollFailures={pollFailures}
        pollError={pollError}
        elapsedMs={activeStep?.elapsedMs ?? null}
        now={clock}
        startedAt={activeStep?.detailAt ?? liveUpdatedAt}
        isOwner={isOwner}
        retrying={retryingPipeline}
        canRestart={canRestart}
        restartLabel={restartLabel}
        retryLabel={retryLabel}
        onRetry={() => void retryPipeline()}
        onRefreshPolling={refreshPolling}
        workspaceHref={`/project/${projectId}`}
      >
        {/* A failed parse must not swallow the answer: show the captured
            responses (raw text included) inside the same scrolling view. */}
        {pipelineFailed && artifacts.length > 0 && (
          <div className="w-full border-t border-border pt-4">
            <AIOutputsPanel artifacts={artifacts} spec={spec} />
          </div>
        )}
      </PlanIncubator>
    )
  }

  const health = computePlanHealth(spec)
  const firstMissing = health.missing[0] ?? null
  const artifactCount = artifacts.length + (artifacts.some((a) => a.kind === "final_spec") ? 0 : 1)
  // Recomputed from the saved plan with the same prompt builder the launch
  // route uses, so the nav badge and the review panel can never drift from
  // what the builder is actually sent.
  const coverage = useMemo(
    () => computeBriefCoverage(spec, initialProject.understanding, initialProject.preferences),
    [spec, initialProject.understanding, initialProject.preferences],
  )
  const runActive = Boolean(autoRun && (autoRun.phase === "working" || !autoDismissed))

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Plan quality and the launch CTA live in the page header so the
          co-founder column keeps its full height. The chip is portal-mounted
          twice — once for the phone identity row, once for the actions row —
          and CSS shows only one of them. */}
      {headerSlots.statusXs ? createPortal(<PlanStatusChip state={projectState} spec={spec} />, headerSlots.statusXs) : null}
      {headerSlots.statusSm ? createPortal(<PlanStatusChip state={projectState} spec={spec} />, headerSlots.statusSm) : null}
      {isOwner && !runActive && headerSlots.launch
        ? createPortal(
          <LaunchButton
            projectId={projectId}
            projectName={initialProject.name}
            requestedProjectId={initialProject.requestedProjectId}
            projectMode={initialProject.mode}
            state={projectState}
            spec={spec}
          />,
          headerSlots.launch,
        )
        : null}
      {/* Auto-complete button — portaled into the page header, where it takes
          the full width of its own row on phones and sits inline from sm up.
          Visible while the founder owns the workspace and a run isn't active. */}
      {isOwner && autoEstimate && autoEstimate.missingSections.length > 0 && !runActive && headerSlots.actions
        ? createPortal(
          <button
            onClick={startAutoComplete}
            className="group inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-fuchsia-600/20 transition-all hover:shadow-lg hover:shadow-fuchsia-600/30 hover:brightness-110 sm:flex-none sm:py-1.5"
          >
            <Sparkles className="size-3.5 shrink-0" aria-hidden />
            Auto-complete {autoEstimate.missingSections.length}
            <span className="hidden sm:inline">section{autoEstimate.missingSections.length === 1 ? "" : "s"}</span>
            {autoEstimate.sectionCost > 0 && (
              <span className="font-mono text-[11px] font-medium text-white/85">· {autoEstimate.totalCost}</span>
            )}
            <span className="hidden shrink-0 rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide sm:inline">New</span>
          </button>,
          headerSlots.actions,
        )
        : null}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Desktop: 3 areas — plan (left), AI (center, dominant), insights
          (right). Tablets stay in the tab flow below so all three are reachable
          at any width. */}
        <aside className="collab-scroll hidden w-64 shrink-0 overflow-y-auto border-r border-border lg:block" aria-label="My plan">
          <PlanNav
            spec={spec}
            activeSection={activeSection}
            onSelect={(id) => {
              setShowOutputs(false)
              setShowReview(false)
              setActiveSection((cur) => (cur === id ? null : id))
              setChatWithFocus(false)
            }}
            analysis={analysis}
            outputsCount={artifactCount}
            outputsActive={showOutputs}
            onOpenOutputs={() => {
              setShowOutputs(true)
              setShowReview(false)
              setActiveSection(null)
              setChatWithFocus(false)
            }}
            reviewCount={coverage.inBrief.length}
            reviewActive={showReview}
            onOpenReview={() => {
              setShowReview(true)
              setShowOutputs(false)
              setActiveSection(null)
              setChatWithFocus(false)
            }}
          />
        </aside>

        {/* Center column — hidden below lg so the tab flow is the single
          source of these components on phones and tablets. */}
        <main className="hidden min-w-0 flex-1 flex-col overflow-hidden lg:flex">
          {runActive && autoRun ? (
            <AutoCompleteRunView
              run={autoRun}
              spec={spec}
              onStop={stopAutoRun}
              onContinue={startAutoComplete}
              onDismiss={dismissAutoRun}
              onOpenSection={openAutoSection}
              onUndo={undoAutoSection}
              onDiscardAll={() => setAutoDiscardConfirm(true)}
              undoing={undoingSection}
            />
          ) : showReview ? (
            <div className="collab-scroll min-h-0 flex-1 overflow-y-auto">
              <BuilderReviewPanel
                spec={spec}
                understanding={initialProject.understanding}
                preferences={initialProject.preferences}
                artifacts={artifacts}
                onClose={() => setShowReview(false)}
              />
            </div>
          ) : showOutputs ? (
            <div className="collab-scroll min-h-0 flex-1 overflow-y-auto">
              <AIOutputsPanel
                artifacts={artifacts}
                spec={spec}
                onClose={() => setShowOutputs(false)}
              />
            </div>
          ) : activeSection && !chatWithFocus ? (
            <div className="min-h-0 flex-1 overflow-y-auto collab-scroll">
              <SectionDetail
                spec={spec}
                sectionId={activeSection}
                canEdit={isOwner}
                onSave={saveSection}
                draft={drafts[activeSection] ?? ""}
                onDraftChange={(value) => setDraft(activeSection, value)}
                projectId={projectId}
                userCredits={userCredits}
                onCreditsUpdated={setUserCredits}
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
              analysis={analysis}
              onOpenSection={(id) => {
                setShowOutputs(false)
                setShowReview(false)
                setActiveSection(id)
                setChatWithFocus(false)
              }}
            />
          )}
        </main>

        <aside className="collab-scroll hidden w-80 shrink-0 overflow-y-auto border-l border-border xl:block" aria-label="Plan insights">
          <InsightsPanel
            spec={spec}
            analysis={analysis}
            analyzing={analyzing}
            onAnalyze={runAnalysis}
            onRefresh={() => runAnalysis(true)}
            onWorkOn={(id) => {
              setActiveSection(id)
              setChatWithFocus(false)
              setShowReview(false)
            }}
            isOwner={isOwner}
            projectId={projectId}
            onSpecChanged={setSpec}
            onAnalysisUpdated={setAnalysis}
          />
        </aside>

        {/* Phone / tablet: single-column flow with view switcher — the only
          mount of chat/section/insights below lg, so the plan, the co-founder and
          the insights all stay reachable at any width. min-h-0 keeps the flex
          chain height-constrained so each tab panel scrolls internally. */}
        <div className="flex w-full min-h-0 flex-col lg:hidden">
          {runActive && autoRun && (
            <div className="flex min-h-0 flex-1 flex-col">
              <AutoCompleteRunView
                run={autoRun}
                spec={spec}
                onStop={stopAutoRun}
                onContinue={startAutoComplete}
                onDismiss={dismissAutoRun}
                onOpenSection={(id) => {
                  openAutoSection(id)
                  setMobileView("plan")
                }}
                onUndo={undoAutoSection}
                onDiscardAll={() => setAutoDiscardConfirm(true)}
                undoing={undoingSection}
              />
            </div>
          )}
          <div className={cx("flex w-full min-h-0 flex-col", runActive && "hidden")}>
            <div className="flex shrink-0 border-b border-border bg-card" role="tablist" aria-label="Workspace views">
              {([
                { v: "plan", label: "My Plan", Icon: ClipboardList },
                { v: "chat", label: "Co-Founder", Icon: Sparkles },
                { v: "insights", label: "Insights", Icon: Lightbulb },
              ] as const).map(({ v, label, Icon }) => (
                <button
                  key={v}
                  id={`collab-tab-${v}`}
                  role="tab"
                  aria-selected={mobileView === v}
                  aria-controls={`collab-panel-${v}`}
                  onClick={() => setMobileView(v)}
                  className={cx(
                    // min-h-11 keeps the whole strip inside the 44px touch target.
                    "flex min-h-11 flex-1 items-center justify-center gap-1.5 border-b-2 px-1 text-xs font-medium transition-colors",
                    mobileView === v
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-1 min-h-0 flex-col">
              {mobileView === "plan" && (
                <div id="collab-panel-plan" role="tabpanel" aria-labelledby="collab-tab-plan" className="collab-scroll min-h-0 flex-1 overflow-y-auto md:mx-auto md:w-full md:max-w-3xl">
                  {showReview ? (
                    <BuilderReviewPanel
                      spec={spec}
                      understanding={initialProject.understanding}
                      preferences={initialProject.preferences}
                      artifacts={artifacts}
                      onClose={() => setShowReview(false)}
                    />
                  ) : showOutputs ? (
                    <AIOutputsPanel
                      artifacts={artifacts}
                      spec={spec}
                      onClose={() => setShowOutputs(false)}
                    />
                  ) : (
                    <PlanNav
                      spec={spec}
                      activeSection={activeSection}
                      onSelect={(id) => {
                        const selecting = activeSection !== id
                        setShowReview(false)
                        setActiveSection(selecting ? id : null)
                        setChatWithFocus(false)
                        if (selecting) setMobileView("chat")
                      }}
                      analysis={analysis}
                      forMobile
                      outputsCount={artifactCount}
                      outputsActive={showOutputs}
                      onOpenOutputs={() => {
                        setShowOutputs(true)
                        setShowReview(false)
                        setActiveSection(null)
                        setChatWithFocus(false)
                      }}
                      reviewCount={coverage.inBrief.length}
                      reviewActive={showReview}
                      onOpenReview={() => {
                        setShowReview(true)
                        setShowOutputs(false)
                        setActiveSection(null)
                        setChatWithFocus(false)
                      }}
                    />
                  )}
                </div>
              )}
              {mobileView === "chat" && (
                <div id="collab-panel-chat" role="tabpanel" aria-labelledby="collab-tab-chat" className="flex min-h-0 flex-1 flex-col">
                  <div className={cx("min-h-0 flex-1", activeSection && !chatWithFocus && "collab-scroll overflow-y-auto")}>
                    {activeSection && !chatWithFocus ? (
                      <SectionDetail
                        spec={spec}
                        sectionId={activeSection}
                        canEdit={isOwner}
                        onSave={saveSection}
                        draft={drafts[activeSection] ?? ""}
                        onDraftChange={(value) => setDraft(activeSection, value)}
                        projectId={projectId}
                        userCredits={userCredits}
                        onCreditsUpdated={setUserCredits}
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
                        analysis={analysis}
                        onOpenSection={(id) => {
                          setShowOutputs(false)
                          setShowReview(false)
                          setActiveSection(id)
                          setChatWithFocus(false)
                          // On phones the selected section renders in the chat
                          // tab, so jump there to keep the chip's promise.
                          setMobileView("chat")
                        }}
                      />
                    )}
                  </div>
                </div>
              )}
              {mobileView === "insights" && (
                <div id="collab-panel-insights" role="tabpanel" aria-labelledby="collab-tab-insights" className="collab-scroll min-h-0 flex-1 overflow-y-auto md:mx-auto md:w-full md:max-w-3xl">
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
          </div>
        </div>
      </div>

      {/* Confirm the co-founder's auto-complete run before any credits move */}
      <AlertDialog open={autoConfirm} onOpenChange={setAutoConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Let your co-founder finish the plan?</AlertDialogTitle>
            <AlertDialogDescription>
              {autoEstimate
                ? `${autoEstimate.missingSections.length} section${autoEstimate.missingSections.length === 1 ? "" : "s"} still need attention. Your co-founder first adds the suggestions you've already been shown, then drafts whatever is still missing — grounded in your plan. You review and can undo anything afterwards.`
                : "Your co-founder will draft the missing sections, grounded in your plan — you review and can undo anything afterwards."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {autoEstimate && autoEstimate.suggestionsAvailable ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
              <Sparkles className="mr-1 inline size-3.5 text-primary" aria-hidden />
              {autoEstimate.suggestionsAvailable} suggestion{autoEstimate.suggestionsAvailable === 1 ? "" : "s"} you've already reviewed will be added first — free.
            </div>
          ) : null}
          {autoEstimate && autoEstimate.sectionCost > 0 && (
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              About <span className="font-semibold text-foreground">{autoEstimate.totalCost} credit{autoEstimate.totalCost === 1 ? "" : "s"}</span> ({autoEstimate.missingSections.length} × {autoEstimate.sectionCost}) · balance {autoEstimate.availableCredits}
              {!autoEstimate.canAfford &&
                ` — you can afford the first ${autoEstimate.affordableSections}, and your co-founder will pause until you top up.`}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAutoComplete}>Yes — work on it all</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Discard-all confirmation — removes only the co-founder's drafts */}
      <AlertDialog open={autoDiscardConfirm} onOpenChange={setAutoDiscardConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove all drafted sections?</AlertDialogTitle>
            <AlertDialogDescription>
              Every section your co-founder just drafted will be reset to "not defined". Sections you wrote yourself stay untouched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAutoDiscardConfirm(false)}>Keep the drafts</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setAutoDiscardConfirm(false)
                void discardAllAutoSections()
              }}
            >
              Remove them
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
