"use client"

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Lightbulb,
  Radar,
  RotateCcw,
  ShieldCheck,
  Rocket,
  ScanLine,
  type LucideIcon,
} from "lucide-react"
import type { JourneyStepView } from "@/lib/workspace/workspace-view-model"
import { cn } from "@/lib/utils"
import "./plan-incubator.css"

// ─── Copy ─────────────────────────────────────────────────────────────────────

const PHASE_ICONS: Record<string, LucideIcon> = {
  understand: Radar,
  plan: ClipboardList,
  build: Lightbulb,
  validate: ShieldCheck,
  launch: Rocket,
}

const PHASE_HEADLINE: Record<string, string> = {
  understand: "Your co-founder is reading every word",
  plan: "The plan is coming together",
  build: "Getting your starting context in shape",
  validate: "Lining up the plan",
  launch: "Almost there",
}

const PHASE_FALLBACK_BODY: Record<string, string> = {
  understand:
    "The research team is mapping your idea against real markets right now. This page refreshes itself — the plan lands here when it is ready.",
  plan:
    "Strategy, product and technology squads are writing the plan together. It lands on this page the moment it is ready — no refresh needed.",
  build:
    "Your project is live. The co-founder is starting with exactly what you shared — nothing invented, nothing lost.",
  validate:
    "Your team has everything it needs. The first draft is being shaped now.",
  launch: "Atai is turning your vision into a plan you can shape together.",
}

const ROTATING_LINES: Record<string, string[]> = {
  understand: [
    "Your vision is being read line by line — every noun tells the research team what to go find.",
    "Comparable products are being studied: what they charge for, where they lose people, what you can do differently.",
    "Positions are being taken now. By the time this plan lands, the market picture is already made.",
    "Nothing is guessed. Every claim your co-founder writes will point back to something it actually found.",
    "The dots are connecting: your idea, your buyers, and the gap only you can fill.",
  ],
  plan: [
    "Strategy, product and technology squads are working in parallel — not in a queue.",
    "Every screen being named today becomes a task the build squads pick up tomorrow.",
    "Your plan is being written like an investor would read it and an engineer would build it — both at once.",
    "Pricing, pages, data models: each decision is cross-checked against the others before it is kept.",
    "This is the blueprint your co-founder signs. Change any line of it later — nothing here is final until you say so.",
    "Watch the roadmap: each step hands off to the next one cleanly. That handoff is the whole trick.",
  ],
  fallback: [
    "Every second of this run makes the build faster later — plans written well are built once.",
    "The best founders shape the plan, not just read it. When it lands, this page is yours.",
    "Your co-founder is connecting the dots between what you said and what buyers actually pay for.",
  ],
}

const WAIT_PROMPTS = [
  "Think of the one thing a first customer must be able to do in minute one.",
  "What would make this product impossible to quit using?",
  "Name it out loud — a short name sticks faster in a market.",
  "Who pays you first? Picture that person exactly.",
  "Pick the single metric you will watch after launch.",
  "What would make you proud to send this link to a friend?",
]

function linesFor(state: string | null | undefined): string[] {
  if (state === "analyzing" || state === "analysis_complete" || state === "pending_plan") {
    return ROTATING_LINES.plan
  }
  return ROTATING_LINES.understand
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}:${String(s % 60).padStart(2, "0")}` : `0:${String(s).padStart(2, "0")}`
}

type StepVisual = "done" | "working" | "attention" | "next"

function stepVisual(status: JourneyStepView["status"], isCurrent: boolean): StepVisual {
  if (status === "needs_attention") return "attention"
  if (status === "completed") return "done"
  if (status === "at_work" || status === "getting_ready" || isCurrent) return "working"
  return "next"
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function IncubatorEmblem() {
  return (
    <div className="pi-emblem" aria-hidden>
      <span className="pi-halo" />
      <span className="pi-halo pi-halo--late" />
      <span className="pi-orbit">
        <span className="pi-spark" />
      </span>
      <span className="pi-orbit pi-orbit--inner">
        <span className="pi-spark pi-spark--small" />
      </span>
      <span className="pi-core">
        <ScanLine className="size-6" />
      </span>
    </div>
  )
}

function Roadmap({ steps, currentId }: { steps: JourneyStepView[]; currentId: string | null }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <ol className="pi-road" aria-label="Progress of your project roadmap">
      {steps.map((step, i) => {
        const isCurrent = step.id === currentId
        const visual = stepVisual(step.status, isCurrent)
        const Icon = PHASE_ICONS[step.id] ?? ClipboardList
        const expanded = open === step.id
        const statusText =
          visual === "done"
            ? "Done"
            : visual === "attention"
              ? "Needs attention"
              : visual === "working"
                ? step.status === "getting_ready"
                  ? "Warming up"
                  : "At work"
                : "Queued";
        return (
          <li key={step.id} className={cn("pi-step", `pi-step--${visual}`)} style={{ "--i": i } as CSSProperties}>
            {i > 0 && (
              <span className="pi-rail" aria-hidden>
                <span className={cn("pi-rail-fill", visual === "working" && "pi-rail-fill--flow", visual === "done" && "pi-rail-fill--solid")} />
              </span>
            )}
            <button
              type="button"
              className="pi-node"
              onClick={() => setOpen(expanded ? null : step.id)}
              aria-expanded={expanded}
              title={`${step.team} — ${step.sub}`}
            >
              {visual === "done" ? <Check className="size-3.5" /> : <Icon className="size-4" />}
              {visual === "working" && <span className="pi-node-ping" aria-hidden />}
            </button>
            <div className="pi-step-body">
              <button
                type="button"
                className="pi-step-head"
                onClick={() => setOpen(expanded ? null : step.id)}
                aria-expanded={expanded}
              >
                <span className="pi-step-label">{step.label}</span>
                <span className="pi-step-status">{statusText}</span>
              </button>
              {expanded && (
                <p className="pi-step-detail">
                  {step.team} · {step.sub}
                  {step.detail ? ` — ${step.detail}` : ""}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function LiveFeed({ events }: { events: string[] }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (events.length < 2) return
    const id = window.setInterval(() => setI((n) => (n + 1) % events.length), 4200)
    return () => window.clearInterval(id)
  }, [events.length])
  if (events.length === 0) return null
  const message = events[i % events.length]
  return (
    <div className="pi-feed" role="status" aria-live="polite">
      <span className="pi-feed-dot" aria-hidden />
      <span key={message} className="pi-feed-text">
        {message}
      </span>
    </div>
  )
}

function WaitPrompts() {
  // Deterministic first card: this renders server-side too, so a random seed
  // would mismatch on hydration.
  const [i, setI] = useState(0)
  const next = () => setI((n) => (n + 1) % WAIT_PROMPTS.length)
  const prev = () => setI((n) => (n - 1 + WAIT_PROMPTS.length) % WAIT_PROMPTS.length)
  return (
    <div className="pi-prompts">
      <p className="pi-prompts-eyebrow">While you wait — a founder question</p>
      <div className="pi-prompts-row">
        <button type="button" className="pi-prompts-nav" onClick={prev} aria-label="Previous question">
          <ChevronLeft className="size-4" />
        </button>
        <p key={i} className="pi-prompts-text">
          {WAIT_PROMPTS[i]}
        </p>
        <button type="button" className="pi-prompts-nav" onClick={next} aria-label="Next question">
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export interface PlanIncubatorProps {
  steps: JourneyStepView[]
  activeStep: JourneyStepView | null
  projectState: string
  mode?: string
  failed: boolean
  title: string
  body: string
  /** Raw pipeline error, shown only in the failed state. */
  errorBody?: string | null
  automaticRetryRan?: boolean
  retryNote?: string | null
  pollFailures?: number
  pollError?: string | null
  elapsedMs: number | null
  now: number
  startedAt: number | null
  isOwner: boolean
  retrying: boolean
  canRestart: boolean
  restartLabel: string
  retryLabel: string
  onRetry: () => void
  onRefreshPolling: () => void
  workspaceHref: string
  children?: ReactNode
}

export function PlanIncubator({
  steps,
  activeStep,
  projectState,
  failed,
  title,
  body,
  errorBody,
  automaticRetryRan,
  retryNote,
  pollFailures = 0,
  pollError = null,
  elapsedMs,
  now,
  startedAt,
  isOwner,
  retrying,
  canRestart,
  restartLabel,
  retryLabel,
  onRetry,
  onRefreshPolling,
  workspaceHref,
  children,
}: PlanIncubatorProps) {
  const lines = useMemo(() => (failed ? [] : linesFor(projectState)), [failed, projectState])
  const [lineIndex, setLineIndex] = useState(0)
  useEffect(() => {
    if (lines.length < 2) return
    const id = window.setInterval(() => setLineIndex((n) => (n + 1) % lines.length), 6500)
    return () => window.clearInterval(id)
  }, [lines.length])

  const currentId = activeStep?.id ?? steps.find((s) => s.status === "at_work" || s.status === "getting_ready")?.id ?? "understand"
  const liveMessages = useMemo(
    () => steps.filter((s) => s.detail && (s.status === "at_work" || s.status === "getting_ready")).map((s) => s.detail as string),
    [steps],
  )
  const sinceStart = startedAt !== null ? Math.max(0, now - startedAt) : null
  const stalled = Boolean(activeStep?.stalled)

  return (
    <div className="pi-shell collab-scroll">
      <div className="pi-grid" aria-hidden />
      <div className="pi-inner">
        {!failed && <IncubatorEmblem />}

        <h2 className={cn("pi-title", !failed && "pi-anim")}>{failed ? title : PHASE_HEADLINE[currentId] ?? title}</h2>
        <p className={cn("pi-body", !failed && "pi-anim")} style={{ "--i": 1 } as CSSProperties}>
          {failed ? errorBody || body : body}
        </p>

        {!failed && lines.length > 0 && (
          <p key={lineIndex} className="pi-rotator" aria-hidden>
            {lines[lineIndex % lines.length]}
          </p>
        )}

        {!failed && activeStep?.detail && <LiveFeed events={liveMessages} />}

        {!failed && (
          <>
            <Roadmap steps={steps} currentId={currentId} />
            <div className="pi-meta">
              <span className="pi-timer">
                <span className="pi-timer-dot" aria-hidden />
                {sinceStart !== null ? fmtClock(sinceStart) : "0:00"} on this step
              </span>
              {elapsedMs !== null && (
                <span className="pi-quiet">last update {fmtClock(elapsedMs)} ago</span>
              )}
            </div>
            {stalled && (
              <p className="pi-stall">
                This step is running long. If the work stops responding it restarts automatically — nothing is lost.
              </p>
            )}
          </>
        )}

        {failed && automaticRetryRan && (
          <p className="pi-quiet-note">
            We already retried this step automatically and it stopped again. Retrying now keeps everything already
            learned.
          </p>
        )}
        {retryNote && (
          <p role="alert" className="pi-alert">
            {retryNote}
          </p>
        )}

        {pollFailures >= 3 && (
          <div role="status" className="pi-warn">
            <p>
              We can&apos;t refresh this project right now{pollError ? ` — ${pollError}` : ""}. We keep trying
              automatically.
            </p>
            <button type="button" onClick={onRefreshPolling} className="pi-link">
              Try again now
            </button>
          </div>
        )}

        <div className="pi-actions">
          {failed ? (
            <>
              {isOwner && (
                <button type="button" disabled={retrying} onClick={onRetry} className="pi-btn pi-btn--primary">
                  {retrying ? "Retrying…" : retryLabel}
                </button>
              )}
              <a href={workspaceHref} className="pi-btn pi-btn--ghost">
                Open workspace
              </a>
            </>
          ) : (
            <>
              {canRestart && isOwner && (
                <button type="button" disabled={retrying} onClick={onRetry} className="pi-btn pi-btn--soft">
                  <RotateCcw className="size-3.5" aria-hidden />
                  {retrying ? "Restarting…" : restartLabel}
                </button>
              )}
              <WaitPrompts />
            </>
          )}
        </div>

        {!failed && (
          <p className="pi-foot">
            Taking longer than expected?{" "}
            <a href={workspaceHref} className="pi-link">
              Open the workspace
            </a>{" "}
            to see each step and restart it. This page updates itself — the plan appears here when it lands.
          </p>
        )}

        {children}
      </div>
    </div>
  )
}
